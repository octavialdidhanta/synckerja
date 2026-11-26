import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import type { RenderDraftRow, RenderDraftSaved, RenderJobPreview, RenderJobSaved, RenderJobsList } from "../../db/render";
import {
  confirmFootageInput,
  FOOTAGE_CONFIRM_NEXT_STEP,
  type FootageConfirmableTool,
  type SignedFootageConfirmation,
  type VerifiedFootageConfirmation,
} from "../footage/confirmation";
import { renderSpecV1, specDuration } from "./renderSpec";
import type { CatalogTextBlocks } from "../../db/catalog";
import { checkSpec, footageFindings, specCheckPasses, type FootageLookup } from "./specChecks";
import { STILLS_WAIT_DEFAULT, stillsSheetResult, type StillsDeps } from "./stillsView";
import type { McpContentResult } from "../footage/view";

/**
 * A saved draft (render.jobs.draft returns draft_id) plus the changed top-level spec keys. styles merge per style
 * name; every other key (shots, texts, audio, outro, stills, output_name) replaces the draft's value.
 */
const draftPatch = z
  .object({
    output_name: z.unknown().optional(),
    shots: z.unknown().optional(),
    texts: z.unknown().optional(),
    styles: z.record(z.string(), z.unknown()).optional(),
    audio: z.unknown().optional(),
    outro: z.unknown().optional(),
    stills: z.unknown().optional(),
  })
  .strict();

const oneSpecSource = (v: { spec?: unknown; draft_id?: string; patch?: unknown }) =>
  (v.spec !== undefined) !== (v.draft_id !== undefined) && (v.patch === undefined || v.draft_id !== undefined);
const oneSpecSourceMessage = { message: "pass spec, or draft_id (+ optional patch), not both" };

export const renderJobCreatePreviewInput = z
  .object({
    plan_id: z.string().uuid().nullable().optional(),
    title: z.string().trim().min(1).max(200).optional(),
    spec: renderSpecV1.optional(),
    draft_id: z.string().uuid().optional(),
    patch: draftPatch.optional(),
    /** Keep a "wajib" style finding for this one video, with a reason the user can read. Technical errors cannot be overridden. */
    overrides: z
      .array(z.object({ code: z.string().trim().min(1).max(60), reason: z.string().trim().min(5).max(300) }).strict())
      .max(20)
      .optional(),
  })
  .strict()
  .refine(oneSpecSource, oneSpecSourceMessage);

export const renderStillsCreateInput = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    /** The spec of the video to check; its stills field (or the stills here) picks the seconds. */
    spec: renderSpecV1.optional(),
    draft_id: z.string().uuid().optional(),
    patch: draftPatch.optional(),
    stills: z.array(z.number().finite().min(0).max(3600)).min(1).max(12).optional(),
    /** Wait for the Agent and return the contact sheet as a picture (default true; up to 75 s). */
    wait: z.boolean().optional(),
  })
  .strict()
  .refine(oneSpecSource, oneSpecSourceMessage);

export type DraftStore = {
  get?: (ctx: McpAuthContext, draftId: string) => Promise<RenderDraftRow>;
  update?: (
    ctx: McpAuthContext,
    draftId: string,
    input: { title: string; plan_id: string | null; spec: unknown },
  ) => Promise<RenderDraftSaved>;
};

type SpecV1 = z.infer<typeof renderSpecV1>;

/**
 * Seconds to check when none are given: the middle of every text window (at most 11, spread over the video) and
 * the closer (the last moment of the video), so every text and the outro are seen once.
 */
export function defaultStills(spec: SpecV1): number[] {
  const dur = specDuration(spec);
  const mids = [...new Set(spec.texts.map((t) => Math.round(((t.start + Math.min(t.end, dur)) / 2) * 100) / 100))]
    .filter((s) => s >= 0 && s < dur)
    .sort((a, b) => a - b);
  const pick = mids.length <= 11 ? mids : Array.from({ length: 11 }, (_, i) => mids[Math.round((i * (mids.length - 1)) / 10)]!);
  const closer = Math.max(0, Math.round((dur - 0.2) * 100) / 100);
  return [...new Set([...pick, closer])].sort((a, b) => a - b).slice(0, 12);
}

/** Merge a patch into a draft spec: styles per style name, other keys replace. */
export function applyDraftPatch(spec: Record<string, unknown>, patch: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!patch) return spec;
  const out: Record<string, unknown> = { ...spec };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    if (value === null) {
      delete out[key];
      continue;
    }
    if (key === "styles" && value && typeof value === "object") {
      const base = (spec.styles && typeof spec.styles === "object" ? spec.styles : {}) as Record<string, unknown>;
      const merged: Record<string, unknown> = { ...base };
      for (const [name, style] of Object.entries(value as Record<string, unknown>)) {
        const prev = base[name];
        merged[name] =
          style && typeof style === "object" && prev && typeof prev === "object" ? { ...(prev as object), ...(style as object) } : style;
      }
      out.styles = merged;
    } else {
      out[key] = value;
    }
  }
  return out;
}

/** The spec to use: given inline, or a saved draft with its patch (the patch is written back to the same draft_id). */
async function resolveSpec(
  ctx: McpAuthContext,
  input: { title?: string; plan_id?: string | null; spec?: SpecV1; draft_id?: string; patch?: Record<string, unknown> },
  drafts: DraftStore | undefined,
): Promise<{ title: string; plan_id: string | null; spec: SpecV1; draft_id: string | null }> {
  if (input.spec) {
    if (!input.title) throw new Error("invalid_input: title: Required");
    return { title: input.title, plan_id: input.plan_id ?? null, spec: input.spec, draft_id: null };
  }
  if (!drafts?.get) throw new Error("invalid_input: draft_id is not available here");
  const row = await drafts.get(ctx, input.draft_id!);
  const merged = applyDraftPatch(row.spec as Record<string, unknown>, input.patch);
  const parsed = renderSpecV1.safeParse(merged);
  if (!parsed.success) {
    const where = parsed.error.issues.slice(0, 5).map((i) => `spec.${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`invalid_input: ${where}`);
  }
  const title = input.title ?? row.title;
  const plan_id = input.plan_id !== undefined ? input.plan_id : row.plan_id;
  if (input.patch && drafts.update) await drafts.update(ctx, row.draft_id, { title, plan_id, spec: parsed.data });
  return { title, plan_id, spec: parsed.data, draft_id: row.draft_id };
}

export const renderJobsListInput = z.object({ limit: z.number().int().min(1).max(50).optional() }).strict();

type Sign = (ctx: McpAuthContext, tool: FootageConfirmableTool, previewId: string, expiresAt: string) => Promise<SignedFootageConfirmation>;
type Verify = (ctx: McpAuthContext, tool: FootageConfirmableTool, token: string) => Promise<VerifiedFootageConfirmation>;

export async function previewRenderJobResult(
  ctx: McpAuthContext,
  args: unknown,
  preview: (ctx: McpAuthContext, input: { plan_id: string | null; title: string; spec: unknown }) => Promise<RenderJobPreview>,
  sign: Sign,
  getStyle?: (ctx: McpAuthContext) => Promise<CatalogTextBlocks>,
  lookupFootage?: (ctx: McpAuthContext, fileKey: string) => Promise<Awaited<ReturnType<FootageLookup>>>,
  drafts?: DraftStore,
): Promise<Record<string, unknown>> {
  const parsed = renderJobCreatePreviewInput.safeParse(args);
  if (!parsed.success) {
    const where = parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`invalid_input: ${where}`);
  }
  const resolved = await resolveSpec(ctx, parsed.data as Parameters<typeof resolveSpec>[1], drafts);
  const { spec, title } = resolved;
  // Same checks as render.jobs.draft, enforced here: nothing is queued while a technical error or an unresolved "wajib" remains.
  const footageErrors = lookupFootage ? await footageFindings(spec, (k) => lookupFootage(ctx, k)) : [];
  const checks = checkSpec(spec, getStyle ? await getStyle(ctx) : {}, parsed.data.overrides ?? [], footageErrors);
  if (!specCheckPasses(checks)) {
    return {
      error: "spec_check_failed",
      checks,
      ...(resolved.draft_id ? { draft_id: resolved.draft_id } : {}),
      next_step:
        "Nothing is saved. Fix every checks.errors item (cannot be overridden) and every checks.required item, or pass overrides [{code, reason}] for a required style rule the user wants to keep for this video. Then preview again.",
    };
  }
  const row = await preview(ctx, { plan_id: resolved.plan_id, title, spec });
  const signed = await sign(ctx, "render.jobs.create", row.preview_id, row.expires_at);
  return {
    title,
    ...(resolved.draft_id ? { draft_id: resolved.draft_id } : {}),
    plan: row.plan,
    summary: {
      production: spec.production,
      output_name: spec.output_name,
      duration_seconds: Math.round(specDuration(spec) * 100) / 100,
      shots: spec.shots.length,
      texts: spec.texts.length,
      vo: spec.audio.vo?.file ?? null,
      music: spec.audio.music?.file ?? null,
      uploads_to_plan: Boolean(row.plan) && !spec.stills,
      ...(spec.stills ? { stills: spec.stills } : {}),
    },
    checks,
    ...signed,
    next_step: FOOTAGE_CONFIRM_NEXT_STEP,
  };
}

export async function applyRenderJobResult(
  ctx: McpAuthContext,
  args: unknown,
  verify: Verify,
  apply: (ctx: McpAuthContext, previewId: string) => Promise<RenderJobSaved>,
): Promise<RenderJobSaved> {
  const parsed = confirmFootageInput.safeParse(args ?? {});
  if (!parsed.success) throw new Error("invalid_input");
  const verified = await verify(ctx, "render.jobs.create", parsed.data.confirm_token);
  return apply(ctx, verified.previewId);
}

export async function listRenderJobsResult(
  ctx: McpAuthContext,
  args: unknown,
  list: (ctx: McpAuthContext, limit: number) => Promise<RenderJobsList>,
): Promise<RenderJobsList> {
  const parsed = renderJobsListInput.safeParse(args ?? {});
  if (!parsed.success) throw new Error("invalid_input");
  return list(ctx, parsed.data.limit ?? 20);
}

/**
 * Gate 3 helper: queue a still preview straight away. A still preview publishes nothing (no upload, no footage usage,
 * footage stays in the inbox), so it needs no confirmation; technical errors still block, style rules only report.
 */
export async function createStillsResult(
  ctx: McpAuthContext,
  args: unknown,
  preview: (ctx: McpAuthContext, input: { plan_id: string | null; title: string; spec: unknown }) => Promise<RenderJobPreview>,
  apply: (ctx: McpAuthContext, previewId: string) => Promise<RenderJobSaved>,
  getStyle?: (ctx: McpAuthContext) => Promise<CatalogTextBlocks>,
  lookupFootage?: (ctx: McpAuthContext, fileKey: string) => Promise<Awaited<ReturnType<FootageLookup>>>,
  drafts?: DraftStore,
  stillsDeps?: StillsDeps,
): Promise<Record<string, unknown> | McpContentResult> {
  const parsed = renderStillsCreateInput.safeParse(args);
  if (!parsed.success) {
    const where = parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`invalid_input: ${where}`);
  }
  const resolved = await resolveSpec(ctx, parsed.data as Parameters<typeof resolveSpec>[1], drafts);
  const stills = parsed.data.stills ?? resolved.spec.stills ?? defaultStills(resolved.spec);
  if (!stills.length) throw new Error("invalid_input: stills: give the seconds to render (in stills or spec.stills)");
  const spec = { ...resolved.spec, stills };
  const footageErrors = lookupFootage ? await footageFindings(spec, (k) => lookupFootage(ctx, k)) : [];
  const checks = checkSpec(spec, getStyle ? await getStyle(ctx) : {}, [], footageErrors);
  if (checks.errors.length) {
    return {
      error: "spec_check_failed",
      checks,
      ...(resolved.draft_id ? { draft_id: resolved.draft_id } : {}),
      next_step: "Nothing is queued. Fix every checks.errors item, then call render.stills.create again.",
    };
  }
  const title = resolved.title.startsWith("Still") ? resolved.title : `Still – ${resolved.title}`;
  const row = await preview(ctx, { plan_id: null, title, spec });
  const saved = await apply(ctx, row.preview_id);
  if (parsed.data.wait !== false && stillsDeps) {
    return stillsSheetResult(ctx, saved.job_id, STILLS_WAIT_DEFAULT, stillsDeps, {
      ...(resolved.draft_id ? { draft_id: resolved.draft_id } : {}),
      checks,
    });
  }
  return {
    ...saved,
    stills,
    ...(resolved.draft_id ? { draft_id: resolved.draft_id } : {}),
    checks,
    next_step:
      "Follow it with render.jobs.list. When it is done, look at the contact sheet (result.stills_file in the production folder) or ask the user to, fix the spec until every text is clean, then render.jobs.create.preview for the full video without stills (gate 3). With draft_id, send only draft_id and a patch of what changed (and patch stills: null for the full render).",
  };
}

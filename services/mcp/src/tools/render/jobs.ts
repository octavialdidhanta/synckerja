import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import type { RenderJobPreview, RenderJobSaved, RenderJobsList } from "../../db/render";
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

export const renderJobCreatePreviewInput = z
  .object({
    plan_id: z.string().uuid().nullable().optional(),
    title: z.string().trim().min(1).max(200),
    spec: renderSpecV1,
    /** Keep a "wajib" style finding for this one video, with a reason the user can read. Technical errors cannot be overridden. */
    overrides: z
      .array(z.object({ code: z.string().trim().min(1).max(60), reason: z.string().trim().min(5).max(300) }).strict())
      .max(20)
      .optional(),
  })
  .strict();

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
): Promise<Record<string, unknown>> {
  const parsed = renderJobCreatePreviewInput.safeParse(args);
  if (!parsed.success) {
    const where = parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`invalid_input: ${where}`);
  }
  const { spec, title } = parsed.data;
  // Same checks as render.jobs.draft, enforced here: nothing is queued while a technical error or an unresolved "wajib" remains.
  const footageErrors = lookupFootage ? await footageFindings(spec, (k) => lookupFootage(ctx, k)) : [];
  const checks = checkSpec(spec, getStyle ? await getStyle(ctx) : {}, parsed.data.overrides ?? [], footageErrors);
  if (!specCheckPasses(checks)) {
    return {
      error: "spec_check_failed",
      checks,
      next_step:
        "Nothing is saved. Fix every checks.errors item (cannot be overridden) and every checks.required item, or pass overrides [{code, reason}] for a required style rule the user wants to keep for this video. Then preview again.",
    };
  }
  const row = await preview(ctx, { plan_id: parsed.data.plan_id ?? null, title, spec });
  const signed = await sign(ctx, "render.jobs.create", row.preview_id, row.expires_at);
  return {
    title,
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

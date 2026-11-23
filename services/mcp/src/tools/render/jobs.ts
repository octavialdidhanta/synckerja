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

export const renderJobCreatePreviewInput = z
  .object({
    plan_id: z.string().uuid().nullable().optional(),
    title: z.string().trim().min(1).max(200),
    spec: renderSpecV1,
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
): Promise<Record<string, unknown>> {
  const parsed = renderJobCreatePreviewInput.safeParse(args);
  if (!parsed.success) {
    const where = parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`invalid_input: ${where}`);
  }
  const { spec, title } = parsed.data;
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
      uploads_to_plan: Boolean(row.plan),
    },
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

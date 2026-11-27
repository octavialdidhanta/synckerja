import type { McpAuthContext } from "../../authz/context";
import type { RenderPlanStatus, RenderUploadBlock } from "../../db/render";

/** Read-only plan status for render.jobs.draft and render.stills.create (mcp_render_plan_status). */
export type RenderPlanStatusLookup = (ctx: McpAuthContext, planId: string) => Promise<RenderPlanStatus | null>;

/**
 * What to tell the user when a finished render will not reach the plan. The reasons and their order follow
 * uploadBlockReason (supabase/functions/_shared/orgDrive/uploadRules.ts) plus the Drive connection check,
 * so this is the refusal the Agent would otherwise only see after rendering.
 */
export const UPLOAD_BLOCK_MESSAGES: Record<RenderUploadBlock, string> = {
  not_approved:
    "Brief plan ini belum di-approve: video hasil render penuh TIDAK akan masuk ke plan (Agent melewati upload). Minta owner approve brief di Office dulu, lalu render penuh.",
  production_locked:
    "Produksi plan ini sudah di-approve: render penuh dengan plan_id ditolak (production_locked). Minta owner membuka lagi approve produksi di Office.",
  not_video_content:
    "Plan ini berjenis Post/Carousel: video tidak bisa diunggah ke plan ini. Pakai plan Reel/Story, atau render tanpa plan_id (video hanya tersimpan di laptop).",
  not_connected:
    "Google Drive organisasi belum disambungkan: video tidak bisa diunggah ke plan. Minta owner menyambungkan Drive di Office dulu.",
};

/** Fields added to a draft/stills/preview result: whether the full render uploads, and why not. */
export function planUploadFields(plan: RenderPlanStatus | null | undefined): {
  uploads_to_plan: boolean;
  upload_block: RenderUploadBlock | null;
  upload_warning?: string;
} {
  if (!plan) return { uploads_to_plan: false, upload_block: null };
  const block = plan.upload_block ?? null;
  return block
    ? { uploads_to_plan: false, upload_block: block, upload_warning: UPLOAD_BLOCK_MESSAGES[block] ?? `Video tidak akan masuk plan (${block}).` }
    : { uploads_to_plan: true, upload_block: null };
}

/** Status lookup that never breaks the draft or still: a failed read is reported, not thrown. */
export async function lookupPlanStatus(
  ctx: McpAuthContext,
  planId: string | null | undefined,
  lookup: RenderPlanStatusLookup | undefined,
): Promise<{ plan: RenderPlanStatus | null; error: string | null }> {
  if (!planId || !lookup) return { plan: null, error: null };
  try {
    return { plan: await lookup(ctx, planId), error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { plan: null, error: /not_found/.test(message) ? "not_found" : message.slice(0, 200) };
  }
}

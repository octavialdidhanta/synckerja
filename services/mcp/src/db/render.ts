import type { SupabaseClient } from "@supabase/supabase-js";

type Session = { userId: string; organizationId: string };

/**
 * Why a finished render would not reach its content plan (the refusal content-plan-media-upload gives the Agent),
 * or null when it will be uploaded. production_locked only appears from mcp_render_plan_status: a preview raises it.
 */
export type RenderUploadBlock = "not_approved" | "production_locked" | "not_video_content" | "not_connected";

export type RenderPlanStatus = {
  plan_id: string;
  title: string | null;
  production_status?: string | null;
  approved: boolean;
  upload_block: RenderUploadBlock | null;
};

export type RenderJobPreview = {
  plan: (RenderPlanStatus & { production_status: string | null }) | null;
  preview_id: string;
  expires_at: string;
};

export type RenderJobSaved = { saved: boolean; job_id: string; status: string };

export type RenderJobsList = {
  jobs: Array<{
    job_id: string;
    title: string;
    plan_id: string | null;
    status: string;
    stage: string | null;
    progress: number;
    attempts: number;
    error: string | null;
    result: Record<string, unknown> | null;
    created_at: string;
    finished_at: string | null;
  }>;
};

async function callJson<T>(admin: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await admin.rpc(fn, args);
  if (error) throw new Error(error.message);
  const value = Array.isArray(data) ? data[0] : data;
  if (value == null) throw new Error("not_found");
  return (typeof value === "string" ? JSON.parse(value) : value) as T;
}

export function previewRenderJob(
  admin: SupabaseClient,
  ctx: Session,
  input: { plan_id: string | null; title: string; spec: unknown },
): Promise<RenderJobPreview> {
  return callJson<RenderJobPreview>(admin, "mcp_preview_render_job", {
    p_user_id: ctx.userId,
    p_organization_id: ctx.organizationId,
    p_input: input,
  });
}

export function applyRenderJob(admin: SupabaseClient, ctx: Session, previewId: string): Promise<RenderJobSaved> {
  return callJson<RenderJobSaved>(admin, "mcp_apply_render_job", {
    p_user_id: ctx.userId,
    p_organization_id: ctx.organizationId,
    p_preview_id: previewId,
  });
}

export function listRenderJobs(admin: SupabaseClient, ctx: Session, limit: number): Promise<RenderJobsList> {
  return callJson<RenderJobsList>(admin, "mcp_list_render_jobs", {
    p_user_id: ctx.userId,
    p_organization_id: ctx.organizationId,
    p_limit: limit,
  });
}

export type RenderDraftSaved = { draft_id: string; expires_at: string };
export type RenderDraftRow = { draft_id: string; title: string; plan_id: string | null; spec: unknown; expires_at: string };

export function saveRenderDraft(
  admin: SupabaseClient,
  ctx: Session,
  input: { title: string; plan_id: string | null; spec: unknown },
): Promise<RenderDraftSaved> {
  return callJson<RenderDraftSaved>(admin, "mcp_save_render_draft", {
    p_user_id: ctx.userId,
    p_organization_id: ctx.organizationId,
    p_title: input.title,
    p_plan_id: input.plan_id,
    p_spec: input.spec,
  });
}

export function getRenderDraft(admin: SupabaseClient, ctx: Session, draftId: string): Promise<RenderDraftRow> {
  return callJson<RenderDraftRow>(admin, "mcp_get_render_draft", {
    p_user_id: ctx.userId,
    p_organization_id: ctx.organizationId,
    p_draft_id: draftId,
  });
}

export function updateRenderDraft(
  admin: SupabaseClient,
  ctx: Session,
  draftId: string,
  input: { title: string; plan_id: string | null; spec: unknown },
): Promise<RenderDraftSaved> {
  return callJson<RenderDraftSaved>(admin, "mcp_update_render_draft", {
    p_user_id: ctx.userId,
    p_organization_id: ctx.organizationId,
    p_draft_id: draftId,
    p_title: input.title,
    p_plan_id: input.plan_id,
    p_spec: input.spec,
  });
}

/** The still-preview sheet the Agent uploaded for one job (only this organization's render-stills folder). */
export async function downloadRenderStill(admin: SupabaseClient, ctx: Session, storagePath: string): Promise<Uint8Array> {
  const prefix = `${ctx.organizationId}/render-stills/`;
  if (!storagePath.startsWith(prefix) || storagePath.includes("..") || !/\.jpe?g$/i.test(storagePath)) {
    throw new Error("forbidden");
  }
  const { data, error } = await admin.storage.from("catalog-media").download(storagePath);
  if (error || !data) throw new Error("not_found");
  return new Uint8Array(await data.arrayBuffer());
}

export type RenderJobDetail = {
  job_id: string;
  title: string;
  plan_id: string | null;
  status: string;
  stage: string | null;
  error: string | null;
  result: Record<string, unknown> | null;
  spec: unknown;
  created_at: string;
  finished_at: string | null;
};

/** Will a render of this plan reach the plan? Read only; null plan_id gives null. */
export function getRenderPlanStatus(admin: SupabaseClient, ctx: Session, planId: string): Promise<RenderPlanStatus | null> {
  return callJson<RenderPlanStatus | null>(admin, "mcp_render_plan_status", {
    p_user_id: ctx.userId,
    p_organization_id: ctx.organizationId,
    p_plan_id: planId,
  });
}

/** One earlier render job with its spec: by job_id, or the newest finished full render of a content plan. */
export function getRenderJob(
  admin: SupabaseClient,
  ctx: Session,
  input: { job_id: string | null; plan_id: string | null },
): Promise<RenderJobDetail> {
  return callJson<RenderJobDetail>(admin, "mcp_get_render_job", {
    p_user_id: ctx.userId,
    p_organization_id: ctx.organizationId,
    p_job_id: input.job_id,
    p_plan_id: input.plan_id,
  });
}

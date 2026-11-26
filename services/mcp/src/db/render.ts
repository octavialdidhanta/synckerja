import type { SupabaseClient } from "@supabase/supabase-js";

type Session = { userId: string; organizationId: string };

export type RenderJobPreview = {
  plan: { plan_id: string; title: string | null; production_status: string | null } | null;
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

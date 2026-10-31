import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContentPlanRow } from "./listContentPlans";
import type { CrmLeadRow, OkrObjectiveRow } from "./phase1Reads";

type Session = { userId: string; organizationId: string };

export type ContentPlanWrite = {
  title?: string | null;
  postDate?: string | null;
  brief?: string | null;
};

export type ObjectiveCreate = {
  cycleId: string;
  title: string;
  whyImportant?: string | null;
  status?: string | null;
};

export type ObjectiveUpdate = {
  id: string;
  level: "company" | "department" | "individual";
  title?: string | null;
  status?: string | null;
};

export type LeadCreate = {
  client: string;
  title: string;
  category: string;
  source?: string | null;
  fuPriority?: string | null;
  status?: string | null;
};

export type LeadUpdate = {
  id: string;
  client?: string | null;
  title?: string | null;
  category?: string | null;
  source?: string | null;
  fuPriority?: string | null;
};

function asRows<T>(data: unknown): T[] {
  if (data == null) return [];
  return Array.isArray(data) ? (data as T[]) : [data as T];
}

async function callRpcOne<T>(admin: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await admin.rpc(fn, args);
  if (error) throw new Error(error.message);
  const row = asRows<T>(data)[0];
  if (!row) throw new Error("not_found");
  return row;
}

function sessionArgs(ctx: Session): Record<string, unknown> {
  return { p_user_id: ctx.userId, p_organization_id: ctx.organizationId };
}

export function createContentPlan(
  admin: SupabaseClient,
  ctx: Session,
  input: ContentPlanWrite & { title: string },
): Promise<ContentPlanRow> {
  return callRpcOne(admin, "mcp_create_content_plan", {
    ...sessionArgs(ctx),
    p_title: input.title,
    p_post_date: input.postDate ?? null,
    p_brief: input.brief ?? null,
  });
}

export function updateContentPlan(
  admin: SupabaseClient,
  ctx: Session,
  id: string,
  input: ContentPlanWrite,
): Promise<ContentPlanRow> {
  return callRpcOne(admin, "mcp_update_content_plan", {
    ...sessionArgs(ctx),
    p_id: id,
    p_title: input.title ?? null,
    p_post_date: input.postDate ?? null,
    p_brief: input.brief ?? null,
  });
}

export function createCompanyObjective(
  admin: SupabaseClient,
  ctx: Session,
  input: ObjectiveCreate,
): Promise<OkrObjectiveRow> {
  return callRpcOne(admin, "mcp_create_company_objective", {
    ...sessionArgs(ctx),
    p_cycle_id: input.cycleId,
    p_title: input.title,
    p_why_important: input.whyImportant ?? null,
    p_status: input.status ?? null,
  });
}

export function updateObjective(
  admin: SupabaseClient,
  ctx: Session,
  input: ObjectiveUpdate,
): Promise<OkrObjectiveRow> {
  return callRpcOne(admin, "mcp_update_objective", {
    ...sessionArgs(ctx),
    p_level: input.level,
    p_id: input.id,
    p_title: input.title ?? null,
    p_status: input.status ?? null,
  });
}

export function createLead(admin: SupabaseClient, ctx: Session, input: LeadCreate): Promise<CrmLeadRow> {
  return callRpcOne(admin, "mcp_create_lead", {
    ...sessionArgs(ctx),
    p_client: input.client,
    p_title: input.title,
    p_category: input.category,
    p_source: input.source ?? null,
    p_fu_priority: input.fuPriority ?? null,
    p_status: input.status ?? null,
  });
}

export function updateLead(admin: SupabaseClient, ctx: Session, input: LeadUpdate): Promise<CrmLeadRow> {
  return callRpcOne(admin, "mcp_update_lead", {
    ...sessionArgs(ctx),
    p_id: input.id,
    p_client: input.client ?? null,
    p_title: input.title ?? null,
    p_category: input.category ?? null,
    p_source: input.source ?? null,
    p_fu_priority: input.fuPriority ?? null,
  });
}

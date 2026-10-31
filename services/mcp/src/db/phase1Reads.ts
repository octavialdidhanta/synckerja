import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContentPlanRow } from "./listContentPlans";

export type OkrCycleRow = {
  id: string;
  name: string;
  year: number;
  quarter: string | null;
  period_type: string;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
};

export type OkrObjectiveRow = {
  id: string;
  level: "company" | "department" | "individual";
  title: string;
  status: string;
  progress_percentage: number;
  cycle_id: string;
  owner_name: string | null;
};

export type CrmLeadRow = {
  id: string;
  ticket_id: string;
  client: string;
  title: string;
  source: string | null;
  status: string | null;
  fu_priority: string | null;
  assignee: string | null;
  created_at: string;
};

type Session = { userId: string; organizationId: string };

async function callRpc<T>(admin: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<T[]> {
  const { data, error } = await admin.rpc(fn, args);
  if (error) throw new Error(error.message);
  return (data ?? []) as T[];
}

export async function listContentCalendar(
  admin: SupabaseClient,
  ctx: Session,
  month: string | null,
): Promise<ContentPlanRow[]> {
  return callRpc<ContentPlanRow>(admin, "mcp_list_content_calendar", {
    p_user_id: ctx.userId,
    p_organization_id: ctx.organizationId,
    p_month: month,
  });
}

export async function listOkrCycles(admin: SupabaseClient, ctx: Session): Promise<OkrCycleRow[]> {
  return callRpc<OkrCycleRow>(admin, "mcp_list_okr_cycles", {
    p_user_id: ctx.userId,
    p_organization_id: ctx.organizationId,
  });
}

export async function listOkrObjectives(
  admin: SupabaseClient,
  ctx: Session,
  cycleId: string | null,
): Promise<OkrObjectiveRow[]> {
  return callRpc<OkrObjectiveRow>(admin, "mcp_list_okr_objectives", {
    p_user_id: ctx.userId,
    p_organization_id: ctx.organizationId,
    p_cycle_id: cycleId,
  });
}

export async function listCrmLeads(
  admin: SupabaseClient,
  ctx: Session,
  status: string | null,
): Promise<CrmLeadRow[]> {
  return callRpc<CrmLeadRow>(admin, "mcp_list_crm_leads", {
    p_user_id: ctx.userId,
    p_organization_id: ctx.organizationId,
    p_status: status,
  });
}

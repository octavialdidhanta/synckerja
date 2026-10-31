import type { SupabaseClient } from "@supabase/supabase-js";

export type ContentPlanRow = {
  id: string;
  title: string | null;
  status: string;
  post_date: string | null;
  approved: boolean;
  production_status: string | null;
};

export async function listContentPlans(
  admin: SupabaseClient,
  ctx: { userId: string; organizationId: string },
): Promise<ContentPlanRow[]> {
  const { data, error } = await admin.rpc("mcp_list_content_plans", {
    p_user_id: ctx.userId,
    p_organization_id: ctx.organizationId,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as ContentPlanRow[];
}

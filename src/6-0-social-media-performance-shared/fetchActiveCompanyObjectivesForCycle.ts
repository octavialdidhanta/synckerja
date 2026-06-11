import { supabase } from "@/shared/lib/supabaseClient";

export type ActiveCompanyObjectiveOption = {
  id: string;
  title: string;
  cycle_id: string;
  status: string;
};

/** Active company objectives for a single OKR cycle (used on Insight targets page). */
export async function fetchActiveCompanyObjectivesForCycle(
  organizationId: string,
  cycleId: string,
): Promise<ActiveCompanyObjectiveOption[]> {
  const { data, error } = await supabase
    .from("company_objectives")
    .select("id, title, cycle_id, status")
    .eq("organization_id", organizationId)
    .eq("cycle_id", cycleId)
    .eq("status", "active")
    .order("title", { ascending: true });

  if (error) throw error;
  return (data ?? []) as ActiveCompanyObjectiveOption[];
}

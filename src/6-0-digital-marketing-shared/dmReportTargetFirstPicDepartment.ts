import type { DmReportTargetAccountAssignment } from "@/6-0-digital-marketing-shared/dmReportTargetTypes";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function resolveDmFirstPicDepartmentId(
  supabase: SupabaseClient,
  assignments: DmReportTargetAccountAssignment[],
): Promise<string | null> {
  if (assignments.length === 0) return null;

  const sorted = [...assignments].sort((a, b) =>
    `${a.channel}:${a.accountId}`.localeCompare(`${b.channel}:${b.accountId}`),
  );

  const firstEmployeeId = sorted[0]?.employeeId;
  if (!firstEmployeeId) return null;

  const { data, error } = await supabase
    .from("employees")
    .select("department_id")
    .eq("id", firstEmployeeId)
    .maybeSingle();

  if (error) throw error;
  return data?.department_id ?? null;
}

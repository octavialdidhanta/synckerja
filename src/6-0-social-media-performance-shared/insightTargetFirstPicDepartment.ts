import type { InsightTargetAccountAssignment } from "@/6-0-social-media-performance-shared/socialMediaInsightTargetTypes";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Resolve department_id from the first assigned PIC (deterministic order by platform+account). */
export async function resolveFirstPicDepartmentId(
  supabase: SupabaseClient,
  assignments: InsightTargetAccountAssignment[],
): Promise<string | null> {
  if (assignments.length === 0) return null;

  const sorted = [...assignments].sort((a, b) => {
    const ka = `${a.platform}:${a.accountId}`;
    const kb = `${b.platform}:${b.accountId}`;
    return ka.localeCompare(kb);
  });

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

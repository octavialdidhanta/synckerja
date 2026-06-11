import type { GoogleAdsReportTargetAccountAssignment } from "@/6-0-digital-marketing-shared/googleAdsReportTargetTypes";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function resolveGoogleAdsFirstPicDepartmentId(
  supabase: SupabaseClient,
  assignments: GoogleAdsReportTargetAccountAssignment[],
): Promise<string | null> {
  if (assignments.length === 0) return null;

  const sorted = [...assignments].sort((a, b) =>
    a.customerId.localeCompare(b.customerId),
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

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { isEmployeeActive } from "@/2-1-employees/utils/employeeUtils";

/**
 * Shape expected by reprimand UI (matches synckerja-reference field names).
 */
export interface EmployeeData {
  id: string;
  full_name: string;
  email: string;
  /** Display code when present on row; otherwise empty (UI shows "No ID" fallback). */
  employee_id: string;
  profile_photo_url?: string;
  photo_url?: string;
  status?: string;
  employee_status_id?: string | null;
  employee_status_name?: string | null;
  pending_removal?: boolean | null;
  join_date?: string;
  organization_id: string;
  departments?: { name: string };
  job_positions?: { name: string };
}

function nameFromJoin(
  rel: { name?: string } | { name?: string }[] | null | undefined,
): string | null {
  if (!rel) return null;
  if (Array.isArray(rel)) return rel[0]?.name ?? null;
  return rel.name ?? null;
}

async function fetchReprimandEmployees(organizationId: string): Promise<EmployeeData[]> {
  const { data: rows, error } = await supabase
    .from("employees")
    .select(
      `
        id,
        full_name,
        email,
        employee_id,
        user_id,
        profile_photo_url,
        status,
        employee_status_id,
        pending_removal,
        organization_id,
        join_date,
        departments(name),
        job_positions(name),
        employee_statuses!left(name)
      `,
    )
    .eq("organization_id", organizationId)
    .order("full_name");

  if (error) throw error;

  const activeRows = (rows ?? []).filter((row) =>
    isEmployeeActive({
      employee_status_name: nameFromJoin(row.employee_statuses),
      status: row.status,
      pending_removal: row.pending_removal,
    }),
  );

  const userIds = [
    ...new Set(activeRows.map((row) => row.user_id).filter((id): id is string => Boolean(id))),
  ];

  let photoByUser = new Map<string, string | null>();
  if (userIds.length > 0) {
    const { data: detailsRows } = await supabase
      .from("user_profile_details")
      .select("profile_id, profile_photo_url")
      .in("profile_id", userIds);

    photoByUser = new Map(
      (detailsRows ?? []).map((d) => [d.profile_id, d.profile_photo_url]),
    );
  }

  return activeRows.map((row) => {
    const detailPhoto = row.user_id ? photoByUser.get(row.user_id) : null;
    const photo = row.profile_photo_url || detailPhoto || null;
    const departmentName = nameFromJoin(row.departments);
    const jobPositionName = nameFromJoin(row.job_positions);

    return {
      id: row.id,
      full_name: row.full_name,
      email: row.email,
      employee_id: row.employee_id?.trim() ? row.employee_id : "",
      profile_photo_url: photo ?? undefined,
      photo_url: photo ?? undefined,
      status: row.status,
      employee_status_id: row.employee_status_id ?? null,
      employee_status_name: nameFromJoin(row.employee_statuses),
      pending_removal: row.pending_removal ?? null,
      join_date: row.join_date,
      organization_id: row.organization_id,
      departments: departmentName ? { name: departmentName } : undefined,
      job_positions: jobPositionName ? { name: jobPositionName } : undefined,
    };
  });
}

/** Lightweight employee list for reprimand views — avoids full `employees-optimized` roster fetch. */
export const useEmployees = () => {
  const { organizationId } = useCurrentOrg();

  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["employees-reprimand", organizationId],
    queryFn: () => fetchReprimandEmployees(organizationId!),
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return {
    employees: data ?? [],
    isPending,
    isLoading: isPending,
    error,
    refetch,
  };
};

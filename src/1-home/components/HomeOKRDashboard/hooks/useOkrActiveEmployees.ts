import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { isEmployeeActive } from '@/2-1-employees/utils/employeeUtils';

export type OkrActiveEmployee = {
  id: string;
  user_id: string | null;
  full_name: string;
};

function statusNameFromJoin(row: {
  employee_statuses?: { name?: string } | { name?: string }[] | null;
}) {
  const es = row.employee_statuses;
  if (!es) return null;
  if (Array.isArray(es)) return es[0]?.name ?? null;
  return es.name ?? null;
}

export type OkrEmployeeDirectoryEntry = {
  id: string;
  user_id: string | null;
  full_name: string;
  department_id: string | null;
  profile_photo_url: string | null;
  photo_url: string | null;
  job_position_name: string | null;
};

function jobPositionNameFromJoin(row: {
  job_positions?: { name?: string } | { name?: string }[] | null;
}) {
  const jp = row.job_positions;
  if (!jp) return null;
  if (Array.isArray(jp)) return jp[0]?.name ?? null;
  return jp.name ?? null;
}

async function fetchActiveOkrEmployees(organizationId: string, includeDirectoryFields: boolean) {
  const select = includeDirectoryFields
    ? `
          id,
          user_id,
          full_name,
          department_id,
          profile_photo_url,
          pending_removal,
          job_positions(name),
          employee_statuses!left(name)
        `
    : `
          id,
          user_id,
          full_name,
          pending_removal,
          employee_statuses!left(name)
        `;

  const { data, error } = await supabase
    .from('employees')
    .select(select)
    .eq('organization_id', organizationId)
    .order('full_name');

  if (error) throw error;

  const activeRows = (data ?? []).filter((row) =>
    isEmployeeActive({
      employee_status_name: statusNameFromJoin(row),
      status: null,
      pending_removal: row.pending_removal,
    }),
  );

  if (!includeDirectoryFields) {
    return activeRows.map((row) => ({
      id: row.id,
      user_id: row.user_id,
      full_name: row.full_name,
    })) satisfies OkrActiveEmployee[];
  }

  const userIds = [
    ...new Set(activeRows.map((row) => row.user_id).filter((id): id is string => Boolean(id))),
  ];

  let photoByUser = new Map<string, string | null>();
  if (userIds.length > 0) {
    const { data: detailsRows } = await supabase
      .from('user_profile_details')
      .select('profile_id, profile_photo_url')
      .in('profile_id', userIds);

    photoByUser = new Map(
      (detailsRows ?? []).map((d) => [d.profile_id, d.profile_photo_url]),
    );
  }

  return activeRows.map((row) => {
    const detailPhoto = row.user_id ? photoByUser.get(row.user_id) : null;
    const photo = row.profile_photo_url || detailPhoto || null;
    return {
      id: row.id,
      user_id: row.user_id,
      full_name: row.full_name,
      department_id: row.department_id ?? null,
      profile_photo_url: photo,
      photo_url: photo,
      job_position_name: jobPositionNameFromJoin(row),
    } satisfies OkrEmployeeDirectoryEntry;
  });
}

/** Lightweight employee list for OKR views (names + create-individual modal). */
export function useOkrActiveEmployees(organizationId?: string) {
  return useQuery({
    queryKey: ['okr-active-employees', organizationId],
    queryFn: () => fetchActiveOkrEmployees(organizationId!, false) as Promise<OkrActiveEmployee[]>,
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

/** Employee directory for individual OKR tab (avatar, department, position) — single batched fetch. */
export function useOkrEmployeeDirectory(organizationId?: string) {
  return useQuery({
    queryKey: ['okr-employee-directory', organizationId],
    queryFn: () =>
      fetchActiveOkrEmployees(organizationId!, true) as Promise<OkrEmployeeDirectoryEntry[]>,
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

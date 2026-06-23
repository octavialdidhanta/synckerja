import { supabase } from '@/shared/lib/supabaseClient';

export const CURRENT_EMPLOYEE_QUERY_KEY = 'current-employee';

export function joinRelationName(
  rel?: { name?: string } | { name?: string }[] | null,
): string | null {
  if (!rel) return null;
  if (Array.isArray(rel)) return rel[0]?.name ?? null;
  return rel.name ?? null;
}

export function statusNameFromEmployee(row: {
  employee_statuses?: { name?: string } | { name?: string }[] | null;
}): string {
  return String(joinRelationName(row.employee_statuses) || 'active').toLowerCase();
}

export function isEligibleCurrentEmployee(row: {
  pending_removal?: boolean | null;
  employee_statuses?: { name?: string } | { name?: string }[] | null;
}): boolean {
  const statusName = statusNameFromEmployee(row);
  return (statusName === 'active' || statusName === 'probation') && row.pending_removal !== true;
}

export async function fetchCurrentEmployee(userId: string, organizationId: string) {
  const { data, error } = await supabase
    .from('employees')
    .select(
      `
          *,
          departments(id, name),
          job_positions(id, name),
          job_levels(id, name),
          employee_statuses!left(name)
        `,
    )
    .eq('user_id', userId)
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('fetchCurrentEmployee: Error fetching employee:', error);
    return null;
  }

  return data;
}

export type CurrentEmployeeRecord = NonNullable<Awaited<ReturnType<typeof fetchCurrentEmployee>>>;

export type CurrentUserEmployeeView = CurrentEmployeeRecord & {
  department_name: string | null;
  job_position_name: string | null;
  profile_name: string;
  employee_statuses: { name: string } | null;
};

export function toCurrentUserEmployeeView(
  raw: CurrentEmployeeRecord,
  profileFullName?: string | null,
): CurrentUserEmployeeView | null {
  if (!isEligibleCurrentEmployee(raw)) {
    return null;
  }

  const statusName = joinRelationName(raw.employee_statuses);

  return {
    ...raw,
    department_name: joinRelationName(raw.departments),
    job_position_name: joinRelationName(raw.job_positions),
    profile_name: profileFullName || raw.full_name || 'User',
    employee_statuses: statusName ? { name: statusName } : null,
  };
}

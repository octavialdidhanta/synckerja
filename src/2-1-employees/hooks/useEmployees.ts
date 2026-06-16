import { useQuery } from '@tanstack/react-query';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { attendanceHRQueryDefaults } from '@/shared/lib/attendanceHRQueryDefaults';
import { supabase } from '@/shared/lib/supabaseClient';
import { pickHighestUserRoleFromRows } from '@/shared/lib/organizationRolePick';
import { batchNameLookupByIds } from '@/shared/hooks/employees/batchEmployeeLookups';

export type Employee = {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone?: string;
  mobile_phone?: string;
  photo_url?: string | null;
  profile_photo_url?: string | null;
  department_id?: string;
  job_position_id?: string;
  job_level_id?: string;
  branch_id?: string;
  employee_status_id?: string;
  status?: string;
  organization_id: string;
  created_at: string;
  updated_at: string;
  join_date?: string;
  employee_id?: string;
  // Additional fields from joins
  department_name?: string;
  job_position_name?: string;
  job_level_name?: string;
  branch_name?: string;
  employee_status_name?: string;
  employee_status_source?: 'employee_statuses' | 'employees.status' | 'unknown';
  is_organization_owner?: boolean;
  pending_removal?: boolean;
  pending_removal_reason?: string | null;
  pending_removal_date?: string | null;
  manager_id?: string | null;
  /** Resolved from current org employee list (same fetch). */
  manager_name?: string | null;
  /** Canonical `user_roles.role` for current org (highest privilege). */
  organization_role?: string | null;
};

export const useEmployees = () => {
  const { organizationId } = useCurrentOrg();

  return useQuery({
    queryKey: ['employees-optimized', organizationId],
    enabled: Boolean(organizationId),
    queryFn: async () => {
      if (!organizationId) return [];

      const { data: employees, error } = await supabase
        .from('employees')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching employees:', error);
        throw error;
      }

      const empList = employees ?? [];

      const [
        { data: organization },
        { data: orgRoleRows },
        departmentNames,
        jobPositionNames,
        jobLevelNames,
        branchNames,
        employeeStatusNames,
      ] = await Promise.all([
        supabase.from('organizations').select('user_id').eq('id', organizationId).single(),
        supabase.from('user_roles').select('user_id, role').eq('organization_id', organizationId),
        batchNameLookupByIds(
          'departments',
          empList.map((emp) => emp.department_id),
        ),
        batchNameLookupByIds(
          'job_positions',
          empList.map((emp) => emp.job_position_id),
        ),
        batchNameLookupByIds(
          'job_levels',
          empList.map((emp) => emp.job_level_id),
        ),
        batchNameLookupByIds(
          'branches',
          empList.map((emp) => emp.branch_id),
        ),
        batchNameLookupByIds(
          'employee_statuses',
          empList.map((emp) => emp.employee_status_id),
        ),
      ]);

      const rolesByUser = new Map<string, { role: string }[]>();
      for (const row of orgRoleRows ?? []) {
        if (!row.user_id) continue;
        const list = rolesByUser.get(row.user_id) ?? [];
        list.push({ role: row.role });
        rolesByUser.set(row.user_id, list);
      }

      const enrichedEmployees = empList.map((emp) => {
        const isOwner = emp.user_id && organization && emp.user_id === organization.user_id;
        const orgRoles = emp.user_id ? rolesByUser.get(emp.user_id) : undefined;
        const organization_role = orgRoles?.length ? pickHighestUserRoleFromRows(orgRoles) : null;

        const statusName = emp.employee_status_id
          ? employeeStatusNames.get(emp.employee_status_id) ?? null
          : null;
        const rawStatus = emp.status;
        const statusSource: Employee['employee_status_source'] = statusName
          ? 'employee_statuses'
          : rawStatus
            ? 'employees.status'
            : 'unknown';

        return {
          ...emp,
          is_organization_owner: isOwner,
          organization_role,
          department_name: emp.department_id
            ? departmentNames.get(emp.department_id) ?? null
            : null,
          job_position_name: emp.job_position_id
            ? jobPositionNames.get(emp.job_position_id) ?? null
            : null,
          job_level_name: emp.job_level_id ? jobLevelNames.get(emp.job_level_id) ?? null : null,
          branch_name: emp.branch_id ? branchNames.get(emp.branch_id) ?? null : null,
          employee_status_name: statusName,
          employee_status_source: statusSource,
          pending_removal: emp.pending_removal ?? false,
          pending_removal_reason: emp.pending_removal_reason || null,
          pending_removal_date: emp.pending_removal_date || null,
        } as Employee;
      });

      const byId = new Map(enrichedEmployees.map((e) => [e.id, e]));
      const withManagers = enrichedEmployees.map((emp) => ({
        ...emp,
        manager_name: emp.manager_id ? byId.get(emp.manager_id)?.full_name ?? null : null,
      }));

      const userIds = [
        ...new Set(withManagers.map((e) => e.user_id).filter((id): id is string => Boolean(id))),
      ];

      let withPhotos = withManagers;
      if (userIds.length > 0) {
        const { data: detailsRows } = await supabase
          .from('user_profile_details')
          .select('profile_id, profile_photo_url')
          .in('profile_id', userIds);

        const photoByUser = new Map(
          (detailsRows ?? []).map((d) => [d.profile_id, d.profile_photo_url]),
        );

        withPhotos = withManagers.map((emp) => {
          const detailPhoto = emp.user_id ? photoByUser.get(emp.user_id) : null;
          const merged = emp.profile_photo_url || detailPhoto || null;
          return {
            ...emp,
            profile_photo_url: merged,
            photo_url: merged,
          };
        });
      }

      return withPhotos;
    },
    ...attendanceHRQueryDefaults,
  });
};

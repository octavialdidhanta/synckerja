import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { Tables } from '@supabase/types';
import { getOptimizedCurrentOrganizationId } from './useOptimizedCurrentOrg';
import { devLog } from '@/2-1-employees/MyInfo/PersonalInformation/utils/devLogger';
import { pickHighestUserRoleFromRows } from '@/shared/lib/organizationRolePick';
import { batchNameLookupByIds } from './batchEmployeeLookups';

export type Employee = Tables<'employees'> & {
  department_name?: string;
  job_position_name?: string;
  job_level_name?: string;
  branch_name?: string;
  employee_status_name?: string;
  is_organization_owner?: boolean;
  /** Canonical `user_roles.role` for active org (highest privilege). */
  organization_role?: string | null;
};

export const useEmployees = () => {
  return useQuery({
    queryKey: ['employees-optimized'],
    queryFn: async () => {
      devLog.log('Fetching employees with optimized queries...');

      const { organizationId } = await getOptimizedCurrentOrganizationId();
      devLog.log('Current organization ID:', organizationId);

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
          employee_status_name: emp.employee_status_id
            ? employeeStatusNames.get(emp.employee_status_id) ?? emp.status ?? null
            : emp.status ?? null,
        };
      });

      const userIds = [
        ...new Set(
          enrichedEmployees.map((e) => e.user_id).filter((id): id is string => Boolean(id)),
        ),
      ];

      let withPhotos = enrichedEmployees;
      if (userIds.length > 0) {
        const { data: detailsRows } = await supabase
          .from('user_profile_details')
          .select('profile_id, profile_photo_url')
          .in('profile_id', userIds);

        const photoByUser = new Map(
          (detailsRows ?? []).map((d) => [d.profile_id, d.profile_photo_url]),
        );

        withPhotos = enrichedEmployees.map((emp) => {
          const detailPhoto = emp.user_id ? photoByUser.get(emp.user_id) : null;
          const merged = emp.profile_photo_url || detailPhoto || null;
          return { ...emp, profile_photo_url: merged };
        });
      }

      devLog.log('Optimized employees fetched:', withPhotos.length);
      return withPhotos;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes for employee data
    gcTime: 20 * 60 * 1000, // 20 minutes cache
  });
};

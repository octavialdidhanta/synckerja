
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { Tables } from '@supabase/types';
import { getOptimizedCurrentOrganizationId } from './useOptimizedCurrentOrg';
import { devLog } from '@/2-1-employees/MyInfo/PersonalInformation/utils/devLogger';
import { pickHighestUserRoleFromRows } from '@/shared/lib/organizationRolePick';

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

      // First get employees without JOINs to avoid relation errors
      const { data: employees, error } = await supabase
        .from('employees')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching employees:', error);
        throw error;
      }

      // Get organization data once for ownership check
      const { data: organization } = await supabase
        .from('organizations')
        .select('user_id')
        .eq('id', organizationId)
        .single();

      const { data: orgRoleRows } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .eq('organization_id', organizationId);

      const rolesByUser = new Map<string, { role: string }[]>();
      for (const row of orgRoleRows ?? []) {
        if (!row.user_id) continue;
        const list = rolesByUser.get(row.user_id) ?? [];
        list.push({ role: row.role });
        rolesByUser.set(row.user_id, list);
      }

      // Get related data separately for each employee
      const enrichedEmployees = await Promise.all(
        (employees || []).map(async (emp) => {
          const isOwner = emp.user_id && organization && emp.user_id === organization.user_id;
          const orgRoles = emp.user_id ? rolesByUser.get(emp.user_id) : undefined;
          const organization_role = orgRoles?.length
            ? pickHighestUserRoleFromRows(orgRoles)
            : null;
          
          // Get related data separately to avoid JOIN issues
          const [departmentData, jobPositionData, jobLevelData, branchData, employeeStatusData] = await Promise.all([
            emp.department_id ? supabase.from('departments').select('name').eq('id', emp.department_id).maybeSingle() : Promise.resolve({ data: null }),
            emp.job_position_id ? supabase.from('job_positions').select('name').eq('id', emp.job_position_id).maybeSingle() : Promise.resolve({ data: null }),
            emp.job_level_id ? supabase.from('job_levels').select('name').eq('id', emp.job_level_id).maybeSingle() : Promise.resolve({ data: null }),
            emp.branch_id ? supabase.from('branches').select('name').eq('id', emp.branch_id).maybeSingle() : Promise.resolve({ data: null }),
            emp.employee_status_id ? supabase.from('employee_statuses').select('name').eq('id', emp.employee_status_id).maybeSingle() : Promise.resolve({ data: null })
          ]);
          
          devLog.log(`Employee ${emp.full_name}: department_id=${emp.department_id}, department_name=${departmentData.data?.name}`);
          
          return {
            ...emp,
            is_organization_owner: isOwner,
            organization_role,
            // Use consistent naming and proper fallbacks
            department_name: departmentData.data?.name || null,
            job_position_name: jobPositionData.data?.name || null,
            job_level_name: jobLevelData.data?.name || null,
            branch_name: branchData.data?.name || null,
            employee_status_name: employeeStatusData.data?.name || emp.status || null,
          };
        })
      );

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

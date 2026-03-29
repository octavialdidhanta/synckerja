import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { logger } from '@/shared/lib/logger';
import { isEmployeeActive } from '@/2-1-employees/utils/employeeUtils';

const isDev = import.meta.env.DEV;

export interface AvailableEmployee {
  id: string;
  full_name: string;
  email: string;
  /** @deprecated legacy field, no longer used as source of truth */
  status?: string | null;
  employee_status_id?: string | null;
  employee_status_name?: string | null;
  pending_removal?: boolean | null;
}

export const useAvailableEmployees = () => {
  const { organizationId } = useCurrentOrg();

  // Bump segment when assignable-employee rules change so stale cached lists (e.g. old strict "active" name filter) refetch.
  return useQuery({
    queryKey: ['available-employees', 'v2-inclusive-status', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      if (isDev) {
        logger.query('Fetching available employees for organization:', organizationId);
      }

      const { data, error } = await supabase
        .from('employees')
        .select('id, full_name, email, employee_status_id, pending_removal')
        .eq('organization_id', organizationId)
        .order('full_name');

      if (error) {
        console.error('Error fetching employees:', error);
        throw error;
      }

      const statusIds = Array.from(
        new Set((data || []).map((emp) => emp.employee_status_id).filter(Boolean))
      ) as string[];

      let statusNameById = new Map<string, string>();
      if (statusIds.length > 0) {
        const { data: statuses, error: statusesError } = await supabase
          .from('employee_statuses')
          .select('id, name')
          .in('id', statusIds);

        if (statusesError) {
          console.error('Error fetching employee statuses:', statusesError);
          throw statusesError;
        }

        statusNameById = new Map((statuses || []).map((status) => [status.id, status.name]));
      }

      const activeEmployees = ((data || []) as AvailableEmployee[])
        .map((emp) => ({
          ...emp,
          employee_status_name: emp.employee_status_id ? statusNameById.get(emp.employee_status_id) || null : null
        }))
        .filter((emp) => isEmployeeActive(emp));

      if (isDev) {
        logger.query('Available employees fetched:', activeEmployees.length, activeEmployees);
      }
      return activeEmployees;
    },
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};






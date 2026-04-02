import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { isEmployeeActive } from '@/2-1-employees/utils/employeeUtils';

/**
 * Returns a Set of employee IDs that are active (not resigned, terminated, inactive, pending removal).
 * Use when building PIC/task view dropdowns so resigned employees are excluded.
 */
export function useActiveEmployeeIds(): Set<string> {
  const { organizationId } = useCurrentOrg();

  const { data: activeIds = new Set<string>() } = useQuery({
    queryKey: ['active-employee-ids', organizationId],
    queryFn: async () => {
      if (!organizationId) return new Set<string>();

      const { data: employees, error: empError } = await supabase
        .from('employees')
        .select('id, employee_status_id, pending_removal')
        .eq('organization_id', organizationId);

      if (empError) throw empError;

      const statusIds = [...new Set((employees || []).map((e: any) => e.employee_status_id).filter(Boolean))];
      const statusNameById = new Map<string, string>();

      if (statusIds.length > 0) {
        const { data: statuses } = await supabase
          .from('employee_statuses')
          .select('id, name')
          .in('id', statusIds);
        (statuses || []).forEach((s: any) => statusNameById.set(s.id, s.name || ''));
      }

      const ids = new Set<string>();
      (employees || []).forEach((emp: any) => {
        const statusName = emp.employee_status_id ? statusNameById.get(emp.employee_status_id) : null;
        if (
          isEmployeeActive({
            employee_status_name: statusName,
            status: null,
            pending_removal: emp.pending_removal,
          })
        ) {
          ids.add(emp.id);
        }
      });
      return ids;
    },
    enabled: !!organizationId,
  });

  return activeIds;
}

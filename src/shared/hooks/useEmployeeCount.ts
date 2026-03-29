import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from './useCurrentOrg';

export const useEmployeeCount = () => {
  const { organizationId } = useCurrentOrg();

  return useQuery({
    queryKey: ['employee-count', organizationId],
    queryFn: async () => {
      if (!organizationId) return 0;
      
      const { data, error } = await supabase
        .from('employees')
        .select('id, employee_status_id, pending_removal')
        .eq('organization_id', organizationId);

      if (error) {
        console.error('Error fetching employee count:', error);
        throw error;
      }
      const statusIds = Array.from(
        new Set((data ?? []).map((e: any) => e.employee_status_id).filter(Boolean))
      ) as string[];
      let activeStatusIds = new Set<string>();
      if (statusIds.length > 0) {
        const { data: statusRows } = await supabase
          .from('employee_statuses')
          .select('id, name')
          .in('id', statusIds);
        activeStatusIds = new Set(
          (statusRows ?? [])
            .filter((s: any) => ['active', 'probation'].includes(String(s.name || '').toLowerCase()))
            .map((s: any) => s.id)
        );
      }
      return (data ?? []).filter((e: any) => {
        if (e.pending_removal === true) return false;
        if (!e.employee_status_id) return true;
        return activeStatusIds.has(e.employee_status_id);
      }).length;
    },
    enabled: !!organizationId,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 2 * 60 * 1000, // 2 minutes
  });
};
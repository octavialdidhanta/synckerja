import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';

export const useAttendancePenaltyTotal = (employeeId?: string, month?: number, year?: number) => {
  const { organizationId } = useCurrentOrg();

  return useQuery({
    queryKey: ['attendance-penalty-total', organizationId, employeeId, month, year],
    queryFn: async () => {
      if (!organizationId) return 0;

      let query = supabase
        .from('attendance_penalties')
        .select('penalty_amount')
        .eq('organization_id', organizationId);

      // Filter by employee if provided
      if (employeeId) {
        query = query.eq('employee_id', employeeId);
      }

      // Filter by month and year if provided
      if (month !== undefined && year !== undefined) {
        const startDate = new Date(year, month, 1).toISOString().split('T')[0];
        const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];
        query = query.gte('applied_date', startDate).lte('applied_date', endDate);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching penalty total:', error);
        return 0;
      }

      // Sum all penalty amounts
      return data?.reduce((total, penalty) => total + (penalty.penalty_amount || 0), 0) || 0;
    },
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};



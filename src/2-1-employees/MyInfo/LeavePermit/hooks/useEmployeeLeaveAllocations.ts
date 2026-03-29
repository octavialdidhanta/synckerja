import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';

export interface LeaveAllocationData {
  id: string;
  employee_id: string;
  allocation_type: string;
  allocation_reason: string;
  days_allocated: number;
  allocation_date: string;
  expires_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const useEmployeeLeaveAllocations = (employeeId: string) => {
  return useQuery({
    queryKey: ['employee-leave-allocations', employeeId],
    queryFn: async () => {
      console.log('🔍 Fetching leave allocations for employee:', employeeId);
      
      const { data, error } = await supabase
        .from('leave_allocations')
        .select('*')
        .eq('employee_id', employeeId)
        .order('allocation_date', { ascending: false });

      if (error) {
        console.error('❌ Error fetching leave allocations:', error);
        throw error;
      }

      console.log('✅ Leave allocations fetched:', data?.length || 0);
      return data as LeaveAllocationData[];
    },
    enabled: !!employeeId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

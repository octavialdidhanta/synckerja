
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';

export interface EmployeeLeaveRequestData {
  id: string;
  employee_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string;
  emergency_contact: string;
  work_handover: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;
  created_at: string;
  updated_at: string;
  employees?: {
    full_name: string;
    email: string;
    employee_id: string;
    departments?: {
      name: string;
    };
  };
}

interface UseEmployeeLeaveRequestsProps {
  employeeId: string;
  status?: string;
  year?: number;
}

export const useEmployeeLeaveRequests = ({ employeeId, status, year }: UseEmployeeLeaveRequestsProps) => {
  return useQuery({
    queryKey: ['employee-leave-requests', employeeId, status, year],
    queryFn: async () => {
      console.log('🔍 Fetching employee leave requests:', { employeeId, status, year });
      
      let query = supabase
        .from('leave_requests')
        .select(`
          *,
          employees!inner (
            full_name,
            email,
            employee_id,
            departments (
              name
            )
          )
        `)
        .eq('employee_id', employeeId)
        .order('created_at', { ascending: false });

      // Filter by status if provided
      if (status && status !== 'all') {
        query = query.eq('status', status);
      }

      // Filter by year if provided
      if (year) {
        const startDate = new Date(year, 0, 1).toISOString().split('T')[0];
        const endDate = new Date(year, 11, 31).toISOString().split('T')[0];
        query = query
          .gte('start_date', startDate)
          .lte('start_date', endDate);
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ Error fetching employee leave requests:', error);
        throw error;
      }

      console.log('✅ Employee leave requests fetched:', data?.length || 0);
      return data as EmployeeLeaveRequestData[];
    },
    enabled: !!employeeId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

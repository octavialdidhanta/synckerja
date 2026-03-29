import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useToast } from '@/shared/components/ui/use-toast';
import { useCurrentEmployee } from '@/shared/hooks/useCurrentEmployee';

export interface LeaveRequestInput {
  leaveType: string;
  startDate: Date;
  endDate: Date;
  reason: string;
  emergencyContact: string;
  workHandover: string;
}

export const useLeaveRequest = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: employeeData } = useCurrentEmployee();

  const createLeaveRequest = useMutation({
    mutationFn: async (data: LeaveRequestInput) => {
      if (!employeeData || !(employeeData as any).id) {
        throw new Error('No employee found');
      }

      // Calculate total days
      const diffTime = Math.abs(data.endDate.getTime() - data.startDate.getTime());
      const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

      const leaveRequestData = {
        employee_id: (employeeData as any).id,
        leave_type: data.leaveType,
        start_date: data.startDate.toISOString().split('T')[0],
        end_date: data.endDate.toISOString().split('T')[0],
        total_days: totalDays,
        reason: data.reason,
        emergency_contact: data.emergencyContact,
        work_handover: data.workHandover,
        status: 'pending' as const
      };

      console.log('🚀 Creating leave request:', leaveRequestData);

      const { data: result, error } = await supabase
        .from('leave_requests')
        .insert(leaveRequestData as any)
        .select()
        .single();

      if (error) {
        console.error('❌ Error creating leave request:', error);
        throw error;
      }

      console.log('✅ Leave request created successfully:', result);
      return result;
    },
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      queryClient.invalidateQueries({ queryKey: ['employee-leave-requests'] });
      queryClient.invalidateQueries({ queryKey: ['employee-leave-balance'] });
      
      toast({
        title: 'Berhasil',
        description: 'Pengajuan cuti berhasil dikirim',
      });
    },
    onError: (error: Error) => {
      console.error('❌ Error in leave request creation:', error);
      toast({
        title: 'Error',
        description: error.message || 'Gagal mengirim pengajuan cuti',
        variant: 'destructive',
      });
    },
  });

  return {
    createLeaveRequest: createLeaveRequest.mutate,
    isLoading: createLeaveRequest.isPending,
  };
};

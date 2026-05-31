import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useToast } from '@/shared/components/ui/use-toast';
import { useCurrentEmployee } from '@/shared/hooks/useCurrentEmployee';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { calculateLeaveRequestDays } from '@/shared/leave/leaveRequestCalculations';
import type { LeaveRequestFormData } from '@/shared/leave/leaveRequestSchema';

export type LeaveRequestInput = LeaveRequestFormData;

export const useLeaveRequest = () => {
  const { toast } = useToast();
  const { t } = useAppTranslation();
  const queryClient = useQueryClient();
  const { data: employeeData } = useCurrentEmployee();

  const createLeaveRequest = useMutation({
    mutationFn: async (data: LeaveRequestInput) => {
      if (!employeeData?.id) {
        throw new Error(t('leaveRequest.toast.noEmployee', 'No employee found'));
      }

      const totalDays = calculateLeaveRequestDays(data.startDate, data.endDate);

      const leaveRequestData = {
        employee_id: employeeData.id,
        leave_type: data.leaveType,
        start_date: data.startDate.toISOString().split('T')[0],
        end_date: data.endDate.toISOString().split('T')[0],
        total_days: totalDays,
        reason: data.reason,
        emergency_contact: data.emergencyContact,
        work_handover: data.workHandover,
        status: 'pending' as const,
      };

      const { data: result, error } = await supabase
        .from('leave_requests')
        .insert(leaveRequestData as never)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      queryClient.invalidateQueries({ queryKey: ['employee-leave-requests'] });
      queryClient.invalidateQueries({ queryKey: ['employee-leave-balance'] });
      queryClient.invalidateQueries({ queryKey: ['employeeLeaveEligibility'] });

      toast({
        title: t('leaveRequest.toast.successTitle', 'Success'),
        description: t('leaveRequest.toast.successDesc', 'Leave request submitted successfully'),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('leaveRequest.toast.errorTitle', 'Error'),
        description: error.message || t('leaveRequest.toast.errorDesc', 'Failed to submit leave request'),
        variant: 'destructive',
      });
    },
  });

  return {
    createLeaveRequest: createLeaveRequest.mutateAsync,
    isLoading: createLeaveRequest.isPending,
  };
};

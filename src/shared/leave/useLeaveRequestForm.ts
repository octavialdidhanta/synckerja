import { useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { useCurrentEmployee } from '@/shared/hooks/useCurrentEmployee';
import { useLeaveRequest } from '@/1-home/hooks/useLeaveRequest';
import { useEmployeeLeaveEligibility } from '@/1-home/hooks/useEmployeeLeaveEligibility';
import { createLeaveRequestSchema, type LeaveRequestFormData } from '@/shared/leave/leaveRequestSchema';
import {
  calculateLeaveRequestDays,
  getLeaveRequestSubmitState,
} from '@/shared/leave/leaveRequestCalculations';
import { getLeaveTypeOptions } from '@/shared/leave/leaveRequestTypes';

interface UseLeaveRequestFormOptions {
  onSuccess?: (data: LeaveRequestFormData) => void;
}

export function useLeaveRequestForm(options: UseLeaveRequestFormOptions = {}) {
  const { onSuccess } = options;
  const { t } = useAppTranslation();
  const { data: employeeData, isLoading: employeeLoading } = useCurrentEmployee();
  const { createLeaveRequest, isLoading: isSubmitting } = useLeaveRequest();
  const { data: eligibility, isLoading: eligibilityLoading } = useEmployeeLeaveEligibility();

  const leaveRequestSchema = useMemo(() => createLeaveRequestSchema(t), [t]);
  const leaveTypes = useMemo(() => getLeaveTypeOptions(t), [t]);

  const form = useForm<LeaveRequestFormData>({
    resolver: zodResolver(leaveRequestSchema),
    defaultValues: {
      leaveType: '',
      reason: '',
      emergencyContact: '',
      workHandover: '',
    },
  });

  const startDate = form.watch('startDate');
  const endDate = form.watch('endDate');
  const requestedDays = calculateLeaveRequestDays(startDate, endDate);
  const { remainingAfterRequest, isEligibleForRequest } = getLeaveRequestSubmitState(
    eligibility,
    requestedDays,
  );

  const resetForm = useCallback(() => {
    form.reset({
      leaveType: '',
      reason: '',
      emergencyContact: '',
      workHandover: '',
    });
  }, [form]);

  const handleSubmit = form.handleSubmit(async (data) => {
    await createLeaveRequest(data);
    resetForm();
    onSuccess?.(data);
  });

  return {
    form,
    leaveTypes,
    employeeData,
    employeeLoading,
    eligibility,
    eligibilityLoading,
    requestedDays,
    remainingAfterRequest,
    isEligibleForRequest,
    handleSubmit,
    isSubmitting,
    resetForm,
  };
}

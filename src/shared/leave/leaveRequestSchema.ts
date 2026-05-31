import * as z from 'zod';

type TranslateFn = (key: string, fallback?: string) => string;

export function createLeaveRequestSchema(t: TranslateFn) {
  return z
    .object({
      leaveType: z
        .string()
        .min(1, t('leaveRequest.validation.leaveTypeRequired', 'Leave type must be selected')),
      startDate: z.date({
        required_error: t('leaveRequest.validation.startDateRequired', 'Start date must be filled'),
      }),
      endDate: z.date({
        required_error: t('leaveRequest.validation.endDateRequired', 'End date must be filled'),
      }),
      reason: z
        .string()
        .min(10, t('leaveRequest.validation.reasonMinLength', 'Leave reason must be at least 10 characters')),
      emergencyContact: z
        .string()
        .min(5, t('leaveRequest.validation.emergencyContactRequired', 'Emergency contact must be filled')),
      workHandover: z
        .string()
        .min(
          10,
          t('leaveRequest.validation.workHandoverMinLength', 'Work handover must be at least 10 characters'),
        ),
    })
    .refine((data) => data.endDate >= data.startDate, {
      message: t('leaveRequest.validation.endDateBeforeStart', 'End date cannot be earlier than start date'),
      path: ['endDate'],
    });
}

export type LeaveRequestFormData = z.infer<ReturnType<typeof createLeaveRequestSchema>>;

type TranslateFn = (key: string, fallback?: string) => string;

export type LeaveTypeOption = {
  value: string;
  label: string;
};

export function getLeaveTypeOptions(t: TranslateFn): LeaveTypeOption[] {
  return [
    { value: 'annual', label: t('leaveRequest.leaveType.annual', 'Annual Leave') },
    { value: 'sick', label: t('leaveRequest.leaveType.sick', 'Sick Leave') },
    { value: 'maternity', label: t('leaveRequest.leaveType.maternity', 'Maternity Leave') },
    { value: 'paternity', label: t('leaveRequest.leaveType.paternity', 'Paternity Leave') },
    { value: 'personal', label: t('leaveRequest.leaveType.personal', 'Personal Leave') },
    { value: 'emergency', label: t('leaveRequest.leaveType.emergency', 'Emergency Leave') },
    { value: 'unpaid', label: t('leaveRequest.leaveType.unpaid', 'Unpaid Leave') },
  ];
}

export function formatLeaveTypeLabel(leaveType: string, t: TranslateFn): string {
  const option = getLeaveTypeOptions(t).find((item) => item.value === leaveType);
  return option?.label ?? leaveType;
}

export function formatLeaveRequestStatusLabel(status: string, t: TranslateFn): string {
  const keyMap: Record<string, string> = {
    pending: 'leaveHistory.pending',
    approved: 'leaveHistory.approved',
    rejected: 'leaveHistory.rejected',
    cancelled: 'leaveHistory.cancelled',
  };

  const fallbacks: Record<string, string> = {
    pending: 'Pending',
    approved: 'Approved',
    rejected: 'Rejected',
    cancelled: 'Cancelled',
  };

  const key = keyMap[status];
  return key ? t(key, fallbacks[status]) : status;
}

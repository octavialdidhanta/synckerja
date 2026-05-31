import type { LeaveEligibility } from '@/1-home/hooks/useEmployeeLeaveEligibility';

export function calculateLeaveRequestDays(startDate?: Date, endDate?: Date): number {
  if (!startDate || !endDate) return 0;

  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

export function getLeaveRequestSubmitState(
  eligibility: LeaveEligibility | null | undefined,
  requestedDays: number,
): { remainingAfterRequest: number; isEligibleForRequest: boolean } {
  const remainingAfterRequest = eligibility ? eligibility.remainingDays - requestedDays : 0;
  const isEligibleForRequest = Boolean(
    eligibility?.isEligible && requestedDays > 0 && remainingAfterRequest >= 0,
  );

  return { remainingAfterRequest, isEligibleForRequest };
}

/** ISO date string (YYYY-MM-DD) for native date inputs — local calendar day. */
export function toIsoDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayIsoDateString(): string {
  return toIsoDateString(new Date());
}

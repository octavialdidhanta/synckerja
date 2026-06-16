export const payrollCalculationsQueryKey = (
  organizationId?: string | null,
  selectedPayrollRunId?: string | null,
) => ["payroll-calculations", organizationId, selectedPayrollRunId ?? null] as const;

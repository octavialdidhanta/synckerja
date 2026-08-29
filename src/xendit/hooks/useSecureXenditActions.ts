import { useCallback } from "react";
import { useMfaStepUp } from "@/shared/auth/mfa";
import {
  enableXenditForOrg,
  executeXenditDisbursement,
  executeXenditGatewayWithdrawal,
  retryPayrollEscrowTransfer,
  setPrimaryXenditSubAccount,
  submitXenditKycAndCreate,
  updatePayrollEscrowSettings,
  updatePayrollExpenseSettings,
  validateGatewayPayoutBank,
  type SubmitXenditKycAndCreateInput,
} from "@/xendit/lib/xenditApi";

/** Xendit mutations that require MFA step-up (AAL2). */
export function useSecureXenditActions() {
  const { ensureAal2 } = useMfaStepUp();

  const secureEnableXendit = useCallback(
    (organizationId: string, enabled: boolean) =>
      enableXenditForOrg(organizationId, enabled, ensureAal2),
    [ensureAal2],
  );

  const secureDisbursement = useCallback(
    (organizationId: string, payload: Record<string, unknown>) =>
      executeXenditDisbursement(organizationId, payload, ensureAal2),
    [ensureAal2],
  );

  const secureGatewayWithdrawal = useCallback(
    (organizationId: string, amount: number) =>
      executeXenditGatewayWithdrawal(organizationId, amount, ensureAal2),
    [ensureAal2],
  );

  const secureSetPrimarySubAccount = useCallback(
    (organizationId: string, subAccountRowId: string) =>
      setPrimaryXenditSubAccount(organizationId, subAccountRowId, ensureAal2),
    [ensureAal2],
  );

  const secureValidatePayoutBank = useCallback(
    (
      organizationId: string,
      payload: Parameters<typeof validateGatewayPayoutBank>[1],
    ) => validateGatewayPayoutBank(organizationId, payload, ensureAal2),
    [ensureAal2],
  );

  const secureSubmitKyc = useCallback(
    (input: SubmitXenditKycAndCreateInput) => submitXenditKycAndCreate(input, ensureAal2),
    [ensureAal2],
  );

  const secureUpdatePayrollEscrowSettings = useCallback(
    (
      organizationId: string,
      payload: Parameters<typeof updatePayrollEscrowSettings>[1],
    ) => updatePayrollEscrowSettings(organizationId, payload, ensureAal2),
    [ensureAal2],
  );

  const secureRetryPayrollEscrowTransfer = useCallback(
    (organizationId: string, payrollRunId: string) =>
      retryPayrollEscrowTransfer(organizationId, payrollRunId, ensureAal2),
    [ensureAal2],
  );

  const secureUpdatePayrollExpenseSettings = useCallback(
    (
      organizationId: string,
      payload: Parameters<typeof updatePayrollExpenseSettings>[1],
    ) => updatePayrollExpenseSettings(organizationId, payload, ensureAal2),
    [ensureAal2],
  );

  return {
    ensureAal2,
    secureEnableXendit,
    secureDisbursement,
    secureGatewayWithdrawal,
    secureSetPrimarySubAccount,
    secureValidatePayoutBank,
    secureSubmitKyc,
    secureUpdatePayrollEscrowSettings,
    secureRetryPayrollEscrowTransfer,
    secureUpdatePayrollExpenseSettings,
  };
}

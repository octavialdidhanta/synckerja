import { supabase } from "@/shared/lib/supabaseClient";
import { parseEdgeFunctionError } from "@/tiktok-ads/lib/parseEdgeFunctionError";

export class MfaRequiredError extends Error {
  code = "MFA_REQUIRED" as const;
  constructor(message = "Two-factor authentication required") {
    super(message);
    this.name = "MfaRequiredError";
  }
}

export function isMfaRequiredError(error: unknown): boolean {
  if (error instanceof MfaRequiredError) return true;
  const err = error as { code?: string; message?: string };
  return err?.code === "MFA_REQUIRED" || /two-factor authentication required/i.test(err?.message ?? "");
}

export async function invokeXenditApi<T extends Record<string, unknown>>(
  payload: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke("xendit-api", { body: payload });
  if (error) {
    const parsed = await parseEdgeFunctionError(error, data);
    if (isMfaRequiredError(parsed)) throw new MfaRequiredError(parsed.message);
    throw parsed;
  }
  const body = data as T & { error?: string; code?: string };
  if (body && "error" in body && body.error) {
    const parsed = await parseEdgeFunctionError(null, body);
    if (isMfaRequiredError(parsed) || body.code === "MFA_REQUIRED") {
      throw new MfaRequiredError(body.error);
    }
    throw parsed;
  }
  return body as T;
}

/** Invoke Xendit API after MFA step-up; retries once if server returns MFA_REQUIRED. */
export async function invokeXenditApiWithMfaStepUp<T extends Record<string, unknown>>(
  payload: Record<string, unknown>,
  ensureAal2: () => Promise<boolean>,
): Promise<T> {
  if (!(await ensureAal2())) {
    throw new MfaRequiredError("MFA step-up cancelled");
  }
  try {
    return await invokeXenditApi<T>(payload);
  } catch (e) {
    if (isMfaRequiredError(e) && (await ensureAal2())) {
      return await invokeXenditApi<T>(payload);
    }
    throw e;
  }
}

import type {
  OrganizationKycDocument,
  RequestSubAccountResponse,
  XenditSettingsResponse,
  XenditSubAccountRow,
} from "@/xendit/types/xendit";

export async function fetchXenditSettings(organizationId: string) {
  return invokeXenditApi<XenditSettingsResponse>({
    action: "getSettings",
    organization_id: organizationId,
  });
}

export async function verifyXenditConnection(organizationId: string) {
  return invokeXenditApi<{
    ok: boolean;
    keyKind: string;
    isSandbox: boolean;
    balance: { ok: boolean; status: number; message: string };
    xenPlatform: { ok: boolean; status: number; message: string };
    summary: string;
  }>({ action: "verifyCredentials", organization_id: organizationId });
}

export async function enableXenditForOrg(
  organizationId: string,
  enabled: boolean,
  ensureAal2?: () => Promise<boolean>,
) {
  const body = {
    action: "enableXendit",
    organization_id: organizationId,
    enabled,
  };
  if (ensureAal2) {
    return invokeXenditApiWithMfaStepUp<{ ok: boolean; enabled: boolean }>(body, ensureAal2);
  }
  return invokeXenditApi<{ ok: boolean; enabled: boolean }>(body);
}

export type CreateXenditSubAccountInput = {
  organizationId: string;
  businessName: string;
  email: string;
  type?: "OWNED" | "MANAGED";
  linkedBankAccountId?: string | null;
  payoutBankCode: string;
  payoutAccountNumber: string;
  payoutAccountHolderName: string;
};

export async function createXenditSubAccount(input: CreateXenditSubAccountInput) {
  return invokeXenditApi<{ ok: boolean; sub_account_id: string; account: XenditSubAccountRow }>({
    action: "createTenantSubAccount",
    organization_id: input.organizationId,
    business_name: input.businessName,
    email: input.email,
    type: input.type,
    linked_bank_account_id: input.linkedBankAccountId ?? null,
    payout_bank_code: input.payoutBankCode,
    payout_account_number: input.payoutAccountNumber,
    payout_account_holder_name: input.payoutAccountHolderName,
  });
}

export async function requestXenditSubAccount(organizationId: string) {
  return invokeXenditApi<RequestSubAccountResponse & { ok: boolean }>({
    action: "requestSubAccount",
    organization_id: organizationId,
  });
}

export type SubmitXenditKycAndCreateInput = {
  organizationId: string;
  businessName: string;
  email: string;
  linkedBankAccountId?: string | null;
  payoutBankCode: string;
  payoutAccountNumber: string;
  payoutAccountHolderName: string;
  businessType: "individual" | "company";
  entitySubtype?: string | null;
  legalName: string;
  identityNumber?: string;
  npwp?: string;
  nib?: string;
  directorNpwp?: string;
  ktpStoragePath: string;
  nibStoragePath?: string;
  npwpStoragePath?: string;
  directorNpwpStoragePath?: string;
  aktaStoragePath?: string;
  skMenkehStoragePath?: string;
  entityExtraDocuments?: Record<string, string>;
  serviceAgreementStoragePath: string;
  businessAddress?: Record<string, string>;
  businessWebsite?: string;
  proofOfBusinessStoragePath?: string;
};

export async function submitXenditKycAndCreate(
  input: SubmitXenditKycAndCreateInput,
  ensureAal2?: () => Promise<boolean>,
) {
  const body = {
    action: "submitKycAndCreate",
    organization_id: input.organizationId,
    business_name: input.businessName,
    email: input.email,
    linked_bank_account_id: input.linkedBankAccountId ?? null,
    payout_bank_code: input.payoutBankCode,
    payout_account_number: input.payoutAccountNumber,
    payout_account_holder_name: input.payoutAccountHolderName,
    business_type: input.businessType,
    entity_subtype: input.entitySubtype ?? null,
    legal_name: input.legalName,
    identity_number: input.identityNumber ?? null,
    npwp: input.npwp ?? null,
    nib: input.nib ?? null,
    director_npwp: input.directorNpwp ?? null,
    ktp_storage_path: input.ktpStoragePath,
    nib_storage_path: input.nibStoragePath ?? null,
    npwp_storage_path: input.npwpStoragePath ?? null,
    director_npwp_storage_path: input.directorNpwpStoragePath ?? null,
    akta_storage_path: input.aktaStoragePath ?? null,
    sk_menkeh_storage_path: input.skMenkehStoragePath ?? null,
    entity_extra_documents: input.entityExtraDocuments ?? null,
    service_agreement_storage_path: input.serviceAgreementStoragePath,
    business_address: input.businessAddress ?? null,
    business_website: input.businessWebsite ?? null,
    proof_of_business_storage_path: input.proofOfBusinessStoragePath ?? null,
  };
  if (ensureAal2) {
    return invokeXenditApiWithMfaStepUp<{
      ok: boolean;
      sub_account_id: string;
      sub_account_row: XenditSubAccountRow;
      kyc: OrganizationKycDocument;
      document_upload_ok: boolean;
      document_upload_error?: string;
    }>(body, ensureAal2);
  }
  return invokeXenditApi<{
    ok: boolean;
    sub_account_id: string;
    sub_account_row: XenditSubAccountRow;
    kyc: OrganizationKycDocument;
    document_upload_ok: boolean;
    document_upload_error?: string;
  }>(body);
}

export type UpdateXenditKycAndRetryInput = {
  organizationId: string;
  subAccountRowId: string;
  businessType?: "individual" | "company";
  entitySubtype?: string | null;
  legalName?: string;
  identityNumber?: string;
  npwp?: string;
  nib?: string;
  directorNpwp?: string;
  ktpStoragePath?: string;
  nibStoragePath?: string;
  npwpStoragePath?: string;
  directorNpwpStoragePath?: string;
  aktaStoragePath?: string;
  skMenkehStoragePath?: string;
  entityExtraDocuments?: Record<string, string>;
  serviceAgreementStoragePath?: string;
  businessAddress?: Record<string, string>;
  businessWebsite?: string;
  proofOfBusinessStoragePath?: string;
};

export async function updateXenditKycAndRetryDocuments(input: UpdateXenditKycAndRetryInput) {
  return invokeXenditApi<{
    ok: boolean;
    row: XenditSubAccountRow;
    kyc: OrganizationKycDocument;
    document_upload_ok: boolean;
    document_upload_error?: string;
  }>({
    action: "updateKycAndRetryDocuments",
    organization_id: input.organizationId,
    sub_account_row_id: input.subAccountRowId,
    business_type: input.businessType,
    entity_subtype: input.entitySubtype,
    legal_name: input.legalName,
    identity_number: input.identityNumber,
    npwp: input.npwp,
    nib: input.nib,
    director_npwp: input.directorNpwp,
    ktp_storage_path: input.ktpStoragePath,
    nib_storage_path: input.nibStoragePath,
    npwp_storage_path: input.npwpStoragePath,
    director_npwp_storage_path: input.directorNpwpStoragePath,
    akta_storage_path: input.aktaStoragePath,
    sk_menkeh_storage_path: input.skMenkehStoragePath,
    entity_extra_documents: input.entityExtraDocuments,
    service_agreement_storage_path: input.serviceAgreementStoragePath,
    business_address: input.businessAddress,
    business_website: input.businessWebsite,
    proof_of_business_storage_path: input.proofOfBusinessStoragePath,
  });
}

export async function retryXenditSubAccountDocuments(
  organizationId: string,
  subAccountRowId: string,
) {
  return invokeXenditApi<{ ok: boolean; row: XenditSubAccountRow; error?: string }>({
    action: "retrySubAccountDocuments",
    organization_id: organizationId,
    sub_account_row_id: subAccountRowId,
  });
}

export async function setPrimaryXenditSubAccount(
  organizationId: string,
  subAccountRowId: string,
  ensureAal2?: () => Promise<boolean>,
) {
  const body = {
    action: "setPrimarySubAccount",
    organization_id: organizationId,
    sub_account_row_id: subAccountRowId,
  };
  if (ensureAal2) {
    return invokeXenditApiWithMfaStepUp<{ ok: boolean; sub_account: XenditSubAccountRow }>(
      body,
      ensureAal2,
    );
  }
  return invokeXenditApi<{ ok: boolean; sub_account: XenditSubAccountRow }>(body);
}

export async function createPiutangVa(
  organizationId: string,
  salesActivityPaymentId: string,
  bankCode: string,
  name?: string,
) {
  return invokeXenditApi<{ ok: boolean; va: import("@/xendit/types/xendit").XenditPaymentRequest }>({
    action: "createTenantInvoiceVA",
    organization_id: organizationId,
    sales_activity_payment_id: salesActivityPaymentId,
    bank_code: bankCode,
    name,
  });
}

export async function executeXenditDisbursement(
  organizationId: string,
  payload: Record<string, unknown>,
  ensureAal2?: () => Promise<boolean>,
) {
  const body = {
    action: "executeTenantDisbursement",
    organization_id: organizationId,
    ...payload,
  };
  if (ensureAal2) {
    return invokeXenditApiWithMfaStepUp<{
      ok: boolean;
      rows: import("@/xendit/types/xendit").XenditDisbursementRow[];
      processed: number;
      failed: number;
    }>(body, ensureAal2);
  }
  return invokeXenditApi<{
    ok: boolean;
    rows: import("@/xendit/types/xendit").XenditDisbursementRow[];
    processed: number;
    failed: number;
  }>(body);
}

export async function fetchXenditWalletBalance(organizationId: string) {
  return invokeXenditApi<{
    ok: boolean;
    skipped?: boolean;
    reason?: string;
    error?: string;
    disbursePoll?: { polled: number; completed: number; errors: string[] };
    wallet?: {
      ok: boolean;
      usableBalance: number;
      pendingBalance: number;
      totalBalance: number;
      syncedAt: string | null;
      error?: string;
    };
    aggregate?: {
      usableBalance: number;
      pendingBalance: number;
      totalBalance: number;
      syncedAt: string | null;
    };
    sub_account_wallets?: import("@/xendit/types/xendit").XenditSubAccountWallet[];
  }>({
    action: "getBalance",
    organization_id: organizationId,
  });
}

export async function pollXenditDisbursements(organizationId: string) {
  return invokeXenditApi<{
    ok: boolean;
    disbursePoll: { polled: number; completed: number; errors: string[] };
  }>({
    action: "pollOrgDisbursements",
    organization_id: organizationId,
  });
}

export type XenditGatewayWithdrawalRow = {
  id: string;
  amount: number;
  platform_fee_amount?: number;
  net_amount?: number;
  bank_snapshot?: {
    bank_code?: string;
    bank_name?: string;
    account_number?: string;
    account_holder?: string;
  } | null;
  bank_destination?: string;
  initiated_by?: string | null;
  initiated_by_name?: string | null;
  status: string;
  failure_message: string | null;
  settled_at: string | null;
  created_at: string;
  updated_at: string;
  xendit_disbursement_id: string | null;
  bank_account_id: string;
  sub_account_id?: string | null;
  sub_account_email?: string | null;
  sub_account_business_name?: string | null;
  sub_account_label?: string | null;
};

export async function executeXenditGatewayWithdrawal(
  organizationId: string,
  amount: number,
  ensureAal2?: () => Promise<boolean>,
) {
  const body = {
    action: "executeGatewayWithdrawal",
    organization_id: organizationId,
    amount,
  };
  if (ensureAal2) {
    return invokeXenditApiWithMfaStepUp<{
      ok: boolean;
      withdrawal: XenditGatewayWithdrawalRow;
      disbursement: Record<string, unknown>;
    }>(body, ensureAal2);
  }
  return invokeXenditApi<{
    ok: boolean;
    withdrawal: XenditGatewayWithdrawalRow;
    disbursement: Record<string, unknown>;
  }>(body);
}

export async function fetchGatewayWithdrawals(
  organizationId: string,
  options?: { limit?: number; subAccountId?: string | null },
) {
  const limit = options?.limit ?? 20;
  const body: Record<string, unknown> = {
    action: "listGatewayWithdrawals",
    organization_id: organizationId,
    limit,
  };
  if (options?.subAccountId) {
    body.sub_account_id = options.subAccountId;
  }
  return invokeXenditApi<{ ok: boolean; withdrawals: XenditGatewayWithdrawalRow[] }>(body);
}

export async function validateGatewayPayoutBank(
  organizationId: string,
  payload: {
    bank_account_id?: string;
    bank_code?: string;
    account_number?: string;
    account_holder?: string;
    enable_payout?: boolean;
  },
  ensureAal2?: () => Promise<boolean>,
) {
  const body = {
    action: "validateGatewayPayoutBank",
    organization_id: organizationId,
    ...payload,
  };
  if (ensureAal2) {
    return invokeXenditApiWithMfaStepUp<{
      ok: boolean;
      bank_account_id: string;
      validation_status: string;
      validated_holder: string | null;
      bank_account: import("@/xendit/types/xendit").XenditGatewayPayoutBank;
    }>(body, ensureAal2);
  }
  return invokeXenditApi<{
    ok: boolean;
    bank_account_id: string;
    validation_status: string;
    validated_holder: string | null;
    bank_account: import("@/xendit/types/xendit").XenditGatewayPayoutBank;
  }>(body);
}

export async function fetchGatewayPayoutValidation(
  organizationId: string,
  bankAccountId?: string,
) {
  return invokeXenditApi<{
    ok: boolean;
    bank_account: import("@/xendit/types/xendit").XenditGatewayPayoutBank | null;
  }>({
    action: "getGatewayPayoutValidation",
    organization_id: organizationId,
    ...(bankAccountId ? { bank_account_id: bankAccountId } : {}),
  });
}

export async function updatePayrollEscrowSettings(
  organizationId: string,
  payload: {
    is_enabled?: boolean;
    escrow_sub_account_row_id?: string | null;
    require_xendit_disburse?: boolean;
  },
  ensureAal2?: () => Promise<boolean>,
) {
  const body = {
    action: "updatePayrollEscrowSettings",
    organization_id: organizationId,
    ...payload,
  };
  if (ensureAal2) {
    return invokeXenditApiWithMfaStepUp<{ ok: boolean; settings: import("@/2-4-payroll/escrow/types/payrollEscrow").PayrollEscrowSettings }>(
      body,
      ensureAal2,
    );
  }
  return invokeXenditApi<{ ok: boolean; settings: import("@/2-4-payroll/escrow/types/payrollEscrow").PayrollEscrowSettings }>(
    body,
  );
}

export async function updatePayrollExpenseSettings(
  organizationId: string,
  payload: {
    is_enabled?: boolean;
    expense_type_name?: string;
    expense_category_name?: string;
    department?: string;
  },
  ensureAal2?: () => Promise<boolean>,
) {
  const body = {
    action: "updatePayrollExpenseSettings",
    organization_id: organizationId,
    ...payload,
  };
  if (ensureAal2) {
    return invokeXenditApiWithMfaStepUp<{
      ok: boolean;
      settings: import("@/2-4-payroll/expense/types/payrollExpense").PayrollExpenseSettings;
    }>(body, ensureAal2);
  }
  return invokeXenditApi<{
    ok: boolean;
    settings: import("@/2-4-payroll/expense/types/payrollExpense").PayrollExpenseSettings;
  }>(body);
}

export async function retryPayrollEscrowTransfer(
  organizationId: string,
  payrollRunId: string,
  ensureAal2?: () => Promise<boolean>,
) {
  const body = {
    action: "retryPayrollEscrowTransfer",
    organization_id: organizationId,
    payroll_run_id: payrollRunId,
  };
  if (ensureAal2) {
    return invokeXenditApiWithMfaStepUp<{
      ok: boolean;
      skipped?: boolean;
      reason?: string;
      error?: string;
    }>(body, ensureAal2);
  }
  return invokeXenditApi<{
    ok: boolean;
    skipped?: boolean;
    reason?: string;
    error?: string;
  }>(body);
}

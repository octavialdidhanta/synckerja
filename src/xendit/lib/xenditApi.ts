import { supabase } from "@/shared/lib/supabaseClient";
import { parseEdgeFunctionError } from "@/tiktok-ads/lib/parseEdgeFunctionError";

export async function invokeXenditApi<T extends Record<string, unknown>>(
  payload: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke("xendit-api", { body: payload });
  if (error) throw await parseEdgeFunctionError(error, data);
  const body = data as T & { error?: string };
  if (body && "error" in body && body.error) {
    throw await parseEdgeFunctionError(null, body);
  }
  return body as T;
}

export async function fetchXenditSettings(organizationId: string) {
  return invokeXenditApi<{
    serverConfigured: boolean;
    isSandbox: boolean;
    keyKind: "development" | "production" | "public" | "unknown";
    publicKey: string | null;
    account: import("@/xendit/types/xendit").XenditOrgAccount | null;
    platformConfig: { flat_fee_amount: number; split_rule_id: string | null } | null;
    withdrawalPlatformFee: number;
    ilumaConfigured: boolean;
    platformSplitReady: boolean;
    vaBanks: import("@/xendit/types/xendit").XenditVaBank[];
  }>({ action: "getSettings", organization_id: organizationId });
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

export async function enableXenditForOrg(organizationId: string, enabled: boolean) {
  return invokeXenditApi<{ ok: boolean; enabled: boolean }>({
    action: "enableXendit",
    organization_id: organizationId,
    enabled,
  });
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
  return invokeXenditApi<{ ok: boolean; sub_account_id: string }>({
    action: "createTenantSubAccount",
    organization_id: input.organizationId,
    business_name: input.businessName,
    email: input.email,
    type: input.type ?? "OWNED",
    linked_bank_account_id: input.linkedBankAccountId ?? null,
    payout_bank_code: input.payoutBankCode,
    payout_account_number: input.payoutAccountNumber,
    payout_account_holder_name: input.payoutAccountHolderName,
  });
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
) {
  return invokeXenditApi<{
    ok: boolean;
    rows: import("@/xendit/types/xendit").XenditDisbursementRow[];
    processed: number;
    failed: number;
  }>({
    action: "executeTenantDisbursement",
    organization_id: organizationId,
    ...payload,
  });
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
};

export async function executeXenditGatewayWithdrawal(organizationId: string, amount: number) {
  return invokeXenditApi<{
    ok: boolean;
    withdrawal: XenditGatewayWithdrawalRow;
    disbursement: Record<string, unknown>;
  }>({
    action: "executeGatewayWithdrawal",
    organization_id: organizationId,
    amount,
  });
}

export async function fetchGatewayWithdrawals(organizationId: string, limit = 20) {
  return invokeXenditApi<{ ok: boolean; withdrawals: XenditGatewayWithdrawalRow[] }>({
    action: "listGatewayWithdrawals",
    organization_id: organizationId,
    limit,
  });
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
) {
  return invokeXenditApi<{
    ok: boolean;
    bank_account_id: string;
    validation_status: string;
    validated_holder: string | null;
    bank_account: import("@/xendit/types/xendit").XenditGatewayPayoutBank;
  }>({
    action: "validateGatewayPayoutBank",
    organization_id: organizationId,
    ...payload,
  });
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

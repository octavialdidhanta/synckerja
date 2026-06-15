import { supabase } from '@/shared/lib/supabaseClient';
import { parseEdgeFunctionError } from '@/tiktok-ads/lib/parseEdgeFunctionError';

const BRICK_API = 'brick-bank-api';
const BRICK_OAUTH_START = 'brick-oauth-start';

export type BrickOAuthTargetType = 'bank_account' | 'debt';

export async function invokeBrickApi<T extends Record<string, unknown>>(
  payload: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(BRICK_API, { body: payload });
  if (error) throw await parseEdgeFunctionError(error, data);
  const body = data as T & { error?: string };
  if (body && 'error' in body && body.error) {
    throw await parseEdgeFunctionError(null, body);
  }
  return body as T;
}

export type BrickWidgetConnectMode = 'app_connect' | 'brick_widget';

export async function startBrickOAuth(params: {
  organizationId: string;
  targetType: BrickOAuthTargetType;
  targetId: string;
  returnPath?: string;
}) {
  const { data, error } = await supabase.functions.invoke(BRICK_OAUTH_START, {
    body: {
      organization_id: params.organizationId,
      target_type: params.targetType,
      target_id: params.targetId,
      return_path: params.returnPath,
      app_origin: typeof window !== 'undefined' ? window.location.origin : undefined,
    },
  });
  if (error) throw await parseEdgeFunctionError(error, data);
  const body = data as {
    widgetUrl?: string;
    error?: string;
    state?: string;
    connectMode?: BrickWidgetConnectMode;
  };
  if (body?.error) throw await parseEdgeFunctionError(null, body);
  if (!body?.widgetUrl) throw new Error('No Brick widget URL returned');
  return body;
}

export function openBrickWidget(
  widgetUrl: string,
  options?: { connectMode?: BrickWidgetConnectMode },
): void {
  const useSameWindow = options?.connectMode === 'app_connect' ||
    widgetUrl.includes('/finance/brick-oauth/connect');
  if (useSameWindow) {
    window.location.assign(widgetUrl);
    return;
  }
  const isMobile = typeof window !== 'undefined' &&
    window.matchMedia('(max-width: 768px)').matches;
  if (isMobile) {
    window.location.assign(widgetUrl);
    return;
  }
  const popup = window.open(widgetUrl, 'brick_oauth', 'width=480,height=720,noopener,noreferrer');
  if (!popup) {
    window.location.assign(widgetUrl);
  }
}

/** @deprecated Use startBrickOAuth — link now opens Brick Widget OAuth */
export async function linkBankAccountBrick(organizationId: string, bankAccountId: string) {
  return startBrickOAuth({
    organizationId,
    targetType: 'bank_account',
    targetId: bankAccountId,
    returnPath: '/incomes/transaction/bank-account',
  });
}

export async function startBrickBankOAuth(organizationId: string, bankAccountId: string) {
  return startBrickOAuth({
    organizationId,
    targetType: 'bank_account',
    targetId: bankAccountId,
    returnPath: '/incomes/transaction/bank-account',
  });
}

export async function startBrickDebtOAuth(organizationId: string, debtId: string) {
  return startBrickOAuth({
    organizationId,
    targetType: 'debt',
    targetId: debtId,
    returnPath: '/expenses/debt',
  });
}

export async function unlinkBankAccountBrick(organizationId: string, bankAccountId: string) {
  return invokeBrickApi<{ ok: boolean; bankAccountId: string; brickLinkStatus: string }>({
    action: 'unlink',
    organizationId,
    bankAccountId,
    targetType: 'bank_account',
  });
}

export async function unlinkBrickDebt(organizationId: string, debtId: string) {
  return invokeBrickApi<{ ok: boolean; debtId: string; brickLinkStatus: string }>({
    action: 'unlink',
    organizationId,
    debtId,
    targetType: 'debt',
  });
}

export async function syncBrickBankMutations(
  organizationId: string,
  options?: { bankAccountId?: string; debtId?: string; skipRateLimit?: boolean },
) {
  return invokeBrickApi<{
    ok: boolean;
    accounts: number;
    creditCards?: number;
    newLines: number;
    newDebtLines?: number;
    importedExpenses?: number;
    fetchedFromBrick?: number;
    suggestedMatches: number;
    vaPoll?: { polled: number; settled: number; errors: string[] };
    disbursePoll?: { polled: number; completed: number; errors: string[]; reconciled?: { resetToPending: number; markedPaid: number } };
    xenditDisbursePoll?: { polled: number; completed: number; errors: string[] };
    walletSync?: {
      ok: boolean;
      usableBalance: number;
      pendingBalance: number;
      totalBalance: number;
      syncedAt: string | null;
      error?: string;
      skipped?: boolean;
    };
    errors: Array<{ bankAccountId: string; debtId?: string; name: string; error: string }>;
    message?: string;
  }>({
    action: 'syncAggregation',
    organizationId,
    ...(options?.bankAccountId ? { bankAccountId: options.bankAccountId } : {}),
    ...(options?.debtId ? { debtId: options.debtId } : {}),
    ...(options?.skipRateLimit ? { skipRateLimit: true } : {}),
  });
}

export type BrickPaymentRequestRow = {
  id: string;
  organization_id: string;
  sales_activity_payment_id: string;
  reference_id: string;
  brick_va_id: string | null;
  brick_payment_id: string | null;
  bank_short_code: string;
  account_no: string | null;
  expected_amount: number;
  status: string;
  expires_at: string | null;
  paid_at: string | null;
  completed_at: string | null;
};

export async function createBrickCloseVa(
  organizationId: string,
  salesActivityPaymentId: string,
  bankShortCode: string,
  displayName?: string,
) {
  return invokeBrickApi<{
    ok: boolean;
    va: BrickPaymentRequestRow;
    warning?: string;
  }>({
    action: 'createCloseVa',
    organizationId,
    sales_activity_payment_id: salesActivityPaymentId,
    bankShortCode,
    ...(displayName ? { displayName } : {}),
  });
}

export async function getBrickVaStatus(
  organizationId: string,
  options: {
    brickPaymentRequestId?: string;
    sales_activity_payment_id?: string;
    vaId?: string;
    processUpdate?: boolean;
  },
) {
  return invokeBrickApi<{
    ok: boolean;
    status: string;
    va: BrickPaymentRequestRow | null;
    processed?: { ok: boolean; linked: boolean; settled: boolean };
  }>({
    action: 'getVaStatus',
    organizationId,
    ...options,
  });
}

export type BrickDisbursementRow = {
  id: string;
  organization_id: string;
  source_type: string;
  source_id: string;
  reference_id: string;
  brick_disbursement_id: string | null;
  bank_short_code: string;
  account_holder_name: string;
  account_no: string;
  amount: number;
  fee_amount: number | null;
  description: string | null;
  status: string;
  source_bank_account_id: string | null;
  failure_code: string | null;
  failure_message: string | null;
  completed_at: string | null;
  created_at: string;
};

export async function executeBrickDisbursement(
  organizationId: string,
  payload: Record<string, unknown>,
) {
  return invokeBrickApi<{
    ok: boolean;
    processed: number;
    failed: number;
    disbursements: BrickDisbursementRow[];
  }>({
    action: 'executeDisbursement',
    organizationId,
    ...payload,
  });
}

export async function getBrickDisbursementStatus(
  organizationId: string,
  options: {
    brickDisbursementId?: string;
    referenceId?: string;
    processUpdate?: boolean;
  },
) {
  return invokeBrickApi<{
    ok: boolean;
    status: string;
    disbursement: BrickDisbursementRow | null;
    processed?: { ok: boolean; completed: boolean };
  }>({
    action: 'getDisbursementStatus',
    organizationId,
    ...options,
  });
}

export async function fetchBrickWalletBalance(organizationId: string) {
  return invokeBrickApi<{
    ok: boolean;
    skipped?: boolean;
    reason?: string;
    error?: string;
    wallet?: {
      ok: boolean;
      usableBalance: number;
      pendingBalance: number;
      totalBalance: number;
      syncedAt: string | null;
      error?: string;
    };
  }>({
    action: 'getBalance',
    organizationId,
  });
}

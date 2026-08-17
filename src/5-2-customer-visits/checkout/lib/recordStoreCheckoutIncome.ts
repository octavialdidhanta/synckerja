import { supabase } from '@/shared/lib/supabaseClient';
import type { CustomerVisitCheckoutPaymentMethod } from './customerVisitCheckout.types';

export const STORE_CHECKOUT_INCOME_ERROR_CODES = [
  'store_checkout_omnichannel_bank_missing',
  'store_checkout_forbidden',
  'store_checkout_not_found',
  'store_checkout_wrong_type',
  'store_checkout_invalid_amount',
  'store_checkout_invalid_payment_method',
  'store_checkout_actor_required',
  'store_checkout_income_failed',
] as const;

export type StoreCheckoutIncomeErrorCode = (typeof STORE_CHECKOUT_INCOME_ERROR_CODES)[number];

export const STORE_CHECKOUT_PAYMENT_METHODS: CustomerVisitCheckoutPaymentMethod[] = [
  'cash',
  'bank_transfer',
  'e_wallet',
];

export type RecordStoreCheckoutIncomeResult = {
  ok: true;
  alreadyRecorded: boolean;
  incomeId: string | null;
  paymentId: string | null;
  status: string | null;
};

type RpcPayload = {
  ok?: unknown;
  already_recorded?: unknown;
  income_id?: unknown;
  payment_id?: unknown;
  status?: unknown;
};

export function canonicalizeStoreCheckoutPaymentMethod(
  value: string | null | undefined,
): CustomerVisitCheckoutPaymentMethod | null {
  const method = String(value ?? '').trim().toLowerCase();
  if (method === 'transfer') return 'bank_transfer';
  if (STORE_CHECKOUT_PAYMENT_METHODS.includes(method as CustomerVisitCheckoutPaymentMethod)) {
    return method as CustomerVisitCheckoutPaymentMethod;
  }
  return null;
}

export function isStoreCheckoutPaymentMethod(
  value: string | null | undefined,
): value is CustomerVisitCheckoutPaymentMethod {
  return canonicalizeStoreCheckoutPaymentMethod(value) !== null;
}

export function storeCheckoutNeedsOmnichannelBank(
  value: string | null | undefined,
): boolean {
  const method = canonicalizeStoreCheckoutPaymentMethod(value);
  return method === 'bank_transfer' || method === 'e_wallet';
}

export function parseStoreCheckoutIncomeErrorCode(
  message: string | null | undefined,
): StoreCheckoutIncomeErrorCode {
  const text = String(message ?? '');
  for (const code of STORE_CHECKOUT_INCOME_ERROR_CODES) {
    if (code === 'store_checkout_income_failed') continue;
    if (text.includes(code)) return code;
  }
  return 'store_checkout_income_failed';
}

export function parseRecordStoreCheckoutIncomePayload(data: unknown): RecordStoreCheckoutIncomeResult {
  const row = (data ?? {}) as RpcPayload;
  if (row.ok !== true) {
    throw new Error('store_checkout_income_failed');
  }
  return {
    ok: true,
    alreadyRecorded: row.already_recorded === true,
    incomeId: typeof row.income_id === 'string' ? row.income_id : null,
    paymentId: typeof row.payment_id === 'string' ? row.payment_id : null,
    status: typeof row.status === 'string' ? row.status : null,
  };
}

export async function recordStoreCheckoutIncome(args: {
  activityId: string;
  paymentMethod: string;
}): Promise<RecordStoreCheckoutIncomeResult> {
  if (!args.activityId.trim()) {
    throw new Error('store_checkout_not_found');
  }
  const paymentMethod = canonicalizeStoreCheckoutPaymentMethod(args.paymentMethod);
  if (!paymentMethod) {
    throw new Error('store_checkout_invalid_payment_method');
  }

  const { data, error } = await supabase.rpc('record_store_checkout_income', {
    p_activity_id: args.activityId,
    p_payment_method: paymentMethod,
  });

  if (error) {
    throw new Error(parseStoreCheckoutIncomeErrorCode(error.message));
  }

  return parseRecordStoreCheckoutIncomePayload(data);
}

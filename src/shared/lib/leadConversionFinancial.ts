/**
 * Livechat / lead Converted flow: payment payload + normalization for `sales_activities.payment_method` CHECK.
 */

export type ConversionLeadPaymentKind = 'down_payment' | 'full';

/** Persisted after receipt upload to `income-receipts` (storage path, not public URL). */
export type ConversionLeadPaymentPayload = {
  kind: ConversionLeadPaymentKind;
  /** Required when kind === 'down_payment'; must be > 0 and <= order total. */
  downPaymentAmount?: number;
  paymentDate: string;
  /** UI select value (snake_case); normalized for DB columns. */
  paymentMethod: string;
  receiptStoragePath: string;
};

const ALLOWED_SALES_ACTIVITY_METHODS = new Set([
  'cash',
  'credit',
  'pending',
  'bank_transfer',
  'credit_card',
  'e_wallet',
  'other',
]);

/**
 * Maps Activity / livechat UI values to values allowed by `sales_activities.payment_method` CHECK.
 * Canonical bank method is `bank_transfer` (alias `transfer` is not persisted).
 */
export function normalizePaymentMethodForSalesActivity(ui: string): string {
  const u = (ui ?? '').trim().toLowerCase();
  if (u === 'transfer') return 'bank_transfer';
  if (ALLOWED_SALES_ACTIVITY_METHODS.has(u)) return u;
  switch (u) {
    case 'debit_card':
    case 'check':
      return 'other';
    case 'digital_wallet':
      return 'e_wallet';
    default:
      return 'cash';
  }
}

export type ResolvedConversionPayment = {
  paymentAmount: number;
  paymentType: 'down_payment' | 'final_payment';
  methodCanonical: string;
  activityPatch: {
    is_down_payment: boolean;
    is_paid: boolean;
    down_payment_amount: number | null;
    remaining_amount: number | null;
    payment_method: string;
    receipt_url: string;
  };
};

/**
 * Derives payment row + activity denormalized fields. Throws `converted_sales_payment_invalid` if invalid.
 */
export function resolveConversionLeadPayment(
  orderTotal: number,
  payload: ConversionLeadPaymentPayload,
): ResolvedConversionPayment {
  if (!Number.isFinite(orderTotal) || orderTotal <= 0) {
    throw new Error('converted_sales_payment_invalid');
  }
  const date = (payload.paymentDate ?? '').trim();
  if (!date) {
    throw new Error('converted_sales_payment_invalid');
  }
  const path = (payload.receiptStoragePath ?? '').trim();
  if (!path) {
    throw new Error('converted_sales_payment_invalid');
  }
  if (!(payload.paymentMethod ?? '').trim()) {
    throw new Error('converted_sales_payment_invalid');
  }
  const methodCanonical = normalizePaymentMethodForSalesActivity(payload.paymentMethod);

  if (payload.kind === 'full') {
    return {
      paymentAmount: orderTotal,
      paymentType: 'final_payment',
      methodCanonical,
      activityPatch: {
        is_down_payment: false,
        is_paid: true,
        down_payment_amount: null,
        remaining_amount: 0,
        payment_method: methodCanonical,
        receipt_url: path,
      },
    };
  }

  const dp = payload.downPaymentAmount;
  if (dp == null || !Number.isFinite(dp) || dp <= 0 || dp > orderTotal + 1e-9) {
    throw new Error('converted_sales_payment_invalid');
  }
  const remaining = Math.max(0, orderTotal - dp);
  const fullyPaid = remaining <= 1e-6;
  return {
    paymentAmount: dp,
    paymentType: 'down_payment',
    methodCanonical,
    activityPatch: {
      is_down_payment: true,
      is_paid: fullyPaid,
      down_payment_amount: dp,
      remaining_amount: remaining,
      payment_method: methodCanonical,
      receipt_url: path,
    },
  };
}

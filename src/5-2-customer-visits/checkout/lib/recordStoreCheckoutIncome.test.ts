import { describe, expect, it } from 'vitest';
import {
  canonicalizeStoreCheckoutPaymentMethod,
  isStoreCheckoutPaymentMethod,
  parseRecordStoreCheckoutIncomePayload,
  parseStoreCheckoutIncomeErrorCode,
  storeCheckoutNeedsOmnichannelBank,
} from './recordStoreCheckoutIncome';

describe('canonicalizeStoreCheckoutPaymentMethod', () => {
  it('persists bank_transfer, not transfer', () => {
    expect(canonicalizeStoreCheckoutPaymentMethod('bank_transfer')).toBe('bank_transfer');
    expect(canonicalizeStoreCheckoutPaymentMethod('transfer')).toBe('bank_transfer');
    expect(canonicalizeStoreCheckoutPaymentMethod('TRANSFER')).toBe('bank_transfer');
  });

  it('accepts cash and e_wallet', () => {
    expect(canonicalizeStoreCheckoutPaymentMethod('cash')).toBe('cash');
    expect(canonicalizeStoreCheckoutPaymentMethod('e_wallet')).toBe('e_wallet');
  });

  it('rejects unknown methods', () => {
    expect(canonicalizeStoreCheckoutPaymentMethod('xendit_va')).toBeNull();
    expect(canonicalizeStoreCheckoutPaymentMethod('')).toBeNull();
    expect(canonicalizeStoreCheckoutPaymentMethod(null)).toBeNull();
  });
});

describe('isStoreCheckoutPaymentMethod', () => {
  it('accepts cash, bank_transfer, e_wallet, and transfer alias', () => {
    expect(isStoreCheckoutPaymentMethod('cash')).toBe(true);
    expect(isStoreCheckoutPaymentMethod('bank_transfer')).toBe(true);
    expect(isStoreCheckoutPaymentMethod('e_wallet')).toBe(true);
    expect(isStoreCheckoutPaymentMethod('transfer')).toBe(true);
  });

  it('rejects other methods', () => {
    expect(isStoreCheckoutPaymentMethod('xendit_va')).toBe(false);
    expect(isStoreCheckoutPaymentMethod('')).toBe(false);
    expect(isStoreCheckoutPaymentMethod(null)).toBe(false);
  });
});

describe('storeCheckoutNeedsOmnichannelBank', () => {
  it('requires a bank for bank_transfer and e_wallet only', () => {
    expect(storeCheckoutNeedsOmnichannelBank('cash')).toBe(false);
    expect(storeCheckoutNeedsOmnichannelBank('bank_transfer')).toBe(true);
    expect(storeCheckoutNeedsOmnichannelBank('transfer')).toBe(true);
    expect(storeCheckoutNeedsOmnichannelBank('e_wallet')).toBe(true);
  });
});

describe('parseStoreCheckoutIncomeErrorCode', () => {
  it('extracts known RPC exception codes from supabase messages', () => {
    expect(parseStoreCheckoutIncomeErrorCode('store_checkout_omnichannel_bank_missing')).toBe(
      'store_checkout_omnichannel_bank_missing',
    );
    expect(
      parseStoreCheckoutIncomeErrorCode(
        'P0001: store_checkout_forbidden\nDETAIL: org member required',
      ),
    ).toBe('store_checkout_forbidden');
    expect(parseStoreCheckoutIncomeErrorCode('store_checkout_not_found')).toBe('store_checkout_not_found');
    expect(parseStoreCheckoutIncomeErrorCode('store_checkout_wrong_type')).toBe('store_checkout_wrong_type');
    expect(parseStoreCheckoutIncomeErrorCode('store_checkout_invalid_amount')).toBe(
      'store_checkout_invalid_amount',
    );
    expect(parseStoreCheckoutIncomeErrorCode('store_checkout_invalid_payment_method')).toBe(
      'store_checkout_invalid_payment_method',
    );
    expect(parseStoreCheckoutIncomeErrorCode('store_checkout_actor_required')).toBe(
      'store_checkout_actor_required',
    );
  });

  it('falls back when the message is unknown', () => {
    expect(parseStoreCheckoutIncomeErrorCode('jwt expired')).toBe('store_checkout_income_failed');
    expect(parseStoreCheckoutIncomeErrorCode(null)).toBe('store_checkout_income_failed');
  });
});

describe('parseRecordStoreCheckoutIncomePayload', () => {
  it('parses a first-time success payload', () => {
    expect(
      parseRecordStoreCheckoutIncomePayload({
        ok: true,
        already_recorded: false,
        income_id: 'inc-1',
        payment_id: 'pay-1',
        status: 'completed',
      }),
    ).toEqual({
      ok: true,
      alreadyRecorded: false,
      incomeId: 'inc-1',
      paymentId: 'pay-1',
      status: 'completed',
    });
  });

  it('treats already_recorded as success without a second insert', () => {
    expect(
      parseRecordStoreCheckoutIncomePayload({
        ok: true,
        already_recorded: true,
        income_id: 'inc-1',
        payment_id: 'pay-1',
        status: 'completed',
      }),
    ).toEqual({
      ok: true,
      alreadyRecorded: true,
      incomeId: 'inc-1',
      paymentId: 'pay-1',
      status: 'completed',
    });
  });

  it('rejects a non-ok payload', () => {
    expect(() => parseRecordStoreCheckoutIncomePayload({ ok: false })).toThrow(
      'store_checkout_income_failed',
    );
    expect(() => parseRecordStoreCheckoutIncomePayload(null)).toThrow('store_checkout_income_failed');
  });
});

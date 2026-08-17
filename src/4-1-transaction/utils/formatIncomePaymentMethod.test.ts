import { describe, expect, it } from 'vitest';
import {
  canonicalIncomePaymentMethod,
  formatIncomePaymentMethodLabel,
} from './formatIncomePaymentMethod';

const labels = {
  cash: 'Cash',
  bankTransfer: 'Bank Transfer',
  eWallet: 'E-wallet',
  creditCard: 'Credit Card',
  debitCard: 'Debit Card',
};

describe('canonicalIncomePaymentMethod', () => {
  it('maps transfer aliases to bank_transfer', () => {
    expect(canonicalIncomePaymentMethod('transfer')).toBe('bank_transfer');
    expect(canonicalIncomePaymentMethod('bank_transfer')).toBe('bank_transfer');
    expect(canonicalIncomePaymentMethod('Bank Transfer')).toBe('bank_transfer');
  });

  it('maps digital_wallet to e_wallet', () => {
    expect(canonicalIncomePaymentMethod('e_wallet')).toBe('e_wallet');
    expect(canonicalIncomePaymentMethod('digital_wallet')).toBe('e_wallet');
  });
});

describe('formatIncomePaymentMethodLabel', () => {
  it('labels cash, bank transfer alias, and e-wallet', () => {
    expect(formatIncomePaymentMethodLabel('cash', labels)).toBe('Cash');
    expect(formatIncomePaymentMethodLabel('transfer', labels)).toBe('Bank Transfer');
    expect(formatIncomePaymentMethodLabel('bank_transfer', labels)).toBe('Bank Transfer');
    expect(formatIncomePaymentMethodLabel('e_wallet', labels)).toBe('E-wallet');
  });

  it('returns dash for empty and keeps unknown values', () => {
    expect(formatIncomePaymentMethodLabel(null, labels)).toBe('-');
    expect(formatIncomePaymentMethodLabel('xendit_va', labels)).toBe('xendit_va');
  });
});

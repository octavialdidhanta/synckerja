import { describe, expect, it } from 'vitest';
import { buildBankAccountPeriodNet } from './buildBankAccountPeriodNet';
import {
  sumBankGatewayTransferIn,
  sumBankPeriodIncome,
  sumDrawerPeriodIncome,
} from './incomeDashboardPeriodTotals';

describe('buildBankAccountPeriodNet', () => {
  it('separates operating income from gateway transfer in', () => {
    const map = buildBankAccountPeriodNet({
      bankAccountBalances: [
        {
          id: 'bal-1',
          bank_account_id: 'bank-1',
          organization_id: 'org-1',
          balance: 200_745_000,
          created_at: '',
          updated_at: '',
        },
      ],
      filteredTransactions: [{ bank_account_id: 'bank-1', amount: 45_000 }],
      filteredExpenses: [],
      gatewayWithdrawalBankCredits: { 'bank-1': 200_700_000 },
    });

    expect(map['bank-1'].operatingIncome).toBe(45_000);
    expect(map['bank-1'].gatewayTransferIn).toBe(200_700_000);
    expect(map['bank-1'].net).toBe(200_745_000);
  });

  it('includes transfer in net for opening balance reconciliation', () => {
    const map = buildBankAccountPeriodNet({
      bankAccountBalances: [
        {
          id: 'bal-1',
          bank_account_id: 'bank-1',
          organization_id: 'org-1',
          balance: 100_000,
          created_at: '',
          updated_at: '',
        },
      ],
      filteredTransactions: [],
      filteredExpenses: [{ bank_account_id: 'bank-1', amount: 10_000 }],
      gatewayWithdrawalBankCredits: { 'bank-1': 50_000 },
    });

    expect(map['bank-1'].net).toBe(40_000);
    expect(100_000 - map['bank-1'].net).toBe(60_000);
  });
});

describe('sumBankPeriodIncome', () => {
  it('excludes gateway transfer from period income total', () => {
    const map = buildBankAccountPeriodNet({
      bankAccountBalances: [],
      filteredTransactions: [{ bank_account_id: 'a', amount: 1_000 }],
      filteredExpenses: [],
      gatewayWithdrawalBankCredits: { a: 99_000 },
    });

    expect(sumBankPeriodIncome(map, 'all')).toBe(1_000);
    expect(sumBankGatewayTransferIn(map, 'all')).toBe(99_000);
  });
});

describe('sumDrawerPeriodIncome', () => {
  it('adds xendit VA income but not bank gateway transfers', () => {
    const map = buildBankAccountPeriodNet({
      bankAccountBalances: [],
      filteredTransactions: [{ bank_account_id: 'a', amount: 5_000 }],
      filteredExpenses: [],
      gatewayWithdrawalBankCredits: { a: 100_000 },
    });

    const total = sumDrawerPeriodIncome(
      map,
      'all',
      { xendit: { income: 3_000, expense: 0, net: 3_000 } },
      { xenditEligible: true },
    );

    expect(total).toBe(8_000);
  });
});

import type { BankAccountBalance } from '@/shared/hooks/finance/useBankAccountBalances';

export type BankAccountPeriodNet = {
  operatingIncome: number;
  gatewayTransferIn: number;
  expense: number;
  net: number;
  balance: number;
};

export type BankAccountPeriodNetMap = Record<string, BankAccountPeriodNet>;

type TransactionLike = { bank_account_id?: string | null; amount: unknown };
type ExpenseLike = { bank_account_id?: string | null; amount: number };

export function buildBankAccountPeriodNet(args: {
  bankAccountBalances: BankAccountBalance[];
  filteredTransactions: TransactionLike[];
  filteredExpenses: ExpenseLike[];
  gatewayWithdrawalBankCredits: Record<string, number>;
}): BankAccountPeriodNetMap {
  const { bankAccountBalances, filteredTransactions, filteredExpenses, gatewayWithdrawalBankCredits } =
    args;

  const netMap: BankAccountPeriodNetMap = {};

  for (const balance of bankAccountBalances) {
    netMap[balance.bank_account_id] = {
      operatingIncome: 0,
      gatewayTransferIn: 0,
      expense: 0,
      net: 0,
      balance: balance.balance,
    };
  }

  for (const transaction of filteredTransactions) {
    const bankAccountId = transaction.bank_account_id;
    if (!bankAccountId) continue;
    if (!netMap[bankAccountId]) {
      netMap[bankAccountId] = {
        operatingIncome: 0,
        gatewayTransferIn: 0,
        expense: 0,
        net: 0,
        balance: 0,
      };
    }
    netMap[bankAccountId].operatingIncome += parseFloat(String(transaction.amount));
  }

  for (const expense of filteredExpenses) {
    const bankAccountId = expense.bank_account_id;
    if (!bankAccountId) continue;
    if (!netMap[bankAccountId]) {
      netMap[bankAccountId] = {
        operatingIncome: 0,
        gatewayTransferIn: 0,
        expense: 0,
        net: 0,
        balance: 0,
      };
    }
    netMap[bankAccountId].expense += expense.amount;
  }

  for (const [bankAccountId, credit] of Object.entries(gatewayWithdrawalBankCredits)) {
    if (!netMap[bankAccountId]) {
      netMap[bankAccountId] = {
        operatingIncome: 0,
        gatewayTransferIn: 0,
        expense: 0,
        net: 0,
        balance: 0,
      };
    }
    netMap[bankAccountId].gatewayTransferIn += credit;
  }

  for (const bankAccountId of Object.keys(netMap)) {
    const row = netMap[bankAccountId];
    row.net = row.operatingIncome + row.gatewayTransferIn - row.expense;
  }

  return netMap;
}

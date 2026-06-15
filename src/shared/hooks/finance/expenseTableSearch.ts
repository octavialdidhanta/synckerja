import type { Expense } from "@/shared/hooks/finance/useExpenses";
import type { GatewayWalletProvider } from "@/shared/lib/finance/withdrawalSourceValue";

export type ExpenseSearchable = Expense & {
  request_title?: string;
  requester_name?: string;
  withdrawal_from_balance_bank_account?: { name?: string | null } | null;
  withdrawal_from_balance_debt?: { debt_name?: string | null } | null;
};

const DEFAULT_GATEWAY_LABELS: Record<GatewayWalletProvider, string> = {
  xendit: "Xendit",
  brick: "Brick",
};

/** Label shown in the Withdrawal column (bank, debt, or gateway drawer). */
export function getExpenseWithdrawalLabel(
  expense: ExpenseSearchable,
  options?: { formatGateway?: (provider: GatewayWalletProvider) => string },
): string {
  const bank = expense.withdrawal_from_balance_bank_account?.name?.trim();
  if (bank) return bank;

  const debt = expense.withdrawal_from_balance_debt?.debt_name?.trim();
  if (debt) return debt;

  const gateway = expense.gateway_wallet_provider;
  if (gateway === "xendit" || gateway === "brick") {
    return options?.formatGateway?.(gateway) ?? DEFAULT_GATEWAY_LABELS[gateway];
  }

  return "";
}

/**
 * Text search for expense table rows (desktop + mobile).
 * Matches: expense name/title, withdrawal, type, category (+ transaction ref / description).
 */
export function matchesExpenseSearchQuery(expense: ExpenseSearchable, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const hay = [
    expense.expense_name,
    expense.request_title,
    getExpenseWithdrawalLabel(expense),
    expense.expense_type,
    expense.category,
    expense.transaction_reference,
    expense.description,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return hay.includes(q);
}

export function filterExpensesBySearch<T extends ExpenseSearchable>(
  expenses: T[],
  query: string,
): T[] {
  const q = query.trim();
  if (!q) return expenses;
  return expenses.filter((expense) => matchesExpenseSearchQuery(expense, q));
}

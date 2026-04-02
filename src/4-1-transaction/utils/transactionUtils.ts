import type { IncomeTransactionFilters } from '../section/IncomeTransactionFilters';

export interface IncomeTransaction {
  id: string;
  customer_name?: string | null;
  description?: string | null;
  amount: number;
  status: string;
  transaction_date: string;
  income_types?: { name: string } | null;
  income_categories?: { name: string } | null;
  payment_method?: string | null;
  is_recurring?: boolean | null;
  recurring_frequency?: string | null;
  receipt_file_path?: string | null;
  receipt_file_name?: string | null;
  services?: { name: string } | null;
  sub_services?: { name: string } | null;
  transaction_reference?: string | null;
}

/**
 * Filter income transactions based on filter criteria
 */
export const filterTransactions = (
  transactions: IncomeTransaction[],
  filters: IncomeTransactionFilters
): IncomeTransaction[] => {
  return transactions.filter((transaction) => {
    // Search filter
    const q = filters.search.toLowerCase();
    const matchesSearch =
      !filters.search ||
      transaction.customer_name?.toLowerCase().includes(q) ||
      transaction.description?.toLowerCase().includes(q) ||
      transaction.id.toLowerCase().includes(q) ||
      (transaction.transaction_reference || "").toLowerCase().includes(q);

    // Status filter
    const matchesStatus = filters.status === 'all' || transaction.status === filters.status;

    // Type filter
    const matchesType = filters.type === 'all' || transaction.income_types?.name === filters.type;

    // Category filter
    const matchesCategory = filters.category === 'all' || transaction.income_categories?.name === filters.category;

    return matchesSearch && matchesStatus && matchesType && matchesCategory;
  });
};

/**
 * Get unique income types from transactions
 */
export const getUniqueIncomeTypes = (transactions: IncomeTransaction[]): string[] => {
  return [...new Set(
    transactions
      .map(t => t.income_types?.name)
      .filter(Boolean)
  )].sort() as string[];
};

/**
 * Get unique income categories from transactions
 */
export const getUniqueIncomeCategories = (transactions: IncomeTransaction[]): string[] => {
  return [...new Set(
    transactions
      .map(t => t.income_categories?.name)
      .filter(Boolean)
  )].sort() as string[];
};


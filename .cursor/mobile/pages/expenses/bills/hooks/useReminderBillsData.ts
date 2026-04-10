import { useMemo } from "react";
import { useExpenses, type Expense, useExpenseTypes, useExpenseCategories } from "@/features/4_2_dashboard/hooks";
import { usePurchaseRequests, type PurchaseRequest } from "@/features/9_request-form/hooks/usePurchaseRequests";
import { calculateNextPaymentDate } from "@/features/4_2_reminder-bills/utils/reminderBillsUtils";

export function useReminderBillsData() {
  const { expenses = [], isLoading: expensesLoading, refetch } = useExpenses();
  const { data: purchaseRequests = [], isLoading: purchaseRequestsLoading } = usePurchaseRequests();
  const { expenseTypes } = useExpenseTypes();
  const { expenseCategories: allExpenseCategories } = useExpenseCategories();

  const paidRecurringPurchaseRequests = useMemo(() => {
    return purchaseRequests.filter((req) =>
      req.status === "approved" &&
      (req.paid_at || req.payment_status === "paid") &&
      req.is_recurring === true &&
      req.recurring_frequency
    );
  }, [purchaseRequests]);

  const getExpenseTypeName = (pr: PurchaseRequest): string => {
    if (pr.expense_types?.name) return pr.expense_types.name;
    if (pr.expense_type_id && expenseTypes.length > 0) {
      const expenseType = expenseTypes.find((et) => et.id === pr.expense_type_id);
      if (expenseType) return expenseType.name;
    }
    return "Uncategorized";
  };

  const getExpenseCategoryName = (pr: PurchaseRequest): string => {
    if (pr.expense_categories?.name) return pr.expense_categories.name;
    if (pr.expense_category_id && allExpenseCategories.length > 0) {
      const expenseCategory = allExpenseCategories.find((ec) => ec.id === pr.expense_category_id);
      if (expenseCategory) return expenseCategory.name;
    }
    return pr.request_type || "Purchase";
  };

  const expensesWithNextPayment = useMemo(() => {
    return expenses
      .filter(
        (expense) =>
          !expense.recurring_settlement_for_expense_id && !expense.exclude_from_reminder_bills
      )
      .map((expense) => {
      if (expense.is_recurring && expense.recurring_frequency && !expense.next_payment_date) {
        const nextPaymentDate = calculateNextPaymentDate(expense.create_date, expense.recurring_frequency);
        return {
          ...expense,
          bill_source: "expense" as const,
          next_payment_date: nextPaymentDate || expense.next_payment_date,
        };
      }

      if (expense.is_recurring && expense.recurring_frequency && expense.next_payment_date) {
        const nextPayment = new Date(expense.next_payment_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (nextPayment < today) {
          const nextPaymentDate = calculateNextPaymentDate(expense.next_payment_date, expense.recurring_frequency);
          return {
            ...expense,
            bill_source: "expense" as const,
            next_payment_date: nextPaymentDate || expense.next_payment_date,
          };
        }
      }
      return { ...expense, bill_source: "expense" as const };
    });
  }, [expenses]);

  const allBills = useMemo(() => {
    const combined: Expense[] = [...expensesWithNextPayment];

    paidRecurringPurchaseRequests.forEach((pr) => {
      const alreadyLinkedToExpense = expensesWithNextPayment.some(
        (expense) => expense.purchase_request_id === pr.id
      );
      if (alreadyLinkedToExpense) return;

      const expenseTypeName = getExpenseTypeName(pr);
      const expenseCategoryName = getExpenseCategoryName(pr);
      const lastPaymentDate = pr.paid_at || pr.approved_at || pr.created_at;
      const nextPaymentDate = calculateNextPaymentDate(lastPaymentDate, pr.recurring_frequency || undefined);

      combined.push({
        id: pr.id,
        organization_id: pr.organization_id,
        expense_name: pr.request_title,
        amount: pr.amount_idr,
        expense_type: expenseTypeName,
        expense_type_id: pr.expense_type_id || undefined,
        category: expenseCategoryName,
        expense_category_id: pr.expense_category_id || undefined,
        department: pr.department_name || undefined,
        create_date: lastPaymentDate,
        is_recurring: true,
        recurring_frequency: pr.recurring_frequency || undefined,
        first_payment_date: undefined,
        next_payment_date: nextPaymentDate,
        description: pr.description,
        receipt_url: pr.invoice_file_path || undefined,
        status: "active",
        created_by: pr.created_by,
        created_at: pr.created_at,
        updated_at: pr.updated_at,
        bill_source: "purchase_request",
      } as Expense);
    });

    return combined.sort((a, b) => {
      const dateA = a.next_payment_date ? new Date(a.next_payment_date).getTime() : new Date(a.create_date).getTime();
      const dateB = b.next_payment_date ? new Date(b.next_payment_date).getTime() : new Date(b.create_date).getTime();
      return dateA - dateB;
    });
  }, [expensesWithNextPayment, paidRecurringPurchaseRequests, expenseTypes, allExpenseCategories]);

  return {
    allBills,
    isLoading: expensesLoading || purchaseRequestsLoading,
    refetch,
  };
}

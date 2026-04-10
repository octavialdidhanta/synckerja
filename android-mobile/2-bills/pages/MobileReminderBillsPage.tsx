import { MobileExpensesShell } from "@/mobile/2-expense/pages/MobileExpensesShell";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useMemo, useState } from "react";
import { useExpenses } from "@/shared/hooks/finance/useExpenses";
import { usePurchaseRequests } from "@/9-request-form/hooks/usePurchaseRequests";
import { ReminderBillsTable } from "@/4-2-reminder-bills/section/ReminderBillsTable";
import { ReminderBillDeleteDialog, ReminderBillDetailDialog } from "@/4-2-reminder-bills/components/ReminderBillsActionModals";

export default function MobileReminderBillsPage() {
  const { t } = useAppTranslation();
  const { expenses, isLoading, deleteExpense } = useExpenses();
  const { data: purchaseRequests = [] } = usePurchaseRequests();
  const [detailBill, setDetailBill] = useState<any>(null);
  const [deleteBill, setDeleteBill] = useState<any>(null);

  const bills = useMemo(() => {
    // Keep parity with desktop: only recurring, not excluded.
    const base = (expenses ?? []).filter((e) => e.is_recurring && !e.exclude_from_reminder_bills);
    // Note: desktop also merges paid recurring purchase requests; keep minimal parity by including any recurring paid PR.
    const paidRecurringPR = purchaseRequests.filter(
      (pr) => pr.is_recurring && (pr.paid_at || pr.payment_status === "paid"),
    );
    const prAsBills = paidRecurringPR.map((pr) => ({
      id: pr.id,
      organization_id: pr.organization_id,
      expense_name: pr.request_title,
      amount: pr.amount_idr,
      expense_type: (pr as any).expense_types?.name ?? "Purchase",
      expense_type_id: pr.expense_type_id || undefined,
      category: (pr as any).expense_categories?.name ?? pr.request_type ?? "Purchase",
      expense_category_id: pr.expense_category_id || undefined,
      department: pr.department_name || undefined,
      create_date: pr.paid_at || pr.approved_at || pr.created_at,
      is_recurring: true,
      recurring_frequency: pr.recurring_frequency || undefined,
      next_payment_date: undefined,
      description: pr.description,
      receipt_url: pr.invoice_file_path || undefined,
      status: "active",
      created_by: pr.created_by,
      created_at: pr.created_at,
      updated_at: pr.updated_at,
      bill_source: "purchase_request" as const,
    }));
    return [...base, ...prAsBills];
  }, [expenses, purchaseRequests]);

  return (
    <MobileExpensesShell
      title={t("expenses.pageTitle", "Expense")}
      subtitle={t("expenses.pageSubtitle", "Expense dashboard")}
      initialTab="bills"
    >
      <div className="w-full">
        <ReminderBillsTable
          bills={bills as any}
          isLoading={isLoading}
          onViewDetails={(bill) => setDetailBill(bill)}
          onEdit={() => {}}
          onDelete={(bill) => setDeleteBill(bill)}
        />
      </div>

      <ReminderBillDetailDialog bill={detailBill} open={!!detailBill} onOpenChange={(o) => !o && setDetailBill(null)} />
      <ReminderBillDeleteDialog
        open={!!deleteBill}
        onOpenChange={(o) => !o && setDeleteBill(null)}
        onConfirm={async () => {
          if (!deleteBill) return;
          await deleteExpense(deleteBill.id);
          setDeleteBill(null);
        }}
      />
    </MobileExpensesShell>
  );
}


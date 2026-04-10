import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  useExpenses,
  type Expense,
  useExpenseTypes,
  useExpenseCategories,
} from "@/shared/hooks/finance";
import { usePurchaseRequests } from "@/9-request-form/hooks/usePurchaseRequests";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { buildAllReminderBills } from "@/4-2-reminder-bills/utils/buildAllReminderBills";
import { computeReminderBillsMetricStats } from "@/4-2-reminder-bills/utils/reminderBillsUtils";
import type { ReminderBillsFiltersType } from "@/4-2-reminder-bills/section/ReminderBillsFilters";
import { ReminderBillDetailDialog, ReminderBillDeleteDialog } from "@/4-2-reminder-bills/components/ReminderBillsActionModals";
import { ReminderBillPayNowModal } from "@/4-2-reminder-bills/components/ReminderBillPayNowModal";
import { ExpenseDashboardRefreshContext } from "@/mobile/2-expense/ExpenseDashboardRefreshContext";
import { BillsDashboardCarousel } from "@/mobile/2-bills/section/bills/BillsDashboardCarousel";
import { BillsTableSection, MOBILE_BILLS_DEFAULT_FILTERS } from "@/mobile/2-bills/section/bills/BillsTableSection";

export function BillsTabContent() {
  const { t } = useAppTranslation();
  const navigate = useNavigate();
  const refreshContext = useContext(ExpenseDashboardRefreshContext);
  const refetchRef = refreshContext?.refetchRef;

  const [filters, setFilters] = useState<ReminderBillsFiltersType>({ ...MOBILE_BILLS_DEFAULT_FILTERS });
  const [detailBill, setDetailBill] = useState<Expense | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [deleteBillId, setDeleteBillId] = useState<string | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isPayNowModalOpen, setIsPayNowModalOpen] = useState(false);
  const [selectedPayNowBill, setSelectedPayNowBill] = useState<Expense | null>(null);

  const {
    expenses = [],
    isLoading: expensesLoading,
    isPending: expensesPending,
    isFetched: expensesFetched,
    refetch,
    dismissReminderBillFromList,
  } = useExpenses();
  const {
    data: purchaseRequests = [],
    isLoading: purchaseRequestsLoading,
    isPending: purchaseRequestsPending,
    isFetched: purchaseRequestsFetched,
  } = usePurchaseRequests();
  const {
    expenseTypes,
    isLoading: expenseTypesLoading,
    isPending: expenseTypesPending,
    isFetched: expenseTypesFetched,
  } = useExpenseTypes();
  const {
    expenseCategories: allExpenseCategories,
    isLoading: allExpenseCategoriesLoading,
    isPending: allExpenseCategoriesPending,
    isFetched: expenseCategoriesFetched,
  } = useExpenseCategories();
  const { organizationId, loading: orgLoading } = useCurrentOrg();

  const dataPending =
    Boolean(organizationId) &&
    (!expensesFetched ||
      expensesLoading ||
      expensesPending ||
      !purchaseRequestsFetched ||
      purchaseRequestsLoading ||
      purchaseRequestsPending ||
      !expenseTypesFetched ||
      expenseTypesLoading ||
      expenseTypesPending ||
      !expenseCategoriesFetched ||
      allExpenseCategoriesLoading ||
      allExpenseCategoriesPending);
  const isLoading = orgLoading || dataPending;

  const allBills = useMemo(
    () => buildAllReminderBills(expenses, purchaseRequests, expenseTypes, allExpenseCategories),
    [expenses, purchaseRequests, expenseTypes, allExpenseCategories],
  );

  const metricStats = useMemo(() => computeReminderBillsMetricStats(expenses), [expenses]);

  const handleFilterChange = useCallback((key: keyof ReminderBillsFiltersType, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters({ ...MOBILE_BILLS_DEFAULT_FILTERS });
  }, []);

  const handleViewBill = useCallback((bill: Expense) => {
    setDetailBill(bill);
    setIsDetailOpen(true);
  }, []);

  const handleEditBill = useCallback(
    (bill: Expense) => {
      if (bill.bill_source === "purchase_request") {
        toast.message(t("reminderBills.editPurchaseRequestTitle", "Manage in Payment process"), {
          description: t(
            "reminderBills.editPurchaseRequestHint",
            "Edit or manage this bill from the Payment process page.",
          ),
        });
        navigate("/expenses/payment-process");
        return;
      }
      navigate("/expenses/dashboard", { state: { openExpenseEditId: bill.id } });
    },
    [navigate, t],
  );

  const handleDeleteBill = useCallback(
    (bill: Expense) => {
      if (bill.bill_source === "purchase_request") {
        toast.info(
          t(
            "reminderBills.cannotDeletePurchaseRequestBill",
            "Bills from purchase requests cannot be removed here. Use the request or payment workflow.",
          ),
        );
        return;
      }
      setDeleteBillId(bill.id);
      setIsDeleteOpen(true);
    },
    [t],
  );

  const handlePayNow = useCallback((bill: Expense) => {
    setSelectedPayNowBill(bill);
    setIsPayNowModalOpen(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteBillId) return;
    const ok = await dismissReminderBillFromList(deleteBillId);
    if (ok) {
      setIsDeleteOpen(false);
      setDeleteBillId(null);
      await refetch();
    }
  }, [deleteBillId, dismissReminderBillFromList, refetch]);

  const handleRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  useEffect(() => {
    if (!refetchRef) return;
    refetchRef.current = async () => {
      await refetch();
    };
    return () => {
      refetchRef.current = null;
    };
  }, [refetchRef, refetch]);

  return (
    <>
      <BillsDashboardCarousel
        isLoading={isLoading}
        total={metricStats.total}
        dueThisWeek={metricStats.dueThisWeek}
        overdue={metricStats.overdue}
        completed={metricStats.completed}
        totalAmount={metricStats.totalAmount}
        dueThisWeekAmount={metricStats.dueThisWeekAmount}
        overdueAmount={metricStats.overdueAmount}
        completedAmount={metricStats.completedAmount}
      />
      <BillsTableSection
        allBills={allBills}
        filters={filters}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
        isLoading={isLoading}
        onViewDetails={handleViewBill}
        onEdit={handleEditBill}
        onDelete={handleDeleteBill}
        onPayNow={handlePayNow}
        onRefresh={handleRefresh}
      />

      <ReminderBillDetailDialog bill={detailBill} open={isDetailOpen} onOpenChange={setIsDetailOpen} />
      <ReminderBillDeleteDialog
        open={isDeleteOpen}
        onOpenChange={(open) => {
          setIsDeleteOpen(open);
          if (!open) setDeleteBillId(null);
        }}
        onConfirm={handleConfirmDelete}
      />
      <ReminderBillPayNowModal
        open={isPayNowModalOpen}
        onOpenChange={(next) => {
          setIsPayNowModalOpen(next);
          if (!next) setSelectedPayNowBill(null);
        }}
        bill={selectedPayNowBill}
      />
    </>
  );
}

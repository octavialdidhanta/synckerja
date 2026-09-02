import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ReminderBillsFilters,
  ReminderBillsMetricsCards,
  ReminderBillsTable,
  ReminderBillsOverview,
  ReminderBillsSidebarFooter,
  type ReminderBillsFiltersType
} from '../section';
import {
  useExpenses,
  type Expense,
  useExpenseTypes,
  useExpenseCategories,
} from '@/shared/hooks/finance';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { ReminderBillDetailDialog, ReminderBillDeleteDialog } from '../components/ReminderBillsActionModals';
import { ReminderBillPayNowModal } from '../components/ReminderBillPayNowModal';
import { usePurchaseRequests } from '@/9-request-form/hooks/usePurchaseRequests';
import { filterReminderBills } from '../utils/reminderBillsUtils';
import { buildAllReminderBills } from '../utils/buildAllReminderBills';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useDebouncedReady } from '@/shared/hooks/useDebouncedReady';
import { ReminderBillsModuleShell } from '../layout/ReminderBillsModuleShell';
import { ReminderBillsWorkspace } from '../layout/ReminderBillsWorkspace';

export const ReminderBillsPage = () => {
  const { t } = useAppTranslation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('reminder-bills');
  const [detailBill, setDetailBill] = useState<Expense | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [deleteBillId, setDeleteBillId] = useState<string | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isPayNowModalOpen, setIsPayNowModalOpen] = useState(false);
  const [selectedPayNowBill, setSelectedPayNowBill] = useState<Expense | null>(null);
  const [filters, setFilters] = useState<ReminderBillsFiltersType>({
    search: '',
    status: 'all',
    category: 'all',
    department: 'all',
    period: 'all',
  });

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

  /** Tanpa `isFetching` agar refetch latar tidak membuka skeleton penuh. Kategori pakai React Query (bukan useEffect ganda). */
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
  const rawPendingLoad = orgLoading || dataPending;
  const showContent = useDebouncedReady(!rawPendingLoad, 280);

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
  }, []);

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const allBills = useMemo(
    () => buildAllReminderBills(expenses, purchaseRequests, expenseTypes, allExpenseCategories),
    [expenses, purchaseRequests, expenseTypes, allExpenseCategories],
  );

  const filteredBills = useMemo(() => {
    return filterReminderBills(allBills, filters);
  }, [allBills, filters]);

  const handleFilterChange = useCallback((key: keyof ReminderBillsFiltersType, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters({
      search: '',
      status: 'all',
      category: 'all',
      department: 'all',
      period: 'all',
    });
  }, []);

  const handleViewBill = useCallback((bill: Expense) => {
    setDetailBill(bill);
    setIsDetailOpen(true);
  }, []);

  const handleEditBill = useCallback(
    (bill: Expense) => {
      if (bill.bill_source === 'purchase_request') {
        toast.message(
          t('reminderBills.editPurchaseRequestTitle', 'Manage in Payment process'),
          {
            description: t(
              'reminderBills.editPurchaseRequestHint',
              'Edit or manage this bill from the Payment process page.'
            ),
          }
        );
        navigate('/expenses/payment-process');
        return;
      }
      navigate('/expenses/dashboard', { state: { openExpenseEditId: bill.id } });
    },
    [navigate, t]
  );

  const handleDeleteBill = useCallback(
    (bill: Expense) => {
      if (bill.bill_source === 'purchase_request') {
        toast.info(
          t(
            'reminderBills.cannotDeletePurchaseRequestBill',
            'Bills from purchase requests cannot be removed here. Use the request or payment workflow.'
          )
        );
        return;
      }
      setDeleteBillId(bill.id);
      setIsDeleteOpen(true);
    },
    [t]
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
      refetch();
    }
  }, [deleteBillId, dismissReminderBillFromList, refetch]);

  const totalAmount = useMemo(() => {
    return filteredBills.reduce((sum, bill) => sum + bill.amount, 0);
  }, [filteredBills]);

  return (
    <>
      <ReminderBillsModuleShell
        activeTab={activeTab}
        onTabChange={handleTabChange}
        showContent={showContent}
      >
        <ReminderBillsWorkspace
          count={filteredBills.length}
          toolbar={
            <>
              <div className="shrink-0 rounded-md border border-border bg-card p-2">
                <ReminderBillsFilters
                  filters={filters}
                  onFilterChange={handleFilterChange}
                  onClearFilters={handleClearFilters}
                />
              </div>

              <div className="shrink-0 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <ReminderBillsMetricsCards expenses={expenses} />
              </div>
            </>
          }
          sidebar={
            <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
              <div className="shrink-0 border-b border-border px-4 py-1.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-foreground">Bills Overview</h3>
                    <p className="mt-1 text-xs text-muted-foreground">Summary of recurring bills</p>
                  </div>
                </div>
              </div>

              <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <ReminderBillsOverview bills={filteredBills} />
              </div>

              <ReminderBillsSidebarFooter
                totalBills={filteredBills.length}
                totalAmount={totalAmount}
              />
            </div>
          }
        >
          <ReminderBillsTable
            bills={filteredBills}
            onRefresh={handleRefresh}
            isLoading={expensesLoading || purchaseRequestsLoading}
            onViewDetails={handleViewBill}
            onEdit={handleEditBill}
            onDelete={handleDeleteBill}
            onPayNow={handlePayNow}
          />
        </ReminderBillsWorkspace>
      </ReminderBillsModuleShell>

      <ReminderBillDetailDialog
        bill={detailBill}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
      />
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
};

export default ReminderBillsPage;

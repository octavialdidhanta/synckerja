import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ReminderBillsFilters,
  ReminderBillsMetricsCards,
  ReminderBillsTable,
  ReminderBillsTableFooter,
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
import { usePurchaseRequests, PurchaseRequest } from '@/9-request-form/hooks/usePurchaseRequests';
import { filterReminderBills, calculateNextPaymentDate } from '../utils/reminderBillsUtils';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useDebouncedReady } from '@/shared/hooks/useDebouncedReady';
import { ReminderBillsModuleShell } from '../layout/ReminderBillsModuleShell';

/** Selaras Seamless Page Scroll + `/expenses/payment-process`: header ikut scroll, `px-4` di luar scroll. */
const REMINDER_BILLS_MAIN_GRID =
  'grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch [@media(max-height:900px)]:min-h-[640px] [@media(max-height:900px)]:flex-none [@media(max-height:760px)]:min-h-[700px] xl:grid-rows-1 xl:items-stretch';

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
    department: 'all'
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

  const paidRecurringPurchaseRequests = useMemo(() => {
    return purchaseRequests.filter(req =>
      req.status === 'approved' &&
      (req.paid_at || req.payment_status === 'paid') &&
      req.is_recurring === true &&
      req.recurring_frequency
    );
  }, [purchaseRequests]);

  const getExpenseTypeName = (pr: PurchaseRequest): string => {
    if (pr.expense_types?.name) {
      return pr.expense_types.name;
    }
    if (pr.expense_type_id && expenseTypes.length > 0) {
      const expenseType = expenseTypes.find(et => et.id === pr.expense_type_id);
      if (expenseType) return expenseType.name;
    }
    return 'Uncategorized';
  };

  const getExpenseCategoryName = (pr: PurchaseRequest): string => {
    if (pr.expense_categories?.name) {
      return pr.expense_categories.name;
    }
    if (pr.expense_category_id && allExpenseCategories.length > 0) {
      const expenseCategory = allExpenseCategories.find(ec => ec.id === pr.expense_category_id);
      if (expenseCategory) return expenseCategory.name;
    }
    return pr.request_type || 'Purchase';
  };

  const expensesWithNextPayment = useMemo(() => {
    return expenses
      .filter((expense) => !expense.exclude_from_reminder_bills)
      .map(expense => {
        if (expense.is_recurring && expense.recurring_frequency && !expense.next_payment_date) {
          const nextPaymentDate = calculateNextPaymentDate(expense.create_date, expense.recurring_frequency);
          return {
            ...expense,
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
              next_payment_date: nextPaymentDate || expense.next_payment_date,
            };
          }
        }

        return expense;
      });
  }, [expenses]);

  const allBills = useMemo(() => {
    const combined: Expense[] = expensesWithNextPayment.map((e) => ({
      ...e,
      bill_source: e.bill_source ?? 'expense',
    }));

    paidRecurringPurchaseRequests.forEach(pr => {
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
        status: 'active',
        created_by: pr.created_by,
        created_at: pr.created_at,
        updated_at: pr.updated_at,
        bill_source: 'purchase_request',
      } as Expense);
    });

    return combined.sort((a, b) => {
      const dateA = a.next_payment_date ? new Date(a.next_payment_date).getTime() : new Date(a.create_date).getTime();
      const dateB = b.next_payment_date ? new Date(b.next_payment_date).getTime() : new Date(b.create_date).getTime();
      return dateA - dateB;
    });
  }, [expensesWithNextPayment, paidRecurringPurchaseRequests, expenseTypes, allExpenseCategories]);

  const recurringBills = useMemo(() => {
    return allBills.filter(expense => expense.is_recurring);
  }, [allBills]);

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
      department: 'all'
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
        <div className={REMINDER_BILLS_MAIN_GRID}>
          <div className="col-span-12 flex h-full min-w-0 flex-col xl:col-span-9">
            <div className="flex h-full min-w-0 flex-1 flex-col gap-2">
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

              <div className="flex min-h-[560px] min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm [@media(max-height:900px)]:min-h-[620px] [@media(max-height:760px)]:min-h-[680px]">
                <ReminderBillsTable
                  bills={filteredBills}
                  onRefresh={handleRefresh}
                  isLoading={expensesLoading || purchaseRequestsLoading}
                  onViewDetails={handleViewBill}
                  onEdit={handleEditBill}
                  onDelete={handleDeleteBill}
                  onPayNow={handlePayNow}
                />
                <ReminderBillsTableFooter
                  totalBills={recurringBills.length}
                  filteredBills={filteredBills.length}
                  totalAmount={totalAmount}
                  selectedStatus={filters.status}
                />
              </div>
            </div>
          </div>

          <div className="col-span-12 flex h-full min-w-0 flex-col xl:col-span-3">
            <div className="flex h-full min-w-0 flex-1 flex-col rounded-lg border border-border bg-card shadow-sm">
              <div className="shrink-0 border-b border-border px-4 py-1.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-foreground">Bills Overview</h3>
                    <p className="mt-1 text-xs text-muted-foreground">Summary of recurring bills</p>
                  </div>
                </div>
              </div>

              <div className="min-h-0 min-w-0 flex-1 p-4">
                <ReminderBillsOverview bills={filteredBills} />
              </div>

              <ReminderBillsSidebarFooter
                totalBills={filteredBills.length}
                totalAmount={totalAmount}
                selectedStatus={filters.status}
              />
            </div>
          </div>
        </div>
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

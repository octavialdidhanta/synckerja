import { useState, useMemo, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/shared/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Textarea } from '@/shared/components/ui/textarea';
import { Calendar } from '@/shared/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/shared/components/ui/command';
import { Badge } from '@/shared/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/shared/components/ui/tabs';
import { Plus, Search, Calendar as CalendarIcon, ChevronDown, MoreHorizontal, Receipt, Eye, Pencil, Trash2, Upload, FilterX, DollarSign, CheckCircle } from 'lucide-react';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays, subMonths, subYears } from 'date-fns';
import { cn } from '@/shared/lib/utils';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  useExpenses,
  type CreateExpenseData,
  type UpdateExpenseData,
  useExpenseTypes,
  useExpenseCategories,
  type Expense,
} from '@/shared/hooks/finance';
import { addExpenseSchema, AddExpenseFormData, RECURRING_FREQUENCIES } from './AddExpenseForm';
import { useDepartmentsCrud } from '@/shared/hooks/crudMaster/useDepartmentsCrud';
import { useOrgBootstrapPending } from '@/shared/auth/hooks/useOrgBootstrapPending';
import { DepartmentCrudModal } from './DepartmentCrudModal';
import { ExpenseTypeCrudModal } from './ExpenseTypeCrudModal';
import { ExpenseCategoryCrudModal } from './ExpenseCategoryCrudModal';
import { usePurchaseRequests, PurchaseRequest } from '@/9-request-form/hooks/usePurchaseRequests';
import { ExpenseTableFooter } from './ExpenseTableFooter';
import { filterExpensesBySearch, getExpenseWithdrawalLabel } from '@/shared/hooks/finance/expenseTableSearch';
import { aggregateExpenseTotalsByKey, sortedBreakdownEntries } from '@/shared/hooks/finance/expenseBreakdownBars';
import { supabase } from '@/shared/lib/supabaseClient';
import { openSupabaseFinanceReceiptOrInvoice } from '@/shared/utils/openSupabaseSignedFile';
import { AttendanceDateRangePicker } from '@/shared/calendar/AttendanceDateRangePicker';
import { Link } from 'react-router-dom';
import { IncomeAllocationOptionalSection } from '@/4-1-dashboard/components/IncomeAllocationOptionalSection';
import { useDebouncedReady } from '@/shared/hooks/useDebouncedReady';
import { useModulePageOverlaySkeleton } from '@/shared/auth/page-access/useModulePageOverlaySkeleton';
import { WithdrawalFromBalanceSelect } from '@/shared/components/finance/WithdrawalFromBalanceSelect';
import {
  applyWithdrawalSourceToFormFields,
  hasWithdrawalFormFields,
  withdrawalSourceFromFormFields,
} from '@/shared/lib/finance/withdrawalSourceValue';
import { useWithdrawalFromBalanceOptions } from '@/shared/hooks/finance/useWithdrawalFromBalanceOptions';
import { ExpenseDashboardModuleShell } from '../layout/ExpenseDashboardModuleShell';

async function handleViewInvoice(filePath: string | null | undefined) {
  const result = await openSupabaseFinanceReceiptOrInvoice(filePath, 3600);
  if (result.ok) return;
  if (result.reason === 'missing_path') {
    toast.error('Invoice file path not found');
    return;
  }
  console.error('Error creating signed URL:', result.error);
  toast.error('Failed to open invoice. Please try again.');
}

function matchesWithdrawalFilter(expense: Expense, withdrawalFilter: string): boolean {
  if (!withdrawalFilter || withdrawalFilter === 'all-withdrawal') return true;

  const debtIdFromExpense =
    expense.withdrawal_from_balance || expense.withdrawal_from_balance_debt?.id || '';
  const bankIdFromExpense =
    expense.bank_account_id || expense.withdrawal_from_balance_bank_account?.id || '';
  const gatewayProvider = expense.gateway_wallet_provider;

  if (withdrawalFilter === 'none') {
    return !debtIdFromExpense && !bankIdFromExpense && !gatewayProvider;
  }

  if (withdrawalFilter.startsWith('gateway_')) {
    const provider = withdrawalFilter.replace('gateway_', '');
    return gatewayProvider === provider;
  }

  if (withdrawalFilter.startsWith('debt_')) {
    const debtId = withdrawalFilter.replace('debt_', '');
    return debtIdFromExpense === debtId;
  }

  if (withdrawalFilter.startsWith('bank_')) {
    const bankId = withdrawalFilter.replace('bank_', '');
    // Legacy safety: older rows may have stored bank source in withdrawal_from_balance.
    const legacyBankId =
      expense.withdrawal_from_balance_bank_account?.id ? '' : expense.withdrawal_from_balance || '';
    return bankIdFromExpense === bankId || legacyBankId === bankId;
  }

  return true;
}

/** Paid purchase requests merged into the expense table must carry the same withdrawal fields as real expenses or debt/bank filters hide every PR row. */
function withdrawalJoinsFromPurchaseRequest(
  pr: PurchaseRequest,
  debts: { id: string; debt_name: string }[],
  banks: { id: string; name: string }[],
): Pick<
  Expense,
  | 'withdrawal_from_balance'
  | 'bank_account_id'
  | 'withdrawal_from_balance_debt'
  | 'withdrawal_from_balance_bank_account'
  | 'gateway_wallet_provider'
> {
  const debtId = pr.withdrawal_from_balance?.trim() || '';
  const bankId = pr.bank_account_id?.trim() || '';
  const gateway = pr.gateway_wallet_provider;
  const debtMeta = debtId ? debts.find((d) => d.id === debtId) : undefined;
  const bankMeta = bankId ? banks.find((b) => b.id === bankId) : undefined;
  return {
    withdrawal_from_balance: debtId || undefined,
    bank_account_id: bankId || undefined,
    gateway_wallet_provider:
      gateway === 'xendit' || gateway === 'brick' ? gateway : undefined,
    withdrawal_from_balance_debt:
      debtId && debtMeta
        ? { id: debtMeta.id, debt_name: debtMeta.debt_name }
        : debtId
          ? { id: debtId, debt_name: '—' }
          : undefined,
    withdrawal_from_balance_bank_account:
      bankId && bankMeta
        ? { id: bankMeta.id, name: bankMeta.name }
        : bankId
          ? { id: bankId, name: '—' }
          : undefined,
  };
}

/** Grid konten utama + spacer bawah sebagai saudara grid (Seamless Page Scroll — selaras IncomeTransaction / `/expenses/debt`). */
const EXPENSE_DASHBOARD_MAIN_GRID =
  'grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-1 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch [@media(max-height:900px)]:min-h-[640px] [@media(max-height:900px)]:flex-none [@media(max-height:760px)]:min-h-[700px]';

export function ExpenseDashboard() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [breakdownTab, setBreakdownTab] = useState<'overview' | 'category'>('overview');
  const [dateFilter, setDateFilter] = useState<string>('this-month');
  const [isCustomDatePickerOpen, setIsCustomDatePickerOpen] = useState(false);
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>();
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>();
  const [expenseTypeFilter, setExpenseTypeFilter] = useState<string>('all-types');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all-depts');
  const [categoryFilter, setCategoryFilter] = useState<string>('all-categories');
  const [categoryFilterOpen, setCategoryFilterOpen] = useState(false);
  const [withdrawalFilter, setWithdrawalFilter] = useState<string>('all-withdrawal');
  const { t } = useAppTranslation();

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
  };

  const handleRefreshFilters = () => {
    setDateFilter('this-month');
    setCustomStartDate(undefined);
    setCustomEndDate(undefined);
    setExpenseTypeFilter('all-types');
    setDepartmentFilter('all-depts');
    setCategoryFilter('all-categories');
    setCategoryFilterOpen(false);
    setWithdrawalFilter('all-withdrawal');
    setSearchQuery('');
  };

  const { organizationId, orgBootstrapPending } = useOrgBootstrapPending();
  const location = useLocation();
  const navigate = useNavigate();
  const {
    expenses,
    isLoading: expensesLoading,
    isPending: expensesPending,
    isCreating,
    isUpdating,
    createExpense,
    updateExpense,
    deleteExpense,
  } = useExpenses();
  const {
    data: departments = [],
    isLoading: departmentsLoading,
    isPending: departmentsPending,
    refetch: refetchDepartments,
  } = useDepartmentsCrud(organizationId);
  const {
    expenseTypes,
    isLoading: expenseTypesLoading,
    isPending: expenseTypesPending,
    refetch: refetchExpenseTypes,
  } = useExpenseTypes();
  const {
    data: purchaseRequests = [],
    isLoading: isLoadingPurchaseRequests,
    isPending: isPendingPurchaseRequests,
  } = usePurchaseRequests();
  const {
    expenseCategories: allExpenseCategories,
    isLoading: allExpenseCategoriesLoading,
    isPending: allExpenseCategoriesPending,
  } = useExpenseCategories();
  const {
    loading: withdrawalOptionsLoading,
    debtsForExpense,
    bankAccounts,
    bankAccountBalances,
    gateways,
    refetchBalances,
  } = useWithdrawalFromBalanceOptions({ autoSync: false });

  const dataPending =
    Boolean(organizationId) &&
    (expensesLoading ||
      expensesPending ||
      expenseTypesLoading ||
      expenseTypesPending ||
      departmentsLoading ||
      departmentsPending ||
      isPendingPurchaseRequests ||
      isLoadingPurchaseRequests ||
      withdrawalOptionsLoading ||
      allExpenseCategoriesLoading ||
      allExpenseCategoriesPending);
  const rawPendingLoad = orgBootstrapPending || dataPending;
  const { showFullPageSkeleton, accessReady } = useModulePageOverlaySkeleton(
    rawPendingLoad,
    location.pathname,
  );
  const showContent = useDebouncedReady(accessReady && !showFullPageSkeleton, 220);

  // Filter purchase requests that are paid/berhasil
  const paidPurchaseRequests = purchaseRequests.filter(req => 
    req.status === 'approved' && 
    (req.paid_at || req.payment_status === 'paid')
  );
  
  // Helper function to get expense type name
  const getExpenseTypeName = (pr: PurchaseRequest): string => {
    // First try to get from joined expense_types (this is the most reliable)
    if (pr.expense_types?.name) {
      return pr.expense_types.name;
    }
    
    // If join failed but expense_type_id exists, try to find in expenseTypes array
    // This is a fallback in case the join query doesn't work properly
    if (pr.expense_type_id && expenseTypes.length > 0) {
      const expenseType = expenseTypes.find(et => et.id === pr.expense_type_id);
      if (expenseType) {
        console.log('Found expense type from expenseTypes array:', expenseType.name);
        return expenseType.name;
      } else {
        console.warn('Expense type ID exists but not found in expenseTypes array:', {
          expense_type_id: pr.expense_type_id,
          available_types: expenseTypes.map(et => ({ id: et.id, name: et.name }))
        });
      }
    }
    
    // Log warning if expense_type_id is missing
    if (!pr.expense_type_id) {
      console.warn('Purchase request missing expense_type_id:', {
        id: pr.id,
        request_title: pr.request_title,
        expense_types: pr.expense_types
      });
    }
    
    // Fallback to 'Uncategorized'
    return 'Uncategorized';
  };
  
  // Helper function to get expense category name
  const getExpenseCategoryName = (pr: PurchaseRequest): string => {
    // First try to get from joined expense_categories (this is the most reliable)
    if (pr.expense_categories?.name) {
      return pr.expense_categories.name;
    }
    
    // If join failed but expense_category_id exists, try to find in allExpenseCategories array
    if (pr.expense_category_id && allExpenseCategories.length > 0) {
      const expenseCategory = allExpenseCategories.find(ec => ec.id === pr.expense_category_id);
      if (expenseCategory) {
        console.log('Found expense category from allExpenseCategories array:', expenseCategory.name);
        return expenseCategory.name;
      } else {
        console.warn('Expense category ID exists but not found in allExpenseCategories array:', {
          expense_category_id: pr.expense_category_id,
          available_categories: allExpenseCategories.map(ec => ({ id: ec.id, name: ec.name }))
        });
      }
    }
    
    // Log warning if expense_category_id is missing
    if (!pr.expense_category_id) {
      console.warn('Purchase request missing expense_category_id:', {
        id: pr.id,
        request_title: pr.request_title,
        expense_categories: pr.expense_categories,
        expense_type_id: pr.expense_type_id
      });
    }
    
    // Fallback to request_type or 'Purchase'
    return pr.request_type || 'Purchase';
  };
  
  // Get date range based on filter selection
  const getDateRange = useMemo(() => {
    const now = new Date();
    
    switch (dateFilter) {
      case 'today':
        return {
          start: startOfDay(now),
          end: endOfDay(now)
        };
      case 'yesterday':
        const yesterday = subDays(now, 1);
        return {
          start: startOfDay(yesterday),
          end: endOfDay(yesterday)
        };
      case 'this-week':
        return {
          start: startOfWeek(now, { weekStartsOn: 1 }),
          end: endOfWeek(now, { weekStartsOn: 1 })
        };
      case 'this-month':
        return {
          start: startOfMonth(now),
          end: endOfMonth(now)
        };
      case 'last-month':
        const lastMonth = subMonths(now, 1);
        return {
          start: startOfMonth(lastMonth),
          end: endOfMonth(lastMonth)
        };
      case '3-months-ago':
        const threeMonthsAgo = subMonths(now, 3);
        return {
          start: startOfMonth(threeMonthsAgo),
          end: endOfMonth(threeMonthsAgo)
        };
      case '6-months-ago':
        const sixMonthsAgo = subMonths(now, 6);
        return {
          start: startOfMonth(sixMonthsAgo),
          end: endOfMonth(sixMonthsAgo)
        };
      case 'this-year':
        return {
          start: startOfYear(now),
          end: endOfYear(now)
        };
      case 'last-year':
        const lastYear = subYears(now, 1);
        return {
          start: startOfYear(lastYear),
          end: endOfYear(lastYear)
        };
      case 'custom':
        if (customStartDate && customEndDate) {
          return {
            start: startOfDay(customStartDate),
            end: endOfDay(customEndDate)
          };
        }
        return null;
      case 'all-dates':
      default:
        return null; // No filter, show all
    }
  }, [dateFilter, customStartDate, customEndDate]);

  // Helper function to calculate next payment date for recurring expenses
  const calculateNextPaymentDate = (
    lastPaymentDate: string,
    recurringFrequency: string | undefined | null
  ): string | undefined => {
    if (!recurringFrequency) return undefined;
    
    // Normalize frequency to lowercase for case-insensitive comparison
    const normalizedFrequency = recurringFrequency.toLowerCase().trim();
    
    const lastPayment = new Date(lastPaymentDate);
    const nextPayment = new Date(lastPayment);
    
    switch (normalizedFrequency) {
      case 'daily':
        nextPayment.setDate(nextPayment.getDate() + 1);
        break;
      case 'weekly':
        nextPayment.setDate(nextPayment.getDate() + 7);
        break;
      case 'biweekly':
      case 'bi-weekly':
        nextPayment.setDate(nextPayment.getDate() + 14);
        break;
      case 'monthly':
        nextPayment.setMonth(nextPayment.getMonth() + 1);
        break;
      case 'quarterly':
        nextPayment.setMonth(nextPayment.getMonth() + 3);
        break;
      case 'semiannually':
      case 'semi-annually':
        nextPayment.setMonth(nextPayment.getMonth() + 6);
        break;
      case 'annually':
        nextPayment.setFullYear(nextPayment.getFullYear() + 1);
        break;
      default:
        console.warn('Unknown recurring frequency:', recurringFrequency);
        return undefined;
    }
    
    return nextPayment.toISOString().split('T')[0];
  };
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDepartmentCrudOpen, setIsDepartmentCrudOpen] = useState(false);
  const [isExpenseTypeCrudOpen, setIsExpenseTypeCrudOpen] = useState(false);
  const [isExpenseCategoryCrudOpen, setIsExpenseCategoryCrudOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [firstPaymentDate, setFirstPaymentDate] = useState<Date>();
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [selectedExpenseTypeId, setSelectedExpenseTypeId] = useState<string>('');
  const [amountDisplay, setAmountDisplay] = useState<string>('');
  const [isCreateDatePickerOpen, setIsCreateDatePickerOpen] = useState(false);
  const [isFirstPaymentDatePickerOpen, setIsFirstPaymentDatePickerOpen] = useState(false);
  const [incomeAllocIncomeId, setIncomeAllocIncomeId] = useState('');
  const [incomeAllocAmountStr, setIncomeAllocAmountStr] = useState('');
  const { expenseCategories, refetch: refetchExpenseCategories } = useExpenseCategories(selectedExpenseTypeId);

  const form = useForm<AddExpenseFormData>({
    resolver: zodResolver(addExpenseSchema),
    defaultValues: {
      expense_name: '',
      amount: undefined as any,
      expense_type: '',
      category: '',
      department: '',
      withdrawal_from_balance: undefined,
      bank_account_id: undefined,
      gateway_wallet_provider: undefined,
      create_date: format(new Date(), 'yyyy-MM-dd'),
      is_recurring: false,
      recurring_frequency: '',
      first_payment_date: '',
      linked_recurring_expense_id: '',
      description: '',
    },
  });

  const isRecurring = form.watch('is_recurring');
  const isEditMode = !!editingExpense;
  const isSubmittingExpense = isCreating || isUpdating;

  const emptyExpenseFormValues: AddExpenseFormData = {
    expense_name: '',
    amount: undefined as any,
    expense_type: '',
    category: '',
    department: '',
    withdrawal_from_balance: undefined,
    bank_account_id: undefined,
    gateway_wallet_provider: undefined,
    create_date: format(new Date(), 'yyyy-MM-dd'),
    is_recurring: false,
    recurring_frequency: '',
    first_payment_date: '',
    linked_recurring_expense_id: '',
    description: '',
  };

  const resetExpenseForm = () => {
    form.reset(emptyExpenseFormValues);
    setEditingExpense(null);
    setAmountDisplay('');
    setReceiptFile(null);
    setSelectedDate(undefined);
    setFirstPaymentDate(undefined);
    setSelectedExpenseTypeId('');
    setIsCreateDatePickerOpen(false);
    setIsFirstPaymentDatePickerOpen(false);
    setIncomeAllocIncomeId('');
    setIncomeAllocAmountStr('');
    form.setValue('withdrawal_from_balance', undefined);
    form.setValue('bank_account_id', undefined);
    form.setValue('gateway_wallet_provider', undefined);
  };

  const handleOpenAddExpense = () => {
    resetExpenseForm();
    setIsAddModalOpen(true);
  };

  const handleOpenEditExpense = (expense: Expense) => {
    const selectedTypeId = expenseTypes.find((type) => type.name === expense.expense_type)?.id || '';
    setEditingExpense(expense);
    setSelectedExpenseTypeId(selectedTypeId);
    setAmountDisplay(formatAmount(String(Math.round(expense.amount || 0))));
    setSelectedDate(expense.create_date ? new Date(expense.create_date) : undefined);
    setFirstPaymentDate(expense.first_payment_date ? new Date(expense.first_payment_date) : undefined);
    setReceiptFile(null);
    setIncomeAllocIncomeId('');
    setIncomeAllocAmountStr('');
    form.reset({
      expense_name: expense.expense_name || '',
      amount: expense.amount || (undefined as any),
      expense_type: expense.expense_type || '',
      category: expense.category || '',
      department: expense.department || '',
      withdrawal_from_balance: expense.withdrawal_from_balance || undefined,
      bank_account_id: expense.bank_account_id || undefined,
      gateway_wallet_provider: (expense as Expense & { gateway_wallet_provider?: 'xendit' | 'brick' }).gateway_wallet_provider || undefined,
      create_date: expense.create_date || format(new Date(), 'yyyy-MM-dd'),
      is_recurring: !!expense.is_recurring,
      recurring_frequency: expense.recurring_frequency || '',
      first_payment_date: expense.first_payment_date || '',
      linked_recurring_expense_id: '',
      description: expense.description || '',
    });
    setIsAddModalOpen(true);
  };

  const handleSubmit = async (data: AddExpenseFormData) => {
    // Validate available_limit for create flow only; edit is validated by DB trigger on delta.
    if (!isEditMode && data.withdrawal_from_balance && data.withdrawal_from_balance !== 'none') {
      const selectedDebt = debtsForExpense.find(d => d.id === data.withdrawal_from_balance);
      if (selectedDebt) {
        // Hook sudah menghitung available_limit dengan benar (termasuk fallback untuk Pinjaman Online)
        const availableLimit = selectedDebt.available_limit ?? 0;
        if (availableLimit < data.amount) {
          toast.error(`Insufficient available limit. Available: Rp ${availableLimit.toLocaleString('id-ID')}, Required: Rp ${data.amount.toLocaleString('id-ID')}`);
          return;
        }
      }
    }
    
    // Validate gateway drawer balance on create.
    if (!isEditMode && data.gateway_wallet_provider) {
      const gw = gateways.find((g) => g.provider === data.gateway_wallet_provider);
      const availableBalance = gw?.usableBalance ?? 0;
      if (availableBalance < data.amount) {
        toast.error(`Insufficient gateway balance. Available: Rp ${availableBalance.toLocaleString('id-ID')}, Required: Rp ${data.amount.toLocaleString('id-ID')}`);
        return;
      }
    }

    // Validate bank account balance with delta awareness for edit flow.
    if (data.bank_account_id) {
      const balance = bankAccountBalances.find(b => b.bank_account_id === data.bank_account_id);
      const availableBalance = balance?.balance ?? 0;
      let requiredAmount = data.amount;
      if (isEditMode && editingExpense?.bank_account_id === data.bank_account_id) {
        requiredAmount = Math.max(0, data.amount - (editingExpense.amount ?? 0));
      }
      if (availableBalance < requiredAmount) {
        toast.error(`Insufficient balance. Available: Rp ${availableBalance.toLocaleString('id-ID')}, Required: Rp ${requiredAmount.toLocaleString('id-ID')}`);
        return;
      }
    }

    // Find the selected expense type to get its ID
    const linkedRecurringRaw = (data.linked_recurring_expense_id ?? '').trim();
    if (data.is_recurring && linkedRecurringRaw) {
      if (!data.recurring_frequency?.trim() || !data.first_payment_date?.trim()) {
        toast.error('Select frequency and first payment date when paying an existing recurring bill.');
        return;
      }
    }

    const selectedExpenseType = expenseTypes.find(type => type.name === data.expense_type);
    
    let income_allocation: CreateExpenseData['income_allocation'];
    if (data.bank_account_id && incomeAllocIncomeId.trim()) {
      const raw = incomeAllocAmountStr.trim().replace(/\s/g, '').replace(/,/g, '.');
      const amt = parseFloat(raw);
      if (Number.isFinite(amt) && amt > 0) {
        income_allocation = { income_transaction_id: incomeAllocIncomeId.trim(), amount: amt };
      }
    }

    const expenseData: UpdateExpenseData = {
      expense_name: data.expense_name || '',
      amount: data.amount || 0,
      expense_type: data.expense_type || '',
      category: data.category || '',
      department: data.department,
      create_date: data.create_date || format(new Date(), 'yyyy-MM-dd'),
      is_recurring: data.is_recurring || false,
      recurring_frequency: data.recurring_frequency,
      first_payment_date: data.first_payment_date,
      description: data.description,
      receipt_file: receiptFile || undefined,
      withdrawal_from_balance: data.withdrawal_from_balance && data.withdrawal_from_balance !== 'none' 
        ? data.withdrawal_from_balance 
        : undefined,
      bank_account_id: data.bank_account_id || undefined,
      gateway_wallet_provider: data.gateway_wallet_provider || undefined,
      recurring_settlement_for_expense_id:
        data.is_recurring && linkedRecurringRaw ? linkedRecurringRaw : undefined,
      income_allocation,
    };

    const success = isEditMode && editingExpense
      ? await updateExpense(editingExpense.id, expenseData)
      : await createExpense(expenseData as CreateExpenseData);
    if (success) {
      // Refresh bank account balances after expense creation
      refetchBalances();
      setIsAddModalOpen(false);
      resetExpenseForm();
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File size must be less than 10MB');
        return;
      }
      
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        toast.error('Only JPG, PNG, WEBP, and PDF files are allowed');
        return;
      }
      
      setReceiptFile(file);
      toast.success('Receipt file selected');
    }
  };

  const handleViewDetails = (expense: Expense) => {
    setSelectedExpense(expense);
    setIsDetailModalOpen(true);
  };

  const handleDeleteClick = (expenseId: string) => {
    setExpenseToDelete(expenseId);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (expenseToDelete) {
      const success = await deleteExpense(expenseToDelete);
      if (success) {
        setIsDeleteDialogOpen(false);
        setExpenseToDelete(null);
      }
    }
  };

  useEffect(() => {
    const id = (location.state as { openExpenseEditId?: string } | null)?.openExpenseEditId;
    if (!id) return;
    if (expensesLoading) return;
    const expense = expenses.find((e) => e.id === id);
    if (expense) {
      handleOpenEditExpense(expense);
    } else {
      toast.error(t('reminderBills.expenseNotFound', 'Expense not found. It may have been removed.'));
    }
    navigate(`${location.pathname}${location.search}`, { replace: true, state: {} });
    // Intentionally omit handleOpenEditExpense: stable enough for one-shot navigation from reminder bills.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open edit once when state + expenses are ready
  }, [location.state, location.pathname, location.search, expenses, expensesLoading, navigate, t]);

  const formatCurrency = (amount: number) => {
    return `Rp ${amount.toLocaleString('id-ID')}`;
  };

  // Format amount with thousands separator (dot)
  const formatAmount = (value: string): string => {
    // Remove all non-numeric characters
    const numericValue = value.replace(/\D/g, '');
    
    if (!numericValue) return '';
    
    // Format with thousand separator (.)
    return numericValue.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  // Parse formatted amount back to number
  const parseAmount = (value: string): number => {
    // Remove all non-numeric characters (including thousand separators)
    const numericValue = parseFloat(value.replace(/\D/g, '')) || 0;
    return numericValue;
  };

  // Combine expenses with paid purchase requests for display
  const allExpenses = useMemo(() => {
    // Map regular expenses to include request_title and requester_name fields
    // Also recalculate next_payment_date for recurring expenses if missing or expired
    const mappedExpenses = expenses.map(expense => {
      let nextPaymentDate = expense.next_payment_date;
      
      // If expense is recurring but next_payment_date is missing or expired, recalculate it
      if (expense.is_recurring && expense.recurring_frequency) {
        if (!nextPaymentDate) {
          // Calculate from create_date if next_payment_date is missing
          nextPaymentDate = calculateNextPaymentDate(expense.create_date, expense.recurring_frequency);
        } else {
          // Check if next_payment_date has passed, if so, calculate next one
          const nextPayment = new Date(nextPaymentDate);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          if (nextPayment < today) {
            // Calculate next payment date from the last next_payment_date
            nextPaymentDate = calculateNextPaymentDate(nextPaymentDate, expense.recurring_frequency);
          }
        }
      }
      
      // For expenses created from payment-process, get requester from linked purchase request
      const linkedRequest = expense.purchase_request_id
        ? paidPurchaseRequests.find(pr => pr.id === expense.purchase_request_id)
        : undefined;
      
      return {
        ...expense,
        request_title: expense.expense_name, // For regular expenses, use expense_name as request_title
        requester_name: linkedRequest?.requester_name ?? undefined,
        next_payment_date: nextPaymentDate || expense.next_payment_date,
      };
    });
    
    const combined = [...mappedExpenses];
    
    // Add paid purchase requests that do NOT already have an expense (avoid duplicate rows)
    paidPurchaseRequests.forEach(pr => {
      const hasExpenseForRequest = expenses.some(e => e.purchase_request_id === pr.id);
      if (hasExpenseForRequest) return; // Skip: already shown as expense row
      // Get expense type name - this should be the actual name from expense_types table
      // like "Operating Expenses", "Fixed Expenses", "Variable Expenses", etc.
      const expenseTypeName = getExpenseTypeName(pr);
      
      // Get expense category name - this should be the actual name from expense_categories table
      const expenseCategoryName = getExpenseCategoryName(pr);
      
      // Calculate next payment date for recurring purchase requests
      const lastPaymentDate = pr.paid_at || pr.approved_at || pr.created_at;
      const nextPaymentDate = pr.is_recurring && pr.recurring_frequency
        ? calculateNextPaymentDate(lastPaymentDate, pr.recurring_frequency)
        : undefined;
      
      combined.push({
        id: pr.id,
        organization_id: pr.organization_id,
        expense_name: pr.request_title,
        amount: pr.amount_idr,
        // Use expense type name from expense_types table
        expense_type: expenseTypeName,
        expense_type_id: pr.expense_type_id || undefined,
        // Use expense category name from expense_categories table
        category: expenseCategoryName,
        expense_category_id: pr.expense_category_id || undefined,
        department: pr.department_name || undefined,
        create_date: lastPaymentDate,
        is_recurring: pr.is_recurring || false,
        recurring_frequency: pr.recurring_frequency || undefined,
        first_payment_date: undefined,
        next_payment_date: nextPaymentDate,
        description: pr.description,
        receipt_url: pr.invoice_file_path || undefined,
        status: 'active',
        created_by: pr.created_by,
        created_at: pr.created_at,
        updated_at: pr.updated_at,
        // Add purchase request specific fields
        request_title: pr.request_title,
        requester_name: pr.requester_name,
        ...withdrawalJoinsFromPurchaseRequest(pr, debtsForExpense, bankAccounts),
      } as Expense & { request_title?: string; requester_name?: string });
    });
    
    // Sort by date (newest first)
    const sorted = combined.sort((a, b) => {
      const dateA = new Date(a.create_date).getTime();
      const dateB = new Date(b.create_date).getTime();
      return dateB - dateA;
    });

    // Apply date filter if selected
    let filtered = sorted;
    if (getDateRange) {
      filtered = filtered.filter(expense => {
        const expenseDate = new Date(expense.create_date);
        const expenseTimestamp = expenseDate.getTime();
        const startTimestamp = getDateRange.start.getTime();
        const endTimestamp = getDateRange.end.getTime();
        return expenseTimestamp >= startTimestamp && expenseTimestamp <= endTimestamp;
      });
    }

    // Apply expense type filter if selected
    if (expenseTypeFilter && expenseTypeFilter !== 'all-types') {
      filtered = filtered.filter(expense => {
        return expense.expense_type === expenseTypeFilter;
      });
    }

    // Apply department filter if selected
    if (departmentFilter && departmentFilter !== 'all-depts') {
      filtered = filtered.filter(expense => {
        return expense.department === departmentFilter;
      });
    }

    // Apply expense category filter if selected
    if (categoryFilter && categoryFilter !== 'all-categories') {
      filtered = filtered.filter(expense => {
        return expense.expense_category_id === categoryFilter;
      });
    }

    // Apply withdrawal filter (debt/bank/none), including legacy fallback mapping.
    filtered = filtered.filter(expense => matchesWithdrawalFilter(expense, withdrawalFilter));

    return filtered;
  }, [
    expenses,
    paidPurchaseRequests,
    getDateRange,
    expenseTypeFilter,
    departmentFilter,
    categoryFilter,
    withdrawalFilter,
    debtsForExpense,
    bankAccounts,
  ]);

  // YTD = Year-To-Date: from January 1 of current year through today (independent of user date filter)
  const { totalExpensesYTD, ytdTransactionCount } = useMemo(() => {
    const now = new Date();
    const ytdStart = startOfYear(now);
    const ytdEnd = endOfDay(now);
    const ytdStartT = ytdStart.getTime();
    const ytdEndT = ytdEnd.getTime();
    let total = 0;
    let count = 0;
    expenses.forEach(exp => {
      const t = new Date(exp.create_date).getTime();
      if (t >= ytdStartT && t <= ytdEndT) {
        total += exp.amount;
        count += 1;
      }
    });
    paidPurchaseRequests.forEach(pr => {
      if (expenses.some(e => e.purchase_request_id === pr.id)) return;
      const lastPayment = pr.paid_at || pr.approved_at || pr.created_at;
      const t = new Date(lastPayment).getTime();
      if (t >= ytdStartT && t <= ytdEndT) {
        total += pr.amount_idr;
        count += 1;
      }
    });
    return { totalExpensesYTD: total, ytdTransactionCount: count };
  }, [expenses, paidPurchaseRequests]);

  // Data untuk tab "Expense Category" saja: filter date/type/dept, TANPA filter kategori.
  // Tab Expense Category tidak merespon filter kategori agar breakdown per kategori tetap tampil penuh.
  const allExpensesForCategoryBreakdown = useMemo(() => {
    const mappedExpenses = expenses.map(expense => {
      let nextPaymentDate = expense.next_payment_date;
      if (expense.is_recurring && expense.recurring_frequency) {
        if (!nextPaymentDate) {
          nextPaymentDate = calculateNextPaymentDate(expense.create_date, expense.recurring_frequency);
        } else {
          const nextPayment = new Date(nextPaymentDate);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (nextPayment < today) {
            nextPaymentDate = calculateNextPaymentDate(nextPaymentDate, expense.recurring_frequency);
          }
        }
      }
      const linkedRequest = expense.purchase_request_id
        ? paidPurchaseRequests.find(pr => pr.id === expense.purchase_request_id)
        : undefined;
      return {
        ...expense,
        request_title: expense.expense_name,
        requester_name: linkedRequest?.requester_name ?? undefined,
        next_payment_date: nextPaymentDate || expense.next_payment_date,
      };
    });
    const combined = [...mappedExpenses];
    paidPurchaseRequests.forEach(pr => {
      const hasExpenseForRequest = expenses.some(e => e.purchase_request_id === pr.id);
      if (hasExpenseForRequest) return;
      const expenseTypeName = getExpenseTypeName(pr);
      const expenseCategoryName = getExpenseCategoryName(pr);
      const lastPaymentDate = pr.paid_at || pr.approved_at || pr.created_at;
      const nextPaymentDate = pr.is_recurring && pr.recurring_frequency
        ? calculateNextPaymentDate(lastPaymentDate, pr.recurring_frequency)
        : undefined;
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
        is_recurring: pr.is_recurring || false,
        recurring_frequency: pr.recurring_frequency || undefined,
        first_payment_date: undefined,
        next_payment_date: nextPaymentDate,
        description: pr.description,
        receipt_url: pr.invoice_file_path || undefined,
        status: 'active',
        created_by: pr.created_by,
        created_at: pr.created_at,
        updated_at: pr.updated_at,
        request_title: pr.request_title,
        requester_name: pr.requester_name,
        ...withdrawalJoinsFromPurchaseRequest(pr, debtsForExpense, bankAccounts),
      } as Expense & { request_title?: string; requester_name?: string });
    });
    const sorted = combined.sort((a, b) => {
      const dateA = new Date(a.create_date).getTime();
      const dateB = new Date(b.create_date).getTime();
      return dateB - dateA;
    });
    let filtered = sorted;
    if (getDateRange) {
      filtered = filtered.filter(expense => {
        const expenseDate = new Date(expense.create_date);
        const expenseTimestamp = expenseDate.getTime();
        const startTimestamp = getDateRange.start.getTime();
        const endTimestamp = getDateRange.end.getTime();
        return expenseTimestamp >= startTimestamp && expenseTimestamp <= endTimestamp;
      });
    }
    if (expenseTypeFilter && expenseTypeFilter !== 'all-types') {
      filtered = filtered.filter(expense => expense.expense_type === expenseTypeFilter);
    }
    if (departmentFilter && departmentFilter !== 'all-depts') {
      filtered = filtered.filter(expense => expense.department === departmentFilter);
    }
    // Apply withdrawal filter so all sections respond consistently.
    filtered = filtered.filter(expense => matchesWithdrawalFilter(expense, withdrawalFilter));
    // Sengaja TIDAK menerapkan categoryFilter agar tab Expense Category selalu menampilkan breakdown semua kategori
    return filtered;
  }, [
    expenses,
    paidPurchaseRequests,
    getDateRange,
    expenseTypeFilter,
    departmentFilter,
    withdrawalFilter,
    debtsForExpense,
    bankAccounts,
  ]);

  const totalExpenses = allExpenses.reduce((sum, expense) => sum + expense.amount, 0);

  const tableFilteredExpenses = useMemo(
    () => filterExpensesBySearch(allExpenses, searchQuery),
    [allExpenses, searchQuery],
  );

  const categoryBreakdownFilteredExpenses = useMemo(
    () => filterExpensesBySearch(allExpensesForCategoryBreakdown, searchQuery),
    [allExpensesForCategoryBreakdown, searchQuery],
  );

  const tableFilteredTotal = useMemo(
    () => tableFilteredExpenses.reduce((sum, expense) => sum + expense.amount, 0),
    [tableFilteredExpenses],
  );

  const categoryBreakdownFilteredTotal = useMemo(
    () => categoryBreakdownFilteredExpenses.reduce((sum, expense) => sum + expense.amount, 0),
    [categoryBreakdownFilteredExpenses],
  );

  const breakdownHeaderTotal =
    breakdownTab === 'category' ? categoryBreakdownFilteredTotal : tableFilteredTotal;
  const currentMonthTotal = allExpenses
    .filter(expense => {
      const expenseDate = new Date(expense.create_date);
      const currentDate = new Date();
      return expenseDate.getMonth() === currentDate.getMonth() && 
             expenseDate.getFullYear() === currentDate.getFullYear();
    })
    .reduce((sum, expense) => sum + expense.amount, 0);

  // Calculate monthly data for chart
  const monthlyData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentYear = new Date().getFullYear();
    
    // Initialize all months with 0
    const monthlyTotals = months.map(month => ({
      month,
      amount: 0
    }));

    // Calculate totals for each month
    allExpenses.forEach(expense => {
      const expenseDate = new Date(expense.create_date);
      if (expenseDate.getFullYear() === currentYear) {
        const monthIndex = expenseDate.getMonth();
        monthlyTotals[monthIndex].amount += expense.amount;
      }
    });

    return monthlyTotals;
  }, [allExpenses]);

    const handleExpenseTypeChange = (value: string) => {
      form.setValue('expense_type', value);
      setSelectedExpenseTypeId(expenseTypes.find(type => type.name === value)?.id || '');
      // Reset category when expense type changes
      form.setValue('category', '');
    };

  return (
    <>
    <ExpenseDashboardModuleShell
      activeTab={activeTab}
      onTabChange={handleTabChange}
      showContent={showContent}
    >
      <div className={EXPENSE_DASHBOARD_MAIN_GRID}>
              <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
              {/* Quick View Total Current Balance - not affected by table filters; updates instantly when expense uses bank balance */}
              <div className="min-w-0 shrink-0">
                <Card className="w-full min-w-0 border-0 bg-brand-blue text-white">
        <CardContent className="p-3 min-w-0">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 min-w-0">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-white/20 rounded-lg flex-shrink-0">
                  <DollarSign className="h-4 w-4 text-white" />
                </div>
                <span className="text-sm font-medium text-white/90 truncate">{t('expenses.quickViewTotalBalance', 'Quick View Total Current Balance')}</span>
              </div>
              <Link
                to="/incomes/dashboard"
                className="inline-block flex-shrink-0"
              >
                <Button
                  variant="secondary"
                  size="sm"
                  className="bg-white text-brand-blue hover:bg-white/90 hover:text-brand-blue border-0 font-medium whitespace-nowrap"
                >
                  {t('expenses.goToIncomeDashboard', 'Lihat Income')}
                </Button>
              </Link>
            </div>
            <div className="text-left sm:text-right min-w-0 flex-shrink-0">
              <div className="text-2xl sm:text-3xl font-bold text-white truncate">
                {withdrawalOptionsLoading ? (t('expenses.loading', 'Loading...')) : formatCurrency(
                  bankAccountBalances.reduce((total, b) => total + (b.balance ?? 0), 0)
                )}
              </div>
              <div className="text-xs text-white/80 truncate mt-1">
                {bankAccounts.length} bank account{bankAccounts.length !== 1 ? 's' : ''} registered
              </div>
            </div>
          </div>
        </CardContent>
                </Card>
              </div>

              {/* Stats Cards */}
              <div className="min-w-0 shrink-0">
                <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="min-w-0">
        <CardContent className="p-3 min-w-0">
            <div className="text-xs sm:text-sm text-gray-600 mb-1 truncate">Current Month Total</div>
            <div className="text-xl sm:text-2xl font-bold mb-1 truncate">{formatCurrency(currentMonthTotal)}</div>
            <div className="text-xs text-gray-500 truncate">vs. last month</div>
            <div className="text-xs text-green-600 mt-1 truncate">↑ {currentMonthTotal > 0 ? '100' : '0'}%</div>
          </CardContent>
        </Card>

        <Card className="min-w-0">
        <CardContent className="p-3 min-w-0">
            <div className="text-xs sm:text-sm text-gray-600 mb-1 truncate">Total Expenses YTD</div>
            <div className="text-xl sm:text-2xl font-bold mb-1 truncate">{formatCurrency(totalExpensesYTD)}</div>
            <div className="text-xs text-gray-500 truncate">{ytdTransactionCount} transactions</div>
            <div className="flex items-center mt-1">
              <div className="w-2 h-2 bg-brand-blue rounded-full mr-1 flex-shrink-0"></div>
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0">
        <CardContent className="p-3 min-w-0">
            <div className="text-xs sm:text-sm text-gray-600 mb-1 truncate">Highest Expense</div>
            <div className="text-xl sm:text-2xl font-bold mb-1 truncate">
              {allExpenses.length > 0 ? formatCurrency(Math.max(...allExpenses.map(e => e.amount))) : formatCurrency(0)}
            </div>
            <div className="text-xs text-gray-500 truncate" title={allExpenses.length > 0 ? allExpenses.find(e => e.amount === Math.max(...allExpenses.map(ex => ex.amount)))?.expense_name : 'No expenses yet'}>
              {allExpenses.length > 0 ? allExpenses.find(e => e.amount === Math.max(...allExpenses.map(ex => ex.amount)))?.expense_name : 'No expenses yet'}
            </div>
            <div className="flex items-center mt-1 min-w-0">
              <div className="w-2 h-2 bg-brand-blue rounded-full mr-1 flex-shrink-0"></div>
              <span className="text-xs text-gray-500 truncate">
                {allExpenses.length > 0 ? format(new Date(allExpenses[0].create_date), 'dd MMM yyyy') : '-'}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardContent className="p-3 min-w-0">
            <div className="text-xs sm:text-sm text-gray-600 mb-1 truncate">Latest Transaction</div>
            <div className="text-xl sm:text-2xl font-bold mb-1 truncate">
              {allExpenses.length > 0 ? formatCurrency(allExpenses[0].amount) : formatCurrency(0)}
            </div>
            <div className="text-xs text-gray-500 truncate" title={allExpenses.length > 0 ? allExpenses[0].expense_name : 'No expenses yet'}>
              {allExpenses.length > 0 ? allExpenses[0].expense_name : 'No expenses yet'}
            </div>
            <div className="flex items-center mt-1 min-w-0">
              <div className="w-2 h-2 bg-brand-blue rounded-full mr-2 flex-shrink-0"></div>
              <span className="text-xs text-gray-500 truncate">
                {allExpenses.length > 0 ? format(new Date(allExpenses[0].created_at), 'dd MMM yyyy') : '-'}
              </span>
            </div>
          </CardContent>
        </Card>
                </div>
              </div>

              {/* Charts Section */}
              <div className="min-w-0 shrink-0">
                <div className="grid min-w-0 grid-cols-1 gap-2 lg:grid-cols-2">
        <Card className="flex flex-col min-w-0">
        <CardContent className="pt-3 px-3 pb-2 flex-1 flex flex-col min-w-0">
            <div className="flex justify-between items-center mb-4 gap-2 min-w-0">
              <h3 className="text-base sm:text-lg font-semibold truncate">Expense Breakdown</h3>
              <div className="text-right min-w-0">
                <div className="text-base sm:text-lg font-semibold truncate">{formatCurrency(breakdownHeaderTotal)}</div>
              </div>
            </div>

            <Tabs value={breakdownTab} onValueChange={(value) => setBreakdownTab(value as 'overview' | 'category')} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="overview" className="text-xs sm:text-sm">Overview</TabsTrigger>
                <TabsTrigger value="category" className="text-xs sm:text-sm">Expense Category</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-0">
                {tableFilteredExpenses.length > 0 ? (
                  <>
                    <div className="flex items-end justify-center gap-1 pt-2 px-2 pb-0 min-w-0">
                      {(() => {
                        const expenseTypeTotals = aggregateExpenseTotalsByKey(
                          tableFilteredExpenses,
                          (expense) => expense.expense_type || 'Uncategorized',
                          (expense) => expense.amount,
                        );

                        const maxAmount = Math.max(...Object.values(expenseTypeTotals), 0);
                        const colors = ['bg-green-500', 'bg-green-400', 'bg-brand-blue', 'bg-brand-blue/70', 'bg-brand-blue/90', 'bg-brand-blue/60', 'bg-brand-blue/50', 'bg-brand-blue/30'];
                        
                        return sortedBreakdownEntries(expenseTypeTotals).map(([expenseType, amount], index) => {
                          const heightPercentage = maxAmount > 0 ? (amount / maxAmount) * 80 : 0;
                          const colorClass = colors[index % colors.length];
                          
                          return (
                            <div key={expenseType} className="flex-1 flex flex-col items-center min-w-0 gap-0.5 pb-0">
                              <div className="w-full bg-gray-100 rounded flex flex-col justify-end h-48 p-1">
                                <div
                                  className={`w-full ${colorClass} rounded-t min-h-[4px]`}
                                  style={{ height: `${Math.max(heightPercentage, 8)}%` }}
                                  title={`${expenseType}: ${formatCurrency(amount)}`}
                                />
                              </div>
                              <span className="text-xs text-gray-600 text-center whitespace-nowrap truncate w-full mb-0" title={expenseType}>
                                {expenseType}
                              </span>
                              <span className="text-xs font-medium text-gray-800 text-center truncate w-full mb-0" title={formatCurrency(amount)}>
                                {formatCurrency(amount)}
                              </span>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </>
                ) : (
                  <div className="mt-4 h-32 bg-gray-100 rounded flex items-center justify-center">
                    <span className="text-gray-500 text-sm">No expense data available</span>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="category" className="mt-0">
                {categoryBreakdownFilteredExpenses.length > 0 ? (
                  <>
                    <div className="flex items-end justify-center gap-1 pt-2 px-2 pb-0 min-w-0">
                      {(() => {
                        const categoryTotals = aggregateExpenseTotalsByKey(
                          categoryBreakdownFilteredExpenses,
                          (expense) => expense.category || 'Uncategorized',
                          (expense) => expense.amount,
                        );

                        const maxAmount = Math.max(...Object.values(categoryTotals), 0);
                        const colors = ['bg-green-500', 'bg-green-400', 'bg-brand-blue', 'bg-brand-blue/70', 'bg-brand-blue/90', 'bg-brand-blue/60', 'bg-brand-blue/50', 'bg-brand-blue/30'];
                        
                        return sortedBreakdownEntries(categoryTotals).map(([category, amount], index) => {
                          const heightPercentage = maxAmount > 0 ? (amount / maxAmount) * 80 : 0;
                          const colorClass = colors[index % colors.length];
                          
                          return (
                            <div key={category} className="flex-1 flex flex-col items-center min-w-0 gap-0.5 pb-0">
                              <div className="w-full bg-gray-100 rounded flex flex-col justify-end h-48 p-1">
                                <div
                                  className={`w-full ${colorClass} rounded-t min-h-[4px]`}
                                  style={{ height: `${Math.max(heightPercentage, 8)}%` }}
                                  title={`${category}: ${formatCurrency(amount)}`}
                                />
                              </div>
                              <span className="text-xs text-gray-600 text-center whitespace-nowrap truncate w-full mb-0" title={category}>
                                {category}
                              </span>
                              <span className="text-xs font-medium text-gray-800 text-center truncate w-full mb-0" title={formatCurrency(amount)}>
                                {formatCurrency(amount)}
                              </span>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </>
                ) : (
                  <div className="mt-4 h-32 bg-gray-100 rounded flex items-center justify-center">
                    <span className="text-gray-500 text-sm">No expense data available</span>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card className="flex flex-col min-w-0">
          <CardContent className="pt-3 px-3 pb-1 flex-1 flex flex-col min-w-0">
            <div className="flex justify-between items-center mb-4 flex-shrink-0 min-w-0 gap-2">
              <div className="min-w-0 flex-1">
                <h3 className="text-base sm:text-lg font-semibold truncate">Monthly Comparison</h3>
                <p className="text-xs sm:text-sm text-gray-600 truncate">Expense trends throughout the year</p>
              </div>
              <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
            </div>

            <div className="h-52 w-full min-w-0 shrink-0">
              {monthlyData.length > 0 && monthlyData.some(d => d.amount > 0) ? (
                <ResponsiveContainer width="100%" height="100%" className="min-w-0">
                  <LineChart data={monthlyData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="month" 
                      fontSize={10}
                      stroke="#6b7280"
                      tickLine={false}
                    />
                    <YAxis 
                      fontSize={10}
                      stroke="#6b7280"
                      tickLine={false}
                      width={58}
                      tick={{ style: { whiteSpace: 'nowrap' } }}
                      tickFormatter={(value) => {
                        const nbsp = '\u00A0';
                        if (value >= 1000000) return `Rp${nbsp}${(value / 1000000).toFixed(1)}jt`;
                        if (value >= 1000) return `Rp${nbsp}${(value / 1000).toFixed(0)}rb`;
                        return `Rp${nbsp}${value.toLocaleString('id-ID')}`;
                      }}
                    />
                    <Tooltip 
                      formatter={(value: number) => [`Rp ${value.toLocaleString('id-ID')}`, 'Expenses']}
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px',
                        fontSize: '12px'
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="amount" 
                      stroke="hsl(var(--brand-blue))" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--brand-blue))', strokeWidth: 2, r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full bg-gray-100 rounded flex items-center justify-center">
                  <span className="text-gray-500 text-sm">No expense data available for this year</span>
                </div>
              )}
            </div>

            <div className="flex items-center mt-1 flex-shrink-0">
              <div className="w-2 h-2 bg-brand-blue rounded-full mr-2"></div>
              <span className="text-sm text-gray-600">Expenses</span>
            </div>
          </CardContent>
        </Card>
                </div>
              </div>

              {/* Tabel: viewport tinggi tetap (~10 baris) + scroll; kartu tidak memaksa min-h besar ke bawah halaman */}
              <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        {/* Table Header with Search and Filters */}
        <div className="flex-shrink-0 border-b border-border bg-muted/40 px-2 py-2 sm:px-3 min-w-0">
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2 min-w-0">
            <div className="flex items-center flex-wrap gap-2 min-w-0 flex-1">
              <div className="relative min-w-0 flex-1 sm:flex-initial">
                <Search className="absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search expenses..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 sm:pl-10 w-full sm:w-48 md:w-64 min-w-0"
                />
              </div>
              
              <Select 
                value={dateFilter} 
                onValueChange={(value) => {
                  if (value === 'custom') {
                    setIsCustomDatePickerOpen(true);
                  } else {
                    setDateFilter(value);
                    setCustomStartDate(undefined);
                    setCustomEndDate(undefined);
                  }
                }}
              >
                <SelectTrigger className="w-full sm:w-36 md:w-40 min-w-0">
                  <CalendarIcon className="h-4 w-4 mr-1 sm:mr-2 flex-shrink-0" />
                  <SelectValue placeholder={t('expenses.dateFilter.allDates', 'All Dates')}>
                    {dateFilter === 'custom' && customStartDate && customEndDate
                      ? `${format(customStartDate, 'MMM dd')} - ${format(customEndDate, 'MMM dd')}`
                      : dateFilter === 'all-dates'
                      ? t('expenses.dateFilter.allDates', 'All Dates')
                      : dateFilter === 'today'
                      ? t('expenses.dateFilter.today', 'Today')
                      : dateFilter === 'yesterday'
                      ? t('expenses.dateFilter.yesterday', 'Yesterday')
                      : dateFilter === 'this-week'
                      ? t('expenses.dateFilter.thisWeek', 'This Week')
                      : dateFilter === 'this-month'
                      ? t('expenses.dateFilter.thisMonth', 'This Month')
                      : dateFilter === 'last-month'
                      ? t('expenses.dateFilter.lastMonth', 'Last Month')
                      : dateFilter === '3-months-ago'
                      ? t('expenses.dateFilter.3MonthsAgo', '3 Months Ago')
                      : dateFilter === '6-months-ago'
                      ? t('expenses.dateFilter.6MonthsAgo', '6 Months Ago')
                      : dateFilter === 'this-year'
                      ? t('expenses.dateFilter.thisYear', 'This Year')
                      : dateFilter === 'last-year'
                      ? t('expenses.dateFilter.lastYear', 'Last Year')
                      : t('expenses.dateFilter.allDates', 'All Dates')}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-dates">{t('expenses.dateFilter.allDates', 'All Dates')}</SelectItem>
                  <SelectItem value="today">{t('expenses.dateFilter.today', 'Today')}</SelectItem>
                  <SelectItem value="yesterday">{t('expenses.dateFilter.yesterday', 'Yesterday')}</SelectItem>
                  <SelectItem value="this-week">{t('expenses.dateFilter.thisWeek', 'This Week')}</SelectItem>
                  <SelectItem value="this-month">{t('expenses.dateFilter.thisMonth', 'This Month')}</SelectItem>
                  <SelectItem value="last-month">{t('expenses.dateFilter.lastMonth', 'Last Month')}</SelectItem>
                  <SelectItem value="3-months-ago">{t('expenses.dateFilter.3MonthsAgo', '3 Months Ago')}</SelectItem>
                  <SelectItem value="6-months-ago">{t('expenses.dateFilter.6MonthsAgo', '6 Months Ago')}</SelectItem>
                  <SelectItem value="this-year">{t('expenses.dateFilter.thisYear', 'This Year')}</SelectItem>
                  <SelectItem value="last-year">{t('expenses.dateFilter.lastYear', 'Last Year')}</SelectItem>
                  <SelectItem value="custom">{t('expenses.dateFilter.customRange', 'Custom Range')}</SelectItem>
                </SelectContent>
              </Select>

              <Select value={expenseTypeFilter} onValueChange={setExpenseTypeFilter}>
                <SelectTrigger className="w-full sm:w-36 md:w-40 min-w-0">
                  <SelectValue placeholder={t('expenses.expenseTypeFilter.allTypes', 'All Types')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-types">{t('expenses.expenseTypeFilter.allTypes', 'All Types')}</SelectItem>
                  {expenseTypes.map((type) => (
                    <SelectItem key={type.id} value={type.name}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Popover open={categoryFilterOpen} onOpenChange={setCategoryFilterOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={categoryFilterOpen}
                    className="w-full sm:w-36 md:w-40 min-w-0 justify-between font-normal"
                  >
                    <span className="truncate">
                      {categoryFilter === 'all-categories'
                        ? t('expenses.categoryFilter.allCategories', 'All Categories')
                        : allExpenseCategories.find((c) => c.id === categoryFilter)?.name ?? t('expenses.categoryFilter.allCategories', 'All Categories')}
                    </span>
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <Command>
                    <CommandInput
                      placeholder={t('expenses.categoryFilter.searchPlaceholder', 'Cari kategori...')}
                      className="h-9"
                    />
                    <CommandList>
                      <CommandEmpty>{t('expenses.categoryFilter.noResults', 'Tidak ada kategori.')}</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value={t('expenses.categoryFilter.allCategories', 'All Categories')}
                          onSelect={() => {
                            setCategoryFilter('all-categories');
                            setCategoryFilterOpen(false);
                          }}
                        >
                          {t('expenses.categoryFilter.allCategories', 'All Categories')}
                        </CommandItem>
                        {allExpenseCategories.map((cat) => (
                          <CommandItem
                            key={cat.id}
                            value={cat.name}
                            onSelect={() => {
                              setCategoryFilter(cat.id);
                              setCategoryFilterOpen(false);
                            }}
                          >
                            {cat.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              <Select value={withdrawalFilter} onValueChange={setWithdrawalFilter} disabled={withdrawalOptionsLoading}>
                <SelectTrigger className="w-full sm:w-40 md:w-44 min-w-0">
                  <SelectValue placeholder={withdrawalOptionsLoading ? t('expenses.withdrawalFilter.loading', 'Loading...') : t('expenses.withdrawalFilter.allWithdrawal', 'Withdrawal From Balance')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-withdrawal">{t('expenses.withdrawalFilter.allWithdrawal', 'All')}</SelectItem>
                  <SelectItem value="none">{t('expenses.withdrawalFilter.none', 'None')}</SelectItem>
                  {debtsForExpense.length > 0 && (
                    <>
                      {debtsForExpense.map((debt) => (
                        <SelectItem key={debt.id} value={`debt_${debt.id}`}>
                          {debt.debt_name}
                        </SelectItem>
                      ))}
                    </>
                  )}
                  {bankAccounts.length > 0 && (
                    <>
                      {bankAccounts.map((bank) => (
                        <SelectItem key={bank.id} value={`bank_${bank.id}`}>
                          {bank.name}
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>

              <Select value={departmentFilter} onValueChange={setDepartmentFilter} disabled={departmentsLoading}>
                <SelectTrigger className="w-full sm:w-36 md:w-40 min-w-0">
                  <SelectValue placeholder={departmentsLoading ? t('expenses.departmentFilter.loading', 'Loading...') : t('expenses.departmentFilter.allDepts', 'All Depts')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-depts">{t('expenses.departmentFilter.allDepts', 'All Depts')}</SelectItem>
                  {departments.map((department) => (
                    <SelectItem key={department.id} value={department.name}>
                      {department.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleRefreshFilters}
                className="h-9 w-9 shrink-0 rounded-md border-gray-300 bg-white"
                title={t('expenses.refreshFilters', 'Reset filters to default')}
              >
                <FilterX className="h-4 w-4 text-gray-600" />
              </Button>
            </div>

            <Button onClick={handleOpenAddExpense} className="bg-brand-blue hover:bg-brand-blue/90 w-full sm:w-auto flex-shrink-0">
              <Plus className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Add Expense</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </div>
        </div>

        <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain h-[min(32rem,calc(100vh-18rem))] max-h-[32rem] min-h-[14rem] min-w-0 shrink-0 overflow-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <table className="w-full min-w-[1400px]">
              <thead className="sticky top-0 z-10 border-b border-border bg-gray-50 shadow-sm">
                <tr>
                  <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-gray-700 whitespace-nowrap text-xs sm:text-sm">Expense</th>
                  <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-gray-700 whitespace-nowrap text-xs sm:text-sm">
                    {t('expenses.tableAmount', 'Amount')}
                  </th>
                  <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-gray-700 whitespace-nowrap text-xs sm:text-sm">
                    {t('expenses.tableWithdrawalFromBalance', 'Withdrawal')}
                  </th>
                  <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-gray-700 whitespace-nowrap text-xs sm:text-sm">
                    {t('expenses.tablePaymentDate', 'Payment Date')}
                  </th>
                  <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-gray-700 whitespace-nowrap text-xs sm:text-sm">
                    {t('expenses.tableTransactionId', 'Transaction ID')}
                  </th>
                  <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-gray-700 whitespace-nowrap text-xs sm:text-sm">Type</th>
                  <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-gray-700 whitespace-nowrap text-xs sm:text-sm">Category</th>
                  <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-gray-700 whitespace-nowrap text-xs sm:text-sm">Department</th>
                  <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-gray-700 whitespace-nowrap text-xs sm:text-sm">Description</th>
                  <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-gray-700 whitespace-nowrap text-xs sm:text-sm">Recurring</th>
                  <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-gray-700 whitespace-nowrap text-xs sm:text-sm">Status</th>
                  <th className="text-center py-2 sm:py-3 px-2 sm:px-4 font-medium text-gray-700 whitespace-nowrap text-xs sm:text-sm" title={t('expenses.receipt', 'Receipt')}>{t('expenses.receipt', 'Receipt')}</th>
                  <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-gray-700 whitespace-nowrap text-xs sm:text-sm">
                    {t('expenses.tableRequestBy', 'Request By')}
                  </th>
                  <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-gray-700 whitespace-nowrap text-xs sm:text-sm">
                    {t('expenses.tableNextPayment', 'Next Payment')}
                  </th>
                  <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-medium text-gray-700 whitespace-nowrap text-xs sm:text-sm">Actions</th>
                </tr>
              </thead>
              <tbody>
                {!expensesLoading && !isLoadingPurchaseRequests && allExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={15} className="py-8 text-center text-gray-500">
                      No expenses found. Click "Add Expense" to create your first expense.
                    </td>
                  </tr>
                ) : tableFilteredExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={15} className="py-8 text-center text-gray-500">
                      {t('expenses.tableNoSearchResults', 'No expenses match your search.')}
                    </td>
                  </tr>
                ) : (
                  tableFilteredExpenses
                    .map((expense) => {
                      // Check if this is a paid purchase request
                      const isPaidPurchaseRequest = paidPurchaseRequests.some(pr => pr.id === expense.id);
                      // Get requester name - from expense object if available, otherwise from purchase request
                      const requesterName = (expense as any).requester_name || 
                        (isPaidPurchaseRequest 
                          ? paidPurchaseRequests.find(pr => pr.id === expense.id)?.requester_name 
                          : undefined);
                      // Get request title - from expense object if available, otherwise from purchase request or expense_name
                      const requestTitle = (expense as any).request_title || 
                        (isPaidPurchaseRequest 
                          ? paidPurchaseRequests.find(pr => pr.id === expense.id)?.request_title 
                          : expense.expense_name);
                      const linkedPurchaseRequest = expense.purchase_request_id
                        ? paidPurchaseRequests.find((pr) => pr.id === expense.purchase_request_id)
                        : isPaidPurchaseRequest
                          ? paidPurchaseRequests.find((pr) => pr.id === expense.id)
                          : undefined;
                      const prWithdrawal = linkedPurchaseRequest
                        ? withdrawalJoinsFromPurchaseRequest(
                            linkedPurchaseRequest,
                            debtsForExpense,
                            bankAccounts,
                          )
                        : null;
                      const withdrawalLabel =
                        getExpenseWithdrawalLabel(
                          {
                            ...expense,
                            gateway_wallet_provider:
                              expense.gateway_wallet_provider ??
                              prWithdrawal?.gateway_wallet_provider,
                            withdrawal_from_balance_bank_account:
                              expense.withdrawal_from_balance_bank_account ??
                              prWithdrawal?.withdrawal_from_balance_bank_account,
                            withdrawal_from_balance_debt:
                              expense.withdrawal_from_balance_debt ??
                              prWithdrawal?.withdrawal_from_balance_debt,
                          },
                          {
                            formatGateway: (provider) =>
                              provider === 'xendit'
                                ? t('expenses.gatewayXendit', 'Xendit')
                                : t('expenses.gatewayBrick', 'Brick'),
                          },
                        ) || '—';
                      return (
                      <tr key={expense.id} className="border-b hover:bg-gray-50">
                        <td className="py-2 sm:py-3 px-2 sm:px-4 max-w-[150px] sm:max-w-[200px] min-w-0">
                          <div className="truncate text-xs sm:text-sm" title={requestTitle || expense.expense_name || '-'}>
                            {requestTitle || expense.expense_name || '-'}
                          </div>
                        </td>
                        <td className="py-2 sm:py-3 px-2 sm:px-4 font-medium whitespace-nowrap text-xs sm:text-sm">{formatCurrency(expense.amount)}</td>
                        <td className="py-2 sm:py-3 px-2 sm:px-4 max-w-[150px] sm:max-w-[200px] min-w-0">
                          <div className="truncate text-xs sm:text-sm" title={withdrawalLabel}>
                            {withdrawalLabel}
                          </div>
                        </td>
                        <td className="py-2 sm:py-3 px-2 sm:px-4 whitespace-nowrap text-xs sm:text-sm">{format(new Date(expense.create_date), 'dd MMM yyyy')}</td>
                        <td className="py-2 sm:py-3 px-2 sm:px-4 max-w-[140px] sm:max-w-[180px] min-w-0">
                          <div
                            className="truncate text-xs sm:text-sm"
                            title={expense.transaction_reference?.trim() || undefined}
                          >
                            {expense.transaction_reference?.trim() || '—'}
                          </div>
                        </td>
                        <td className="py-2 sm:py-3 px-2 sm:px-4 max-w-[200px] sm:max-w-[250px] min-w-0">
                          <div className="truncate text-xs sm:text-sm" title={expense.expense_type}>
                            {expense.expense_type}
                          </div>
                        </td>
                        <td className="py-2 sm:py-3 px-2 sm:px-4 max-w-[200px] sm:max-w-[250px] min-w-0">
                          <div className="truncate text-xs sm:text-sm" title={expense.category}>
                            {expense.category}
                          </div>
                        </td>
                        <td className="py-2 sm:py-3 px-2 sm:px-4 max-w-[150px] sm:max-w-[200px] min-w-0">
                          <div className="truncate text-xs sm:text-sm" title={expense.department || 'N/A'}>
                            {expense.department || 'N/A'}
                          </div>
                        </td>
                        <td className="py-2 sm:py-3 px-2 sm:px-4 max-w-[200px] sm:max-w-[250px] min-w-0">
                          <div className="truncate text-xs sm:text-sm" title={expense.description || '-'}>
                            {expense.description || '-'}
                          </div>
                        </td>
                        <td className="py-2 sm:py-3 px-2 sm:px-4 whitespace-nowrap">
                          <Badge variant={expense.is_recurring ? 'default' : 'secondary'} className="text-xs">
                            {expense.is_recurring ? 'Recurring' : 'One-time'}
                          </Badge>
                        </td>
                        <td className="py-2 sm:py-3 px-2 sm:px-4 whitespace-nowrap">
                          <Badge variant="default" className="text-xs">
                            Berhasil
                          </Badge>
                        </td>
                        <td className="py-2 sm:py-3 px-2 sm:px-4 whitespace-nowrap">
                          <div className="flex justify-center items-center">
                            {expense.receipt_url ? (
                              <CheckCircle className="h-5 w-5 text-green-600 shrink-0" aria-label={t('expenses.hasReceipt', 'Has receipt')} />
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 sm:py-3 px-2 sm:px-4 max-w-[120px] sm:max-w-[150px] min-w-0">
                          <div className="truncate text-xs sm:text-sm" title={requesterName || '-'}>
                            {requesterName || '-'}
                          </div>
                        </td>
                        <td className="py-2 sm:py-3 px-2 sm:px-4 whitespace-nowrap text-xs sm:text-sm">{expense.next_payment_date ? format(new Date(expense.next_payment_date), 'dd MMM yyyy') : '-'}</td>
                        <td className="py-2 sm:py-3 px-2 sm:px-4 whitespace-nowrap">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 w-7 sm:h-8 sm:w-8 p-0">
                                <MoreHorizontal className="h-3 w-3 sm:h-4 sm:w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                              {expense.receipt_url && (
                                <DropdownMenuItem onClick={() => handleViewInvoice(expense.receipt_url)}>
                                  <Receipt className="h-4 w-4 mr-2 text-gray-600" />
                                  {isPaidPurchaseRequest ? 'View Invoice' : 'View Receipt'}
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => handleViewDetails(expense)}>
                                <Eye className="h-4 w-4 mr-2 text-gray-600" />
                                Details
                              </DropdownMenuItem>
                              {!isPaidPurchaseRequest && (
                                <DropdownMenuItem onClick={() => handleOpenEditExpense(expense)}>
                                  <Pencil className="h-4 w-4 mr-2 text-gray-600" />
                                  Edit
                                </DropdownMenuItem>
                              )}
                              {!isPaidPurchaseRequest && (
                                <DropdownMenuItem 
                                  className="text-brand-red"
                                  onClick={() => handleDeleteClick(expense.id)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                    })
                )}
              </tbody>
            </table>
          </div>

        {/* Footer */}
        <ExpenseTableFooter 
          totalExpenses={tableFilteredTotal}
          totalCount={tableFilteredExpenses.length}
          isLoading={expensesLoading || isLoadingPurchaseRequests}
        />
                </div>
              </div>
              </div>
              </div>
    </ExpenseDashboardModuleShell>

      {/* Add Expense Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={(open) => {
        setIsAddModalOpen(open);
        if (!open) {
          resetExpenseForm();
        }
      }}>
        <DialogContent className="w-[95vw] sm:w-[600px] sm:h-[600px] max-w-[600px] max-h-[90vh] p-0 overflow-hidden flex flex-col min-w-0">
          <DialogHeader className="flex-shrink-0 p-4 pb-2 border-b">
            <DialogTitle className="text-lg font-semibold">{isEditMode ? 'Edit Expense' : 'Add New Expense'}</DialogTitle>
            <p className="text-sm text-gray-600">
              {isEditMode ? 'Update the expense details and save your changes.' : 'Enter the details for your new expense entry.'}
            </p>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 min-h-0 overflow-y-auto seamless-scroll px-4 pb-4 space-y-4">
              
              <div>
                <label className="block text-sm font-medium mb-2">
                  Expense Name <span className="text-brand-red">*</span>
                </label>
                <Input 
                  {...form.register('expense_name')}
                  placeholder="Enter expense name"
                  className="w-full"
                />
                {form.formState.errors.expense_name && (
                  <p className="text-sm text-brand-red mt-1">{form.formState.errors.expense_name.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Amount <span className="text-brand-red">*</span>
                </label>
                <Input 
                  type="text"
                  placeholder="Enter amount"
                  value={amountDisplay}
                  onChange={(e) => {
                    const formatted = formatAmount(e.target.value);
                    setAmountDisplay(formatted);
                    const parsed = parseAmount(formatted);
                    form.setValue('amount', parsed > 0 ? parsed : undefined as any, { shouldValidate: true });
                  }}
                  className="w-full"
                />
                {form.formState.errors.amount && (
                  <p className="text-sm text-brand-red mt-1">{form.formState.errors.amount.message}</p>
                )}
              </div>

              <div>
                <WithdrawalFromBalanceSelect
                  allowNone={false}
                  requiredMark
                  label="Withdrawal From Balance"
                  placeholder="Select source (required)"
                  value={withdrawalSourceFromFormFields({
                    withdrawal_from_balance: form.watch('withdrawal_from_balance'),
                    bank_account_id: form.watch('bank_account_id'),
                    gateway_wallet_provider: form.watch('gateway_wallet_provider'),
                  })}
                  onChange={(source) => {
                    setIncomeAllocIncomeId('');
                    setIncomeAllocAmountStr('');
                    const fields = applyWithdrawalSourceToFormFields(source);
                    form.setValue('withdrawal_from_balance', fields.withdrawal_from_balance, { shouldValidate: true });
                    form.setValue('bank_account_id', fields.bank_account_id, { shouldValidate: true });
                    form.setValue('gateway_wallet_provider', fields.gateway_wallet_provider, { shouldValidate: true });
                  }}
                />
                {(hasWithdrawalFormFields({
                  withdrawal_from_balance: form.watch('withdrawal_from_balance'),
                  bank_account_id: form.watch('bank_account_id'),
                  gateway_wallet_provider: form.watch('gateway_wallet_provider'),
                })) && (
                  (() => {
                    const gatewayProvider = form.watch('gateway_wallet_provider');
                    const selectedDebt = form.watch('withdrawal_from_balance') 
                      ? debtsForExpense.find(d => d.id === form.watch('withdrawal_from_balance'))
                      : null;
                    const selectedBankAccount = form.watch('bank_account_id')
                      ? bankAccounts.find(b => b.id === form.watch('bank_account_id'))
                      : null;
                    const balance = selectedBankAccount 
                      ? bankAccountBalances.find(b => b.bank_account_id === selectedBankAccount.id)
                      : null;
                    const selectedGateway = gatewayProvider
                      ? gateways.find((g) => g.provider === gatewayProvider)
                      : null;
                    
                    const availableAmount = selectedGateway
                      ? (selectedGateway.usableBalance ?? 0)
                      : selectedDebt 
                        ? (selectedDebt.available_limit ?? 0)
                        : (balance?.balance ?? 0);
                    const expenseAmount = form.watch('amount') || 0;
                    const isInsufficient = availableAmount < expenseAmount;
                    const sourceName = selectedGateway
                      ? selectedGateway.label
                      : selectedDebt 
                        ? selectedDebt.debt_name 
                        : selectedBankAccount?.name || '';
                    
                    return (
                      <div className="mt-2">
                        {isInsufficient ? (
                          <p className="text-sm text-brand-red">
                            Insufficient balance. Available: Rp {availableAmount.toLocaleString('id-ID')}, Required: Rp {expenseAmount.toLocaleString('id-ID')}
                          </p>
                        ) : (
                          <p className="text-sm text-gray-600">
                            Available balance: Rp {availableAmount.toLocaleString('id-ID')}
                          </p>
                        )}
                      </div>
                    );
                  })()
                )}
                {form.formState.errors.withdrawal_from_balance && (
                  <p className="text-sm text-brand-red mt-1">{form.formState.errors.withdrawal_from_balance.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 flex items-center justify-between">
                  Department
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => setIsDepartmentCrudOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Manage Departments
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </label>
                <Select 
                  onValueChange={(value) => form.setValue('department', value)}
                  disabled={departmentsLoading}
                  value={form.watch('department') || undefined}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={departmentsLoading ? "Loading departments..." : "Select department (optional)"} />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map(department => (
                      <SelectItem key={department.id} value={department.name}>
                        {department.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <IncomeAllocationOptionalSection
                bankAccountId={form.watch('bank_account_id')}
                referenceAmount={form.watch('amount') || 0}
                referenceDate={form.watch('create_date')}
                selectedIncomeId={incomeAllocIncomeId}
                onSelectedIncomeId={setIncomeAllocIncomeId}
                allocationAmountStr={incomeAllocAmountStr}
                onAllocationAmountStrChange={setIncomeAllocAmountStr}
              />

              <div>
                <label className="block text-sm font-medium mb-2 flex items-center justify-between">
                  Expense Type <span className="text-brand-red">*</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => setIsExpenseTypeCrudOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Manage Expense Types
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </label>
                <Select 
                  onValueChange={handleExpenseTypeChange}
                  disabled={expenseTypesLoading}
                  value={form.watch('expense_type') || undefined}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={expenseTypesLoading ? "Loading expense types..." : "Select expense type"} />
                  </SelectTrigger>
                  <SelectContent>
                    {expenseTypes.map(type => (
                      <SelectItem key={type.id} value={type.name}>
                        {type.name}
                        {type.is_default && <Badge variant="outline" className="ml-2 text-xs">Default</Badge>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.expense_type && (
                  <p className="text-sm text-brand-red mt-1">{form.formState.errors.expense_type.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 flex items-center justify-between">
                  Category <span className="text-brand-red">*</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" disabled={!selectedExpenseTypeId}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => setIsExpenseCategoryCrudOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Manage Categories
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </label>
                <Select 
                  onValueChange={(value) => form.setValue('category', value)}
                  disabled={!selectedExpenseTypeId || expenseCategories.length === 0}
                  value={form.watch('category') || undefined}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={
                      !selectedExpenseTypeId 
                        ? "Select expense type first" 
                        : expenseCategories.length === 0 
                        ? "No categories available" 
                        : "Select category"
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    {expenseCategories.map(category => (
                      <SelectItem key={category.id} value={category.name}>
                        {category.name}
                        {category.is_default && <Badge variant="outline" className="ml-2 text-xs">Default</Badge>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.category && (
                  <p className="text-sm text-brand-red mt-1">{form.formState.errors.category.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Create Date <span className="text-brand-red">*</span>
                </label>
                <Popover open={isCreateDatePickerOpen} onOpenChange={setIsCreateDatePickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !selectedDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedDate ? format(selectedDate, "MM/dd/yyyy") : format(new Date(), "MM/dd/yyyy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDate || new Date()}
                      onSelect={(date) => {
                        setSelectedDate(date);
                        if (date) {
                          form.setValue('create_date', format(date, 'yyyy-MM-dd'));
                          setIsCreateDatePickerOpen(false); // Close popover after date selection
                        }
                      }}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="recurring"
                  checked={isRecurring}
                  onCheckedChange={(checked) => form.setValue('is_recurring', checked === true)}
                />
                <label htmlFor="recurring" className="text-sm font-medium">
                  This is a recurring expense
                </label>
              </div>

              {isRecurring && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Recurring Frequency <span className="text-brand-red">*</span>
                    </label>
                    <Select onValueChange={(value) => form.setValue('recurring_frequency', value)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select frequency" />
                      </SelectTrigger>
                      <SelectContent>
                        {RECURRING_FREQUENCIES.map(freq => (
                          <SelectItem key={freq.value} value={freq.value}>{freq.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">First Payment Date</label>
                    <Popover open={isFirstPaymentDatePickerOpen} onOpenChange={setIsFirstPaymentDatePickerOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !firstPaymentDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {firstPaymentDate ? format(firstPaymentDate, "MM/dd/yyyy") : "mm/dd/yyyy"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={firstPaymentDate}
                          onSelect={(date) => {
                            setFirstPaymentDate(date);
                            if (date) {
                              form.setValue('first_payment_date', format(date, 'yyyy-MM-dd'));
                              setIsFirstPaymentDatePickerOpen(false); // Close popover after date selection
                            }
                          }}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <Textarea 
                  {...form.register('description')}
                  placeholder="Additional details about this expense (optional)"
                  className="min-h-[80px] resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Receipt</label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                  <input
                    type="file"
                    id="receipt-upload"
                    className="hidden"
                    onChange={handleFileChange}
                    accept=".jpg,.jpeg,.png,.webp,.pdf"
                  />
                  <label htmlFor="receipt-upload" className="cursor-pointer">
                    <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600 mb-1">
                      {receiptFile ? receiptFile.name : 'Click to upload receipt'}
                    </p>
                    <p className="text-xs text-gray-500">PNG, JPG, PDF up to 10MB</p>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 p-4 border-t flex-shrink-0 bg-white">
              <Button 
                type="button"
                variant="outline" 
                onClick={() => setIsAddModalOpen(false)}
                disabled={isSubmittingExpense}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                className="bg-gray-900 hover:bg-gray-800 text-white"
                disabled={
                  isSubmittingExpense ||
                  !hasWithdrawalFormFields({
                    withdrawal_from_balance: form.watch('withdrawal_from_balance'),
                    bank_account_id: form.watch('bank_account_id'),
                    gateway_wallet_provider: form.watch('gateway_wallet_provider'),
                  })
                }
              >
                {isSubmittingExpense
                  ? (isEditMode ? 'Saving...' : 'Creating...')
                  : (isEditMode ? 'Save Changes' : 'Add Expense')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Department CRUD Modal */}
      <DepartmentCrudModal 
        isOpen={isDepartmentCrudOpen}
        onClose={() => setIsDepartmentCrudOpen(false)}
        onDepartmentChange={refetchDepartments}
      />

      {/* Expense Type CRUD Modal */}
      <ExpenseTypeCrudModal 
        isOpen={isExpenseTypeCrudOpen}
        onClose={() => setIsExpenseTypeCrudOpen(false)}
        onExpenseTypeChange={refetchExpenseTypes}
      />

      {/* Expense Category CRUD Modal */}
      <ExpenseCategoryCrudModal 
        isOpen={isExpenseCategoryCrudOpen}
        onClose={() => setIsExpenseCategoryCrudOpen(false)}
        onExpenseCategoryChange={refetchExpenseCategories}
      />

      {/* Expense Detail Modal */}
      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto min-w-0">
          <DialogHeader>
            <DialogTitle>Expense Details</DialogTitle>
            <DialogDescription>
              View detailed information about this expense
            </DialogDescription>
          </DialogHeader>
          {selectedExpense && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Expense Name</label>
                  <p className="text-sm font-semibold mt-1">{selectedExpense.expense_name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Amount</label>
                  <p className="text-sm font-semibold mt-1">{formatCurrency(selectedExpense.amount)}</p>
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium text-gray-500">
                    {t('expenses.tableTransactionId', 'Transaction ID')}
                  </label>
                  <p className="text-sm font-mono mt-1 break-all">
                    {selectedExpense.transaction_reference?.trim() || '—'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Type</label>
                  <p className="text-sm mt-1">{selectedExpense.expense_type}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Category</label>
                  <p className="text-sm mt-1">{selectedExpense.category}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Department</label>
                  <p className="text-sm mt-1">{selectedExpense.department || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Status</label>
                  <div className="mt-1">
                    <Badge variant={selectedExpense.is_recurring ? 'default' : 'secondary'}>
                      {selectedExpense.is_recurring ? 'Recurring' : 'One-time'}
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Payment Date</label>
                  <p className="text-sm mt-1">{format(new Date(selectedExpense.create_date), 'dd MMM yyyy')}</p>
                </div>
                {selectedExpense.next_payment_date && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Next Payment</label>
                    <p className="text-sm mt-1">{format(new Date(selectedExpense.next_payment_date), 'dd MMM yyyy')}</p>
                  </div>
                )}
                {selectedExpense.is_recurring && selectedExpense.recurring_frequency && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Recurring Frequency</label>
                    <p className="text-sm mt-1 capitalize">{selectedExpense.recurring_frequency}</p>
                  </div>
                )}
                {selectedExpense.first_payment_date && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">First Payment Date</label>
                    <p className="text-sm mt-1">{format(new Date(selectedExpense.first_payment_date), 'dd MMM yyyy')}</p>
                  </div>
                )}
              </div>
              {selectedExpense.description && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Description</label>
                  <p className="text-sm mt-1">{selectedExpense.description}</p>
                </div>
              )}
              {selectedExpense.receipt_url && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Receipt</label>
                  <div className="mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewInvoice(selectedExpense.receipt_url)}
                    >
                      <Receipt className="h-4 w-4 mr-2" />
                      View Receipt
                    </Button>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <label className="text-sm font-medium text-gray-500">Created At</label>
                  <p className="text-sm mt-1">{format(new Date(selectedExpense.created_at), 'dd MMM yyyy HH:mm')}</p>
                </div>
                {selectedExpense.updated_at && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Updated At</label>
                    <p className="text-sm mt-1">{format(new Date(selectedExpense.updated_at), 'dd MMM yyyy HH:mm')}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Expense</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this expense? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteDialogOpen(false);
                setExpenseToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rentang tanggal custom: harus Dialog (bukan CustomDatePicker grid di shared/calendar) */}
      <AttendanceDateRangePicker
        isOpen={isCustomDatePickerOpen}
        onClose={() => setIsCustomDatePickerOpen(false)}
        onDateRangeSelect={(startDate, endDate) => {
          setCustomStartDate(startDate);
          setCustomEndDate(endDate);
          setDateFilter('custom');
          setIsCustomDatePickerOpen(false);
        }}
        initialStartDate={customStartDate}
        initialEndDate={customEndDate}
      />
    </>
  );
}

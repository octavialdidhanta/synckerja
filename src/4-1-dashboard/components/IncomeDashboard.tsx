import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/shared/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Calendar, TrendingUp, DollarSign, Target, Clock, History, ChevronDown } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import { useIncomeMetrics, useIncomeTransactions, useMonthlyIncomeData } from '../hooks';
import { useIncomeMasterData } from '../hooks/useIncomeMasterData';
import { formatToRupiah } from '@/shared/utils/formatCurrency';
import { formatBankInstitutionAccountLine } from '@/4-1-dashboard/utils/formatBankInstitutionAccountLine';
import { IncomeVsExpensesChart } from './IncomeVsExpensesChart';
import { RecentIncomeOverview } from './RecentIncomeOverview';
import { IncomeTransactionWithRelations } from '../types';
import { useBankAccounts, type BankAccount } from '@/shared/hooks/finance/useBankAccounts';
import { NetBankAccountSwipeRow } from './NetBankAccountSwipeRow';
import { BankTransferDialog } from './BankTransferDialog';
import { useBankAccountBalances } from '@/shared/hooks/finance/useBankAccountBalances';
import { useExpenses } from '@/shared/hooks/finance/useExpenses';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/shared/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { format } from 'date-fns';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { useDebouncedReady } from '@/shared/hooks/useDebouncedReady';
import { IncomeDashboardSkeleton } from '@/4-1-dashboard/skeletons/IncomeDashboardSkeleton';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useExpenseMetrics } from '@/shared/hooks/finance/useExpenseMetrics';
import { cn } from '@/shared/lib/utils';

// Helper function to calculate date range based on selected period
const getDateRangeForPeriod = (period: string): { startDate: Date; endDate: Date } => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentDate = now.getDate();

  let startDate: Date;
  let endDate: Date = new Date(currentYear, currentMonth, currentDate + 1); // End of today (exclusive)

  switch (period) {
    case 'This Month':
      startDate = new Date(currentYear, currentMonth, 1);
      break;
    case 'Last Month':
      const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      startDate = new Date(lastMonthYear, lastMonth, 1);
      endDate = new Date(currentYear, currentMonth, 1);
      break;
    case 'Last 3 Months':
      startDate = new Date(currentYear, currentMonth - 3, 1);
      break;
    case 'Last 6 Months':
      startDate = new Date(currentYear, currentMonth - 6, 1);
      break;
    case 'This Year':
      startDate = new Date(currentYear, 0, 1);
      break;
    case 'Last Year':
      startDate = new Date(currentYear - 1, 0, 1);
      endDate = new Date(currentYear, 0, 1);
      break;
    default:
      startDate = new Date(currentYear, currentMonth, 1);
  }

  return { startDate, endDate };
};

// Helper function to format date to YYYY-MM-DD
const formatDateToString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function IncomeDashboard() {
  const { t } = useAppTranslation();
  const [selectedPeriod, setSelectedPeriod] = useState('This Month');
  const [selectedType, setSelectedType] = useState('All Types');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedBankAccount, setSelectedBankAccount] = useState<string>('all');
  const [incomeDistributionTab, setIncomeDistributionTab] = useState<'overview' | 'service'>('overview');
  const [isBalanceHistoryOpen, setIsBalanceHistoryOpen] = useState(false);
  const [selectedBankAccountForHistory, setSelectedBankAccountForHistory] = useState<string | null>(null);
  const [balanceHistory, setBalanceHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [netBankOpenSwipeId, setNetBankOpenSwipeId] = useState<string | null>(null);
  const [bankTransferDialogOpen, setBankTransferDialogOpen] = useState(false);
  const [bankTransferSource, setBankTransferSource] = useState<BankAccount | null>(null);

  const { loading: orgLoading, organizationId } = useCurrentOrg();
  const { data: metrics, isLoading: metricsLoading } = useIncomeMetrics();
  const {
    incomeTransactions,
    isLoading: transactionsLoading,
    isPending: transactionsPending,
  } = useIncomeTransactions();
  const { data: monthlyData = [], isLoading: monthlyLoading } = useMonthlyIncomeData(selectedYear);
  const { incomeTypes, isLoading: masterDataLoading } = useIncomeMasterData();
  const { isLoading: expenseMetricsLoading } = useExpenseMetrics();
  const {
    bankAccounts,
    loading: bankAccountsLoading,
    isPending: bankAccountsPending,
  } = useBankAccounts();
  const {
    balances: bankAccountBalances,
    loading: balancesLoading,
    isPending: balancesPending,
    getBalanceHistory,
  } = useBankAccountBalances();
  const { expenses, isLoading: expensesLoading } = useExpenses();

  // Filter transactions based on selected period, type, and bank account
  const filteredTransactions = useMemo(() => {
    if (!incomeTransactions.length) return [];

    const { startDate, endDate } = getDateRangeForPeriod(selectedPeriod);
    const startDateStr = formatDateToString(startDate);
    const endDateStr = formatDateToString(endDate);

    return incomeTransactions.filter((transaction) => {
      // Filter by date range
      const transactionDate = transaction.transaction_date;
      const isInDateRange = transactionDate >= startDateStr && transactionDate < endDateStr;

      // Filter by type (All Types means no filter, Other means no type)
      const transactionType = transaction.income_types?.name || '';
      let matchesType = true;
      
      if (selectedType === 'All Types') {
        matchesType = true; // Show all types
      } else if (selectedType === 'Other') {
        matchesType = !transactionType; // Show only transactions without type
      } else {
        matchesType = transactionType === selectedType; // Show only matching type
      }

      // Filter by bank account
      let matchesBankAccount = true;
      if (selectedBankAccount !== 'all') {
        matchesBankAccount = transaction.bank_account_id === selectedBankAccount;
      }

      // Only include completed or pending transactions
      const isValidStatus = transaction.status === 'completed' || transaction.status === 'pending';

      return isInDateRange && matchesType && matchesBankAccount && isValidStatus;
    });
  }, [incomeTransactions, selectedPeriod, selectedType, selectedBankAccount]);

  // Filter expenses based on selected period and bank account
  const filteredExpenses = useMemo(() => {
    if (!expenses.length) return [];

    const { startDate, endDate } = getDateRangeForPeriod(selectedPeriod);
    const startDateStr = formatDateToString(startDate);
    const endDateStr = formatDateToString(endDate);

    return expenses.filter((expense) => {
      const expenseDate = expense.create_date;
      const isInDateRange = expenseDate >= startDateStr && expenseDate < endDateStr;
      
      // Filter by bank account
      let matchesBankAccount = true;
      if (selectedBankAccount !== 'all') {
        matchesBankAccount = (expense as any).bank_account_id === selectedBankAccount;
      }

      return isInDateRange && matchesBankAccount;
    });
  }, [expenses, selectedPeriod, selectedBankAccount]);

  // Calculate net (income - expense) per bank account
  const bankAccountNet = useMemo(() => {
    const netMap: Record<string, { income: number; expense: number; net: number; balance: number }> = {};
    
    // Initialize with balances
    bankAccountBalances.forEach(balance => {
      netMap[balance.bank_account_id] = {
        income: 0,
        expense: 0,
        net: 0,
        balance: balance.balance,
      };
    });

    // Calculate income per bank account (only from filtered transactions)
    filteredTransactions.forEach(transaction => {
      if (transaction.bank_account_id) {
        if (!netMap[transaction.bank_account_id]) {
          netMap[transaction.bank_account_id] = {
            income: 0,
            expense: 0,
            net: 0,
            balance: 0,
          };
        }
        netMap[transaction.bank_account_id].income += parseFloat(transaction.amount.toString());
      }
    });

    // Calculate expense per bank account (only from filtered expenses with bank_account_id)
    filteredExpenses.forEach(expense => {
      const bankAccountId = (expense as any).bank_account_id;
      if (bankAccountId) {
        if (!netMap[bankAccountId]) {
          netMap[bankAccountId] = {
            income: 0,
            expense: 0,
            net: 0,
            balance: 0,
          };
        }
        netMap[bankAccountId].expense += expense.amount;
      }
    });

    // Calculate net (income - expense) for the selected period
    Object.keys(netMap).forEach(bankAccountId => {
      netMap[bankAccountId].net = netMap[bankAccountId].income - netMap[bankAccountId].expense;
    });

    return netMap;
  }, [filteredTransactions, filteredExpenses, bankAccountBalances]);

  // Calculate metrics from filtered transactions
  const filteredMetrics = useMemo(() => {
    if (!filteredTransactions.length) {
      return {
        total: 0,
        highest: 0,
        latest: 0,
        count: 0
      };
    }

    const amounts = filteredTransactions.map(t => parseFloat(t.amount.toString()));
    const total = amounts.reduce((sum, amount) => sum + amount, 0);
    const highest = Math.max(...amounts);
    const latest = filteredTransactions[0] ? parseFloat(filteredTransactions[0].amount.toString()) : 0;

    return {
      total,
      highest,
      latest,
      count: filteredTransactions.length
    };
  }, [filteredTransactions]);

  // Check if we have transactions without type for "Other" option
  const hasTransactionsWithoutType = useMemo(() => {
    return incomeTransactions.some(t => !t.income_types?.name);
  }, [incomeTransactions]);

  const dataPending =
    Boolean(organizationId) &&
    (metricsLoading ||
      transactionsLoading ||
      transactionsPending ||
      monthlyLoading ||
      masterDataLoading ||
      expenseMetricsLoading ||
      bankAccountsLoading ||
      bankAccountsPending ||
      balancesLoading ||
      balancesPending ||
      expensesLoading);
  const rawPendingLoad = orgLoading || dataPending;
  const showContent = useDebouncedReady(!rawPendingLoad);

  return (
    <>
      <div
        className={cn(
          'flex min-h-full min-w-0 flex-col bg-muted/40',
          !showContent && 'invisible pointer-events-none select-none',
        )}
        aria-hidden={!showContent}
      >
        <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch xl:grid-rows-1 [@media(max-height:900px)]:min-h-[640px] [@media(max-height:900px)]:flex-none [@media(max-height:760px)]:min-h-[700px]">
            <div className="col-span-12 flex min-h-0 min-w-0 flex-col self-stretch overflow-x-hidden xl:col-span-9">
              <div className="flex h-full min-h-0 min-w-0 flex-col">
                  <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden rounded-lg border border-gray-200/50 bg-gradient-to-br from-gray-50 to-white p-2 xl:min-h-0">
              {/* Compact Header Controls */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-2">
                <h2 className="text-lg font-bold text-gray-800">Income Analytics</h2>
                <div className="flex gap-2 flex-wrap">
                  <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                    <SelectTrigger className="w-36 h-9 bg-white border-gray-200 shadow-sm">
                      <Calendar className="h-4 w-4 mr-2 text-gray-500" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-gray-200 shadow-lg z-50">
                      <SelectItem value="This Month">This Month</SelectItem>
                      <SelectItem value="Last Month">Last Month</SelectItem>
                      <SelectItem value="Last 3 Months">Last 3 Months</SelectItem>
                      <SelectItem value="Last 6 Months">Last 6 Months</SelectItem>
                      <SelectItem value="This Year">This Year</SelectItem>
                      <SelectItem value="Last Year">Last Year</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={selectedType} onValueChange={setSelectedType}>
                    <SelectTrigger className="w-36 h-9 bg-white border-gray-200 shadow-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-gray-200 shadow-lg z-50 max-h-[300px]">
                      <SelectItem value="All Types">All Types</SelectItem>
                      {incomeTypes.map((type) => (
                        <SelectItem key={type.id} value={type.name}>
                          {type.name}
                        </SelectItem>
                      ))}
                      {/* Option for transactions without type */}
                      {hasTransactionsWithoutType && (
                        <SelectItem value="Other">Other</SelectItem>
                      )}
                    </SelectContent>
                  </Select>

                  <Select value={selectedBankAccount} onValueChange={setSelectedBankAccount}>
                    <SelectTrigger className="w-auto min-w-[200px] h-9 bg-white border-gray-200 shadow-sm">
                      <SelectValue placeholder="All Bank Accounts" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-gray-200 shadow-lg z-50 max-h-[300px]">
                      <SelectItem value="all">All Bank Accounts</SelectItem>
                      {bankAccounts.map((bankAccount) => (
                        <SelectItem key={bankAccount.id} value={bankAccount.id}>
                          {bankAccount.account_number 
                            ? `${bankAccount.name} - ${bankAccount.account_number}`
                            : bankAccount.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Total Current Balance — always when "All Bank Accounts" (matches skeleton + Debt quick view) */}
              {selectedBankAccount === 'all' && (
                <div className="mb-2 grid grid-cols-1 gap-2 md:grid-cols-1">
                  <Card className="w-full min-w-0 flex-shrink-0 border-0 bg-brand-blue text-white">
                    <CardContent className="min-w-0 p-3">
                      <div className="flex min-w-0 flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
                        <div className="min-w-0 flex-1">
                          <div className="mb-2 flex items-center gap-2">
                            <div className="flex-shrink-0 rounded-lg bg-white/20 p-2">
                              <DollarSign className="h-4 w-4 text-white" />
                            </div>
                            <span className="truncate text-sm font-medium text-white/90">
                              {t(
                                'incomes.dashboard.totalCurrentBalance',
                                'Total Current Balance'
                              )}
                            </span>
                          </div>
                          <Link
                            to="/expenses/dashboard"
                            className="inline-block flex-shrink-0"
                          >
                            <Button
                              variant="secondary"
                              size="sm"
                              className="border-0 bg-white font-medium whitespace-nowrap text-brand-blue hover:bg-white/90 hover:text-brand-blue"
                            >
                              {t('incomes.dashboard.viewExpensesCta', 'Lihat Expense')}
                            </Button>
                          </Link>
                        </div>
                        <div className="min-w-0 flex-shrink-0 text-left sm:text-right">
                          <div className="truncate text-2xl font-bold text-white sm:text-3xl">
                            {formatToRupiah(
                              bankAccountBalances.reduce(
                                (total, balance) => total + (balance.balance || 0),
                                0
                              )
                            )}
                          </div>
                          <div className="mt-1 truncate text-xs text-white/80">
                            {bankAccounts.length === 0
                              ? t(
                                  'incomes.dashboard.noBankAccountsRegistered',
                                  'No bank accounts registered'
                                )
                              : t('incomes.bankAccountsRegistered', '{{count}} bank account(s) registered', {
                                  count: bankAccounts.length,
                                })}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Bank Account Summary - biru sama seperti Total Current Balance (filter bank lain) */}
              {selectedBankAccount !== 'all' && bankAccounts.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-1 gap-2 mb-2">
                  {(() => {
                    const selectedBank = bankAccounts.find(b => b.id === selectedBankAccount);
                    const balance = bankAccountBalances.find(b => b.bank_account_id === selectedBankAccount);
                    
                    if (!selectedBank) return null;
                    
                    return (
                      <Card 
                        className="bg-brand-blue text-white border-0 w-full min-w-0 flex-shrink-0 cursor-pointer hover:bg-brand-blue/90 transition-colors"
                        onClick={async () => {
                          setSelectedBankAccountForHistory(selectedBankAccount);
                          setIsBalanceHistoryOpen(true);
                          setIsLoadingHistory(true);
                          try {
                            const history = await getBalanceHistory(selectedBankAccount);
                            setBalanceHistory(history);
                          } catch (error) {
                            console.error('Error loading balance history:', error);
                            setBalanceHistory([]);
                          } finally {
                            setIsLoadingHistory(false);
                          }
                        }}
                      >
                        <CardContent className="p-3 min-w-0">
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <div className="p-2 bg-white/20 rounded-lg flex-shrink-0">
                                  <DollarSign className="h-4 w-4 text-white" />
                                </div>
                                <span className="text-sm font-medium text-white/90 truncate">Current Balance</span>
                              </div>
                              <div className="text-2xl font-bold text-white mb-1 truncate">
                                {balance ? formatToRupiah(balance.balance) : 'Rp 0'}
                              </div>
                              <div className="text-xs text-white/80 truncate">
                                {selectedBank.name}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })()}
                </div>
              )}

              {/* Compact Metrics Cards - border sama seperti Income Distribution */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 mb-2">
                {/* Total Income Card */}
        <Card className="flex flex-col min-w-0">
          <CardContent className="p-3 min-w-0">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 bg-brand-blue/10 rounded-lg">
                    <DollarSign className="h-4 w-4 text-brand-blue" />
                  </div>
                  <span className="text-sm font-medium text-gray-600">Total Income</span>
                </div>
                <div className="text-2xl font-bold text-gray-900 mb-1">
                  {formatToRupiah(filteredMetrics.total)}
                </div>
                <div className="text-xs text-gray-500">
                  {selectedPeriod === 'This Month' 
                    ? new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                    : selectedPeriod}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Period Change Card */}
        <Card className="flex flex-col min-w-0">
          <CardContent className="p-3 min-w-0">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 bg-green-50 rounded-lg">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                  </div>
                  <span className="text-sm font-medium text-gray-600">Growth</span>
                </div>
                <div className={`text-2xl font-bold mb-1 ${(metrics?.growthPercentage || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {(metrics?.growthPercentage || 0) >= 0 ? '+' : ''}{(metrics?.growthPercentage || 0).toFixed(1)}%
                </div>
                <div className="text-xs text-gray-500">
                  {selectedPeriod === 'This Month' 
                    ? `vs Previous: ${formatToRupiah(metrics?.previousMonthTotal || 0)}`
                    : `${filteredMetrics.count} transactions`}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Highest Income Card */}
        <Card className="flex flex-col min-w-0">
          <CardContent className="p-3 min-w-0">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 bg-brand-blue/10 rounded-lg">
                    <Target className="h-4 w-4 text-brand-blue" />
                  </div>
                  <span className="text-sm font-medium text-gray-600">Highest</span>
                </div>
                <div className="text-2xl font-bold text-gray-900 mb-1">
                  {formatToRupiah(filteredMetrics.highest)}
                </div>
                <div className="text-xs text-gray-500">
                  {filteredMetrics.highest > 0 ? 'This period' : 'No data'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Latest Income Card */}
        <Card className="flex flex-col min-w-0">
          <CardContent className="p-3 min-w-0">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 bg-brand-blue/10 rounded-lg">
                    <Clock className="h-4 w-4 text-brand-blue" />
                  </div>
                  <span className="text-sm font-medium text-gray-600">Latest</span>
                </div>
                <div className="text-2xl font-bold text-gray-900 mb-1">
                  {formatToRupiah(filteredMetrics.latest)}
                </div>
                <div className="text-xs text-gray-500">
                  {filteredMetrics.latest > 0 ? 'Most recent' : 'No data'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
              </div>

              {/* Compact Charts Section - kedua card sama tinggi, mengisi area grid */}
              <div className="mb-2 grid min-h-0 min-w-0 grid-cols-1 flex-shrink-0 gap-2 lg:grid-cols-2 lg:items-stretch">
                {/* Income Distribution - ukuran & jarak sama persis seperti Expense Breakdown */}
        <Card className="flex h-full min-h-0 min-w-0 max-w-full flex-col overflow-hidden">
        <CardContent className="flex h-full min-h-0 min-w-0 max-w-full flex-col overflow-hidden pt-3 px-3 pb-2">
            <div className="flex justify-between items-center mb-4 gap-2 min-w-0">
              <h3 className="text-base sm:text-lg font-semibold truncate">Income Distribution</h3>
              <div className="text-right min-w-0">
                <div className="text-base sm:text-lg font-semibold truncate">
                  {formatToRupiah(
                    filteredTransactions.reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0)
                  )}
                </div>
              </div>
            </div>

            <Tabs value={incomeDistributionTab} onValueChange={(v) => setIncomeDistributionTab(v as 'overview' | 'service')} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="overview" className="text-xs sm:text-sm">Overview</TabsTrigger>
                <TabsTrigger value="service" className="text-xs sm:text-sm">Service</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-0">
                {filteredTransactions.length > 0 ? (
                  <>
                    <div className="flex min-w-0 items-end justify-center gap-1 overflow-x-auto overflow-y-visible pt-2 px-2 pb-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden scrollbar-hide">
                      {(() => {
                        const incomeTypeTotals = filteredTransactions.reduce((acc, transaction) => {
                          const typeName = transaction.income_types?.name || 'Uncategorized';
                          const amount = parseFloat(transaction.amount.toString());
                          acc[typeName] = (acc[typeName] || 0) + amount;
                          return acc;
                        }, {} as Record<string, number>);

                        const maxAmount = Math.max(...Object.values(incomeTypeTotals), 0);
                        const colors = [
                          'bg-green-500',
                          'bg-green-400',
                          'bg-brand-blue',
                          'bg-brand-blue/70',
                          'bg-brand-blue/90',
                          'bg-brand-blue/60',
                          'bg-brand-blue/50',
                          'bg-brand-blue/30',
                        ];

                        return Object.entries(incomeTypeTotals).map(([typeName, amount], index) => {
                          const heightPercentage = maxAmount > 0 ? (amount / maxAmount) * 80 : 0;
                          const colorClass = colors[index % colors.length];
                          return (
                            <div key={typeName} className="flex-1 flex flex-col items-center min-w-0 gap-0.5 pb-0">
                              <div className="w-full bg-gray-100 rounded flex flex-col justify-end h-48 p-1">
                                <div
                                  className={`w-full ${colorClass} rounded-t min-h-[4px]`}
                                  style={{ height: `${Math.max(heightPercentage, 8)}%` }}
                                  title={`${typeName}: ${formatToRupiah(amount)}`}
                                />
                              </div>
                              <span className="text-xs text-gray-600 text-center whitespace-nowrap truncate w-full mb-0" title={typeName}>
                                {typeName}
                              </span>
                              <span className="text-xs font-medium text-gray-800 text-center truncate w-full mb-0" title={formatToRupiah(amount)}>
                                {formatToRupiah(amount)}
                              </span>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </>
                ) : (
                  <div className="mt-4 h-32 bg-gray-100 rounded flex items-center justify-center">
                    <span className="text-gray-500 text-sm">No income data available</span>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="service" className="mt-0">
                {filteredTransactions.length > 0 ? (
                  <>
                    <div className="flex min-w-0 items-end justify-center gap-1 overflow-x-auto overflow-y-visible pt-2 px-2 pb-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden scrollbar-hide">
                      {(() => {
                        const serviceTotals = filteredTransactions.reduce((acc, transaction) => {
                          const serviceName = transaction.services?.name || 'Uncategorized';
                          const amount = parseFloat(transaction.amount.toString());
                          acc[serviceName] = (acc[serviceName] || 0) + amount;
                          return acc;
                        }, {} as Record<string, number>);

                        const entries = Object.entries(serviceTotals);
                        const maxAmount = entries.length > 0 ? Math.max(...entries.map(([, v]) => v)) : 0;
                        const colors = [
                          'bg-green-500',
                          'bg-green-400',
                          'bg-brand-blue',
                          'bg-brand-blue/70',
                          'bg-brand-blue/90',
                          'bg-brand-blue/60',
                          'bg-brand-blue/50',
                          'bg-brand-blue/30',
                        ];

                        return entries.map(([serviceName, amount], index) => {
                          const heightPercentage = maxAmount > 0 ? (amount / maxAmount) * 80 : 0;
                          const colorClass = colors[index % colors.length];
                          return (
                            <div key={serviceName} className="flex-1 flex flex-col items-center min-w-0 gap-0.5 pb-0">
                              <div className="w-full bg-gray-100 rounded flex flex-col justify-end h-48 p-1">
                                <div
                                  className={`w-full ${colorClass} rounded-t min-h-[4px]`}
                                  style={{ height: `${Math.max(heightPercentage, 8)}%` }}
                                  title={`${serviceName}: ${formatToRupiah(amount)}`}
                                />
                              </div>
                              <span className="text-xs text-gray-600 text-center whitespace-nowrap truncate w-full mb-0" title={serviceName}>
                                {serviceName}
                              </span>
                              <span className="text-xs font-medium text-gray-800 text-center truncate w-full mb-0" title={formatToRupiah(amount)}>
                                {formatToRupiah(amount)}
                              </span>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </>
                ) : (
                  <div className="mt-4 h-32 bg-gray-100 rounded flex items-center justify-center">
                    <span className="text-gray-500 text-sm">No income data available</span>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Trend Pendapatan Bulanan - mengisi area yang sama dengan Income Distribution (card sama tinggi) */}
        <Card className="flex h-full min-h-0 min-w-0 max-w-full flex-col overflow-hidden">
          <CardContent className="flex min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-hidden pt-3 px-3 pb-2">
            <div className="flex justify-between items-center mb-4 flex-shrink-0 min-w-0 gap-2">
              <div className="min-w-0 flex-1">
                <h3 className="text-base sm:text-lg font-semibold truncate">Trend Pendapatan Bulanan Tahun {selectedYear}</h3>
                <p className="text-xs sm:text-sm text-gray-600 truncate">Satuan: Rupiah | Jan - Des {selectedYear}</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="w-20 h-9 text-sm border-gray-200 bg-gray-50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white z-50">
                    <SelectItem value="2026">2026</SelectItem>
                    <SelectItem value="2025">2025</SelectItem>
                    <SelectItem value="2024">2024</SelectItem>
                    <SelectItem value="2023">2023</SelectItem>
                  </SelectContent>
                </Select>
                <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
              </div>
            </div>

            <div className="min-h-[240px] w-full min-w-0 max-w-full shrink-0">
              {monthlyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={240} className="max-w-full min-w-0">
                  <LineChart data={monthlyData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="month"
                      tickFormatter={(value) => value.split(' ')[0]}
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
                      formatter={(value: number) => [`Rp ${Number(value).toLocaleString('id-ID')}`, 'Income']}
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px',
                        fontSize: '12px',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="hsl(var(--brand-blue))"
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--brand-blue))', strokeWidth: 2, r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full min-h-[120px] bg-gray-100 rounded flex items-center justify-center">
                  <span className="text-gray-500 text-sm">No income data available for this year</span>
                </div>
              )}
            </div>

            <div className="flex items-center mt-1 flex-shrink-0">
              <div className="w-2 h-2 bg-brand-blue rounded-full mr-2"></div>
              <span className="text-sm text-gray-600">Income</span>
            </div>
          </CardContent>
        </Card>
              </div>

              {/* Section kiri & kanan saja: Income vs. Expenses (kiri) | Net Income per Bank Account (kanan) */}
              <div className="mb-2 grid min-h-0 min-w-0 grid-cols-1 gap-2 lg:min-h-[18rem] lg:grid-cols-2 lg:items-stretch">
                {/* Kiri: Income vs. Expenses */}
                <div className="flex h-full min-h-0 min-w-0 flex-col">
                  <IncomeVsExpensesChart />
                </div>
                {/* Kanan: Net Income per Bank Account — daftar scroll di dalam kartu supaya tidak meluber */}
                <div className="flex min-h-0 min-w-0 flex-col">
                  <Card className="flex h-full min-h-0 min-w-0 max-w-full flex-col overflow-hidden">
                    <CardHeader className="flex-shrink-0 px-3 pb-2 pt-3">
                      <CardTitle className="text-base font-semibold sm:text-lg">Net Income per Bank Account</CardTitle>
                    </CardHeader>
                    <CardContent className="flex min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-hidden px-3 pb-2 pt-0">
                      <div className="scrollbar-hide min-h-0 flex-1 overflow-x-hidden overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {selectedBankAccount === 'all' && bankAccounts.length > 0 ? (
                        <div className="flex flex-col space-y-2 pb-0">
                          {bankAccounts.map(bankAccount => {
                            const netData = bankAccountNet[bankAccount.id];
                            const balance = bankAccountBalances.find(b => b.bank_account_id === bankAccount.id);
                            
                            if (!netData && !balance) return null;
                            
                            const income = netData?.income || 0;
                            const expense = netData?.expense || 0;
                            const net = income - expense;
                            const currentBalance = balance?.balance || 0;
                            const estimatedPeriodOpening = currentBalance - net;
                            const otherAccounts = bankAccounts.filter((a) => a.id !== bankAccount.id);
                            const canTransfer = otherAccounts.length > 0 && currentBalance > 0;
                            const bankInstitutionLine = formatBankInstitutionAccountLine(bankAccount);

                            return (
                              <NetBankAccountSwipeRow
                                key={bankAccount.id}
                                rowId={bankAccount.id}
                                isOpen={netBankOpenSwipeId === bankAccount.id}
                                onOpenChange={(open) => {
                                  if (open) setNetBankOpenSwipeId(bankAccount.id);
                                  else setNetBankOpenSwipeId((cur) => (cur === bankAccount.id ? null : cur));
                                }}
                                onTransfer={() => {
                                  setBankTransferSource(bankAccount);
                                  setBankTransferDialogOpen(true);
                                  setNetBankOpenSwipeId(null);
                                }}
                                transferLabel={t('incomes.bankTransfer.button', 'Transfer')}
                                disabled={!canTransfer}
                              >
                                <div className="flex items-center justify-between p-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium text-sm text-gray-900 truncate">{bankAccount.name}</div>
                                    {bankInstitutionLine ? (
                                      <div className="text-xs leading-snug text-gray-700 truncate">{bankInstitutionLine}</div>
                                    ) : null}
                                    <div className="text-xs text-gray-700">
                                      Income: {formatToRupiah(income)} | Expense: {formatToRupiah(expense)}
                                    </div>
                                  </div>
                                  <div className="text-right flex-shrink-0 ml-2">
                                    <div className={`text-sm font-semibold ${net >= 0 ? 'text-green-800' : 'text-red-800'}`}>
                                      Net: {formatToRupiah(net)}
                                    </div>
                                    <div className="text-xs text-gray-800 font-medium">
                                      Balance: {formatToRupiah(currentBalance)}
                                    </div>
                                    <div
                                      className="text-xs text-gray-600 mt-0.5 max-w-[12rem] ml-auto cursor-help"
                                      title={t(
                                        'incomes.netPerBankEstimatedOpeningHint',
                                        'Approx. balance at the start of the filtered period: current Balance minus Net.'
                                      )}
                                    >
                                      {t('incomes.netPerBankEstimatedOpening', 'Est. opening balance (period)')}:{' '}
                                      {formatToRupiah(estimatedPeriodOpening)}
                                    </div>
                                  </div>
                                </div>
                              </NetBankAccountSwipeRow>
                            );
                          })}
                        </div>
                      ) : bankAccounts.length === 0 ? (
                        <div className="flex min-h-[120px] flex-1 items-center justify-center rounded-lg bg-gray-50">
                          <span className="text-sm text-gray-500">No bank accounts</span>
                        </div>
                      ) : (
                        <div className="flex min-h-[120px] flex-1 items-center justify-center rounded-lg bg-gray-50">
                          <span className="px-2 text-center text-sm text-gray-500">Select &quot;All Banks&quot; to see net income per bank account</span>
                        </div>
                      )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

                  </div>
              </div>
            </div>

            <div className="col-span-12 flex min-h-0 min-w-0 flex-col self-stretch overflow-hidden xl:col-span-3">
              <div className="flex h-full min-h-0 min-w-0 flex-col">
                <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                  <div className="flex-shrink-0 border-b border-border px-4 py-1.5">
                    <h3 className="text-sm font-semibold text-foreground">Recent Income</h3>
                    <p className="mt-1 text-xs text-muted-foreground">Latest transactions and overview</p>
                  </div>
                  <div className="min-h-0 flex-1 overflow-hidden">
                    <div className="scrollbar-hide h-full min-h-0 overflow-x-hidden overflow-y-auto p-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      <RecentIncomeOverview />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
      </div>
      {!showContent ? (
        <div
          className="absolute inset-0 z-20 flex min-h-0 min-w-0 flex-col overflow-auto bg-gray-100"
          aria-busy
        >
          <IncomeDashboardSkeleton />
        </div>
      ) : null}

      {/* Balance History Modal */}
      <Dialog open={isBalanceHistoryOpen} onOpenChange={setIsBalanceHistoryOpen}>
        <DialogContent className="w-[95vw] sm:w-[600px] max-w-[600px] max-h-[80vh] p-0 overflow-hidden flex flex-col min-w-0">
          <DialogHeader className="flex-shrink-0 p-4 pb-2 border-b">
            <DialogTitle className="text-lg font-semibold flex items-center gap-2">
              <History className="h-5 w-5 text-brand-blue" />
              Balance History
            </DialogTitle>
            <DialogDescription>
              {selectedBankAccountForHistory && bankAccounts.find(b => b.id === selectedBankAccountForHistory)?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto seamless-scroll px-4 py-4">
            {isLoadingHistory ? (
              <div className="text-center py-8 text-gray-500">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-blue mx-auto mb-2"></div>
                <p>Loading balance history...</p>
              </div>
            ) : balanceHistory.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <History className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>No balance history found</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="border rounded-lg overflow-x-auto seamless-scroll">
                  <Table className="min-w-[800px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs whitespace-nowrap">Date</TableHead>
                        <TableHead className="text-xs whitespace-nowrap">Type</TableHead>
                        <TableHead className="text-xs text-right whitespace-nowrap">Amount</TableHead>
                        <TableHead className="text-xs text-right whitespace-nowrap">Balance Before</TableHead>
                        <TableHead className="text-xs text-right whitespace-nowrap">Balance After</TableHead>
                        <TableHead className="text-xs whitespace-nowrap">Description</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {balanceHistory.map((history) => {
                        // Calculate amount from balance difference if amount is missing or 0
                        const calculatedAmount = (() => {
                          // If amount exists and is not 0, use it
                          if (history.amount !== null && history.amount !== undefined && history.amount !== 0) {
                            return history.amount;
                          }
                          // Otherwise, calculate from balance difference
                          if (history.balance_after !== null && history.balance_after !== undefined &&
                              history.balance_before !== null && history.balance_before !== undefined) {
                            return history.balance_after - history.balance_before;
                          }
                          // If balances are not available, return 0
                          return 0;
                        })();
                        
                        // Format amount for display
                        const formatAmount = (amount: number | null | undefined): string => {
                          if (amount === null || amount === undefined || isNaN(amount)) return '-';
                          if (amount === 0) return 'Rp 0';
                          const formatted = new Intl.NumberFormat('id-ID', {
                            style: 'currency',
                            currency: 'IDR',
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0,
                          }).format(Math.abs(amount));
                          return formatted;
                        };

                        const amountDisplay = formatAmount(calculatedAmount);
                        const isPositive = calculatedAmount >= 0;

                        return (
                          <TableRow key={history.id}>
                            <TableCell className="text-xs whitespace-nowrap">
                              {format(new Date(history.created_at), 'dd MMM yyyy HH:mm')}
                            </TableCell>
                            <TableCell className="text-xs whitespace-nowrap">
                              <span className={`px-2 py-1 rounded text-xs ${
                                history.transaction_type === 'income' 
                                  ? 'bg-green-100 text-green-800' 
                                  : history.transaction_type === 'expense'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {history.transaction_type === 'income' ? 'Income' : 
                                 history.transaction_type === 'expense' ? 'Expense' : 
                                 history.transaction_type === 'manual_adjustment' ? 'Manual' : 
                                 'Initial'}
                              </span>
                            </TableCell>
                            <TableCell className={`text-xs text-right font-medium whitespace-nowrap ${
                              isPositive ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {amountDisplay === '-' 
                                ? '-' 
                                : `${isPositive ? '+' : '-'}${amountDisplay}`}
                            </TableCell>
                            <TableCell className="text-xs text-right whitespace-nowrap">
                              {history.balance_before !== null && history.balance_before !== undefined
                                ? formatAmount(history.balance_before)
                                : '-'}
                            </TableCell>
                            <TableCell className="text-xs text-right font-semibold whitespace-nowrap">
                              {history.balance_after !== null && history.balance_after !== undefined
                                ? formatAmount(history.balance_after)
                                : '-'}
                            </TableCell>
                            <TableCell className="text-xs text-gray-600 whitespace-nowrap">
                              {history.description || '-'}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <BankTransferDialog
        open={bankTransferDialogOpen}
        onOpenChange={setBankTransferDialogOpen}
        sourceAccount={bankTransferSource}
        destinationAccounts={
          bankTransferSource ? bankAccounts.filter((a) => a.id !== bankTransferSource.id) : []
        }
        sourceBalance={
          bankTransferSource
            ? bankAccountBalances.find((b) => b.bank_account_id === bankTransferSource.id)?.balance ?? 0
            : 0
        }
      />
    </>
  );
}

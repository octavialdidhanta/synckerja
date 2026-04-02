import { useState } from 'react';
import { DollarSign, Calendar, Receipt, Building2 } from 'lucide-react';
import { useIncomeTransactions } from '@/4-1-dashboard/hooks';
import { useIncomeMetrics } from '@/4-1-dashboard/hooks';
import { formatToRupiah } from '@/shared/utils/formatCurrency';
import { BankAccountManagement } from './BankAccountManagement';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';

interface IncomeTransactionOverviewProps {
  transactions?: any[];
}

const OverviewContent = ({ transactions = [] }: { transactions?: any[] }) => {
  const { incomeTransactions } = useIncomeTransactions();
  const { data: metrics } = useIncomeMetrics();

  // Use provided transactions or fallback to all transactions
  const displayTransactions = transactions.length > 0 ? transactions : incomeTransactions;

  // Calculate metrics
  const totalAmount = displayTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
  const completedCount = displayTransactions.filter(t => t.status === 'completed').length;
  const pendingCount = displayTransactions.filter(t => t.status === 'pending').length;
  
  // Get unique income types
  const uniqueTypes = [...new Set(displayTransactions.map(t => t.income_types?.name).filter(Boolean))];
  const totalTypes = uniqueTypes.length;

  // Get top income type
  const typeCounts = uniqueTypes.map(type => ({
    name: type,
    count: displayTransactions.filter(t => t.income_types?.name === type).length,
    amount: displayTransactions
      .filter(t => t.income_types?.name === type)
      .reduce((sum, t) => sum + (t.amount || 0), 0)
  }));
  const topType = typeCounts.reduce((max, current) => 
    current.amount > max.amount ? current : max, typeCounts[0] || { name: 'N/A', count: 0, amount: 0 });

  // Get this month transactions
  const thisMonth = new Date();
  const thisMonthTransactions = displayTransactions.filter(t => {
    const transDate = new Date(t.transaction_date);
    return transDate.getMonth() === thisMonth.getMonth() && 
           transDate.getFullYear() === thisMonth.getFullYear();
  });
  const thisMonthTotal = thisMonthTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);

  return (
    <div className="space-y-4">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 gap-3">
        <div className="p-3 bg-brand-blue/10 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-brand-blue">Total Income</p>
              <p className="text-lg font-bold text-brand-blue">{formatToRupiah(totalAmount)}</p>
            </div>
            <DollarSign className="w-5 h-5 text-brand-blue" />
          </div>
        </div>

        <div className="p-3 bg-green-50 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-green-800">Completed</p>
              <p className="text-lg font-bold text-green-900">{completedCount}</p>
            </div>
            <Receipt className="w-5 h-5 text-green-600" />
          </div>
        </div>

        <div className="p-3 bg-amber-50 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-amber-800">Pending</p>
              <p className="text-lg font-bold text-amber-900">{pendingCount}</p>
            </div>
            <Calendar className="w-5 h-5 text-amber-600" />
          </div>
        </div>
      </div>

      {/* Additional Info */}
      <div className="space-y-2 pt-2 border-t border-gray-200">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-600">This Month:</span>
          <span className="font-semibold text-gray-900">{formatToRupiah(thisMonthTotal)}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-600">Income Types:</span>
          <span className="font-semibold text-gray-900">{totalTypes}</span>
        </div>
        {topType.name !== 'N/A' && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600">Top Type:</span>
            <span className="font-semibold text-gray-900">{topType.name}</span>
          </div>
        )}
        {metrics?.growthPercentage !== undefined && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600">Growth:</span>
            <span className={`font-semibold ${metrics.growthPercentage >= 0 ? 'text-green-600' : 'text-brand-red'}`}>
              {metrics.growthPercentage >= 0 ? '+' : ''}{metrics.growthPercentage.toFixed(1)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export const IncomeTransactionOverview = ({ transactions = [] }: IncomeTransactionOverviewProps) => {
  const [activeTab, setActiveTab] = useState('overview');
  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex h-full min-h-0 w-full flex-1 flex-col">
      <TabsList className="grid h-9 w-full flex-shrink-0 grid-cols-2 bg-gray-100 mb-3">
        <TabsTrigger 
          value="overview" 
          className="text-xs font-medium data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm"
        >
          Overview
        </TabsTrigger>
        <TabsTrigger 
          value="bank-accounts" 
          className="text-xs font-medium flex items-center justify-center gap-1.5 data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm"
        >
          <Building2 className="h-3.5 w-3.5" />
          Bank Accounts
        </TabsTrigger>
      </TabsList>
      <TabsContent
        value="overview"
        className="mt-0 flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden focus-visible:outline-none data-[state=inactive]:hidden seamless-scroll"
      >
        <OverviewContent transactions={transactions} />
      </TabsContent>
      <TabsContent
        value="bank-accounts"
        className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden focus-visible:outline-none data-[state=inactive]:hidden"
      >
        <BankAccountManagement />
      </TabsContent>
    </Tabs>
  );
};
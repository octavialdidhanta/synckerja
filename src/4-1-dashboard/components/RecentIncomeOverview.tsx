
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { formatToRupiah } from '@/utils/formatCurrency';
import { format } from 'date-fns';
import { useIncomeTransactions } from '../hooks';

export const RecentIncomeOverview = () => {
  const { incomeTransactions, isLoading } = useIncomeTransactions();

  // Get the 5 most recent transactions
  const recentIncomes = incomeTransactions.slice(0, 5);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <Badge variant="default" className="bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 rounded-md font-medium">
            Completed
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant="default" className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-md font-medium">
            Pending
          </Badge>
        );
      case 'cancelled':
        return (
          <Badge variant="destructive" className="text-xs px-2 py-0.5 rounded-md font-medium">
            Cancelled
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="text-xs px-2 py-0.5 rounded-md font-medium">
            Draft
          </Badge>
        );
    }
  };

  if (isLoading) {
    return null;
  }

  return (
    <div className="min-w-0">
      {recentIncomes.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-slate-500 text-sm">No recent income to display.</p>
          <p className="text-slate-400 text-xs mt-1 italic">
            This section shows the latest income transactions and their current status.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {recentIncomes.map((income, index) => (
            <div key={income.id} className={`flex items-center justify-between p-2.5 rounded-md border transition-all duration-200 hover:shadow-sm ${
              index === 0 
                ? 'bg-gradient-to-r from-blue-50/60 to-indigo-50/40 border-blue-200/60 shadow-sm' 
                : 'bg-slate-50/60 border-slate-200/50 hover:bg-slate-50'
            }`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium text-slate-800 truncate tracking-tight">
                    {income.customer_name || income.income_categories?.name || 'Income Transaction'}
                  </p>
                  {getStatusBadge(income.status)}
                </div>
                <p className="text-xs text-slate-500 mb-1">
                  {income.income_types?.name || income.payment_method || 'General Income'}
                </p>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-800 tracking-tight">
                    {formatToRupiah(income.amount)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {format(new Date(income.transaction_date), 'MMM dd')}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {recentIncomes.length > 0 && (
        <div className="mt-3 pt-2 border-t border-slate-200/60">
          <p className="text-xs text-slate-500 text-center">
            Showing {recentIncomes.length} of {incomeTransactions.length} transactions
          </p>
        </div>
      )}
    </div>
  );
};

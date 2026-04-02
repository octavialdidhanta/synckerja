import { useMemo } from 'react';
import { Card, CardContent } from '@/shared/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useIncomeMetrics } from '../hooks';
import { useExpenseMetrics } from '@/shared/hooks/finance/useExpenseMetrics';
import { formatToRupiah } from '@/shared/utils/formatCurrency';

export const IncomeVsExpensesChart = () => {
  const { data: incomeMetrics, isLoading: incomeLoading } = useIncomeMetrics();
  const { data: expenseMetrics, isLoading: expenseLoading } = useExpenseMetrics();

  const chartData = useMemo(() => {
    if (!incomeMetrics || !expenseMetrics) return [];
    const currentMonth = new Date().toLocaleDateString('en-US', { month: 'short' });
    const previousMonth = new Date(new Date().setMonth(new Date().getMonth() - 1)).toLocaleDateString('en-US', { month: 'short' });
    return [
      { month: previousMonth, income: incomeMetrics.previousMonthTotal || 0, expenses: expenseMetrics.previousMonthTotal || 0 },
      { month: currentMonth, income: incomeMetrics.currentMonthTotal || 0, expenses: expenseMetrics.currentMonthTotal || 0 },
    ];
  }, [incomeMetrics, expenseMetrics]);

  const isLoading = incomeLoading || expenseLoading;
  const hasData = chartData.some(item => item.income > 0 || item.expenses > 0);

  return (
    <Card className="flex h-full min-h-0 min-w-0 max-w-full flex-col overflow-hidden">
      <CardContent className="flex min-h-0 min-w-0 max-w-full flex-col overflow-hidden pt-3 px-3 pb-2">
        <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-2">Income vs. Expenses</h3>
        {isLoading ? (
          <div className="h-48 rounded bg-muted/40" aria-hidden />
        ) : !hasData ? (
          <div className="h-48 flex items-center justify-center bg-gray-50 rounded">
            <span className="text-gray-500 text-sm">No data yet</span>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-4 mb-2">
              <span className="flex items-center gap-1.5 text-xs text-gray-600">
                <span className="w-2 h-2 bg-green-500 rounded-full" /> Income
              </span>
              <span className="flex items-center gap-1.5 text-xs text-gray-600">
                <span className="w-2 h-2 bg-red-500 rounded-full" /> Expenses
              </span>
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" fontSize={10} stroke="#6b7280" tickLine={false} />
                  <YAxis fontSize={10} stroke="#6b7280" tickLine={false} width={40} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}jt`} />
                  <Tooltip
                    formatter={(value: number, name: string) => [formatToRupiah(value), name === 'income' ? 'Income' : 'Expenses']}
                    contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '12px' }}
                  />
                  <Bar dataKey="income" fill="#10b981" radius={[2, 2, 0, 0]} name="income" />
                  <Bar dataKey="expenses" fill="#ef4444" radius={[2, 2, 0, 0]} name="expenses" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

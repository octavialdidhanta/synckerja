import { useMemo } from 'react';
import { Card, CardContent } from '@/shared/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useIncomeMetrics } from '../hooks';
import { useExpenseMetrics } from '@/shared/hooks/finance/useExpenseMetrics';
import { formatToRupiah } from '@/shared/utils/formatCurrency';
import {
  INCOME_DRAWERS_PAIR_BODY,
  INCOME_DRAWERS_PAIR_BODY_INNER,
  INCOME_DRAWERS_PAIR_CARD,
} from '@/4-1-dashboard/utils/financialDrawersScroll';

export const IncomeVsExpensesChart = () => {
  const { data: incomeMetrics, isLoading: incomeLoading } = useIncomeMetrics();
  const { data: expenseMetrics, isLoading: expenseLoading } = useExpenseMetrics();

  const chartData = useMemo(() => {
    if (!incomeMetrics || !expenseMetrics) return [];
    const currentMonth = new Date().toLocaleDateString('en-US', { month: 'short' });
    const previousMonth = new Date(new Date().setMonth(new Date().getMonth() - 1)).toLocaleDateString('en-US', {
      month: 'short',
    });
    return [
      {
        month: previousMonth,
        income: incomeMetrics.previousMonthTotal || 0,
        expenses: expenseMetrics.previousMonthTotal || 0,
      },
      {
        month: currentMonth,
        income: incomeMetrics.currentMonthTotal || 0,
        expenses: expenseMetrics.currentMonthTotal || 0,
      },
    ];
  }, [incomeMetrics, expenseMetrics]);

  const isLoading = incomeLoading || expenseLoading;
  const hasData = chartData.some((item) => item.income > 0 || item.expenses > 0);

  const chartAreaClass = `relative w-full ${INCOME_DRAWERS_PAIR_BODY_INNER}`;

  return (
    <Card className={INCOME_DRAWERS_PAIR_CARD}>
      <CardContent className="flex h-full min-h-0 flex-col overflow-hidden p-0 px-3 pb-0.5 pt-2">
        <h3 className="mb-1 flex-shrink-0 text-base font-semibold text-gray-800 sm:text-lg">
          Income vs. Expenses
        </h3>
        <div className={INCOME_DRAWERS_PAIR_BODY}>
          {isLoading ? (
            <div className={`${chartAreaClass} rounded bg-muted/40`} aria-hidden />
          ) : !hasData ? (
            <div className={`${chartAreaClass} flex items-center justify-center rounded bg-gray-50`}>
              <span className="text-sm text-gray-500">No data yet</span>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="mb-1 flex flex-shrink-0 items-center gap-4">
                <span className="flex items-center gap-1.5 text-xs text-gray-600">
                  <span className="h-2 w-2 rounded-full bg-green-500" /> Income
                </span>
                <span className="flex items-center gap-1.5 text-xs text-gray-600">
                  <span className="h-2 w-2 rounded-full bg-red-500" /> Expenses
                </span>
              </div>
              <div className={`${chartAreaClass} min-h-0`}>
                <div className="absolute inset-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="month" fontSize={10} stroke="#6b7280" tickLine={false} />
                      <YAxis
                        fontSize={10}
                        stroke="#6b7280"
                        tickLine={false}
                        width={40}
                        tickFormatter={(v) => `${(v / 1e6).toFixed(0)}jt`}
                      />
                      <Tooltip
                        formatter={(value: number, name: string) => [
                          formatToRupiah(value),
                          name === 'income' ? 'Income' : 'Expenses',
                        ]}
                        contentStyle={{
                          backgroundColor: 'white',
                          border: '1px solid #e5e7eb',
                          borderRadius: '6px',
                          fontSize: '12px',
                        }}
                      />
                      <Bar dataKey="income" fill="#10b981" radius={[2, 2, 0, 0]} name="income" />
                      <Bar dataKey="expenses" fill="#ef4444" radius={[2, 2, 0, 0]} name="expenses" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

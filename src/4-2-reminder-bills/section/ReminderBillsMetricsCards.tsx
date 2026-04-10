import type { Expense } from '@/shared/hooks/finance/useExpenses';
import { formatToRupiah } from '@/shared/utils/formatCurrency';
import { Calendar, Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import { computeReminderBillsMetricStats } from '../utils/reminderBillsUtils';

type ReminderBillsMetricsCardsProps = {
  expenses: Expense[];
};

export const ReminderBillsMetricsCards = ({ expenses }: ReminderBillsMetricsCardsProps) => {
  const s = computeReminderBillsMetricStats(expenses);

  const metrics = {
    total: {
      count: s.total,
      amount: s.totalAmount,
      icon: Calendar,
      color: 'text-brand-blue',
      bgColor: 'bg-brand-blue/10',
      accentColor: 'bg-brand-blue',
      label: 'Total Recurring Bills',
    },
    dueThisWeek: {
      count: s.dueThisWeek,
      amount: s.dueThisWeekAmount,
      icon: Clock,
      color: 'text-brand-blue',
      bgColor: 'bg-brand-blue/10',
      accentColor: 'bg-brand-blue',
      label: 'Due This Week',
    },
    overdue: {
      count: s.overdue,
      amount: s.overdueAmount,
      icon: AlertTriangle,
      color: 'text-brand-red',
      bgColor: 'bg-brand-red/10',
      accentColor: 'bg-brand-red',
      label: 'Overdue',
    },
    completed: {
      count: s.completed,
      amount: s.completedAmount,
      icon: CheckCircle,
      color: 'text-brand-blue',
      bgColor: 'bg-brand-blue/10',
      accentColor: 'bg-brand-blue',
      label: 'Completed',
    },
  };

  const cards = ['total', 'dueThisWeek', 'overdue', 'completed'] as const;

  return (
    <>
      {cards.map((key) => {
        const metric = metrics[key];
        const Icon = metric.icon;

        return (
          <div key={key} className="rounded-md border border-border bg-card p-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="mb-1 text-xs font-medium text-muted-foreground">{metric.label}</div>
                <div className="text-lg font-bold text-foreground">{metric.count}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{formatToRupiah(metric.amount)}</div>
              </div>
              <div className={`rounded-md p-2 ${metric.bgColor}`}>
                <Icon className={`h-4 w-4 ${metric.color}`} />
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
};

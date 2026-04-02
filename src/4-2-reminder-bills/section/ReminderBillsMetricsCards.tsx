import type { Expense } from '@/shared/hooks/finance/useExpenses';
import { formatToRupiah } from '@/utils/formatCurrency';
import { Calendar, Clock, AlertTriangle, CheckCircle } from 'lucide-react';

type ReminderBillsMetricsCardsProps = {
  expenses: Expense[];
};

export const ReminderBillsMetricsCards = ({ expenses }: ReminderBillsMetricsCardsProps) => {
  // Align with reminder table: recurring masters only, not settlement rows, not dismissed from reminder
  const recurringExpenses = expenses.filter(
    (expense) =>
      expense.is_recurring &&
      !expense.recurring_settlement_for_expense_id &&
      !expense.exclude_from_reminder_bills
  );
  
  const metrics = {
    total: {
      count: recurringExpenses.length,
      amount: recurringExpenses.reduce((sum, expense) => sum + expense.amount, 0),
      icon: Calendar,
      color: 'text-brand-blue',
      bgColor: 'bg-brand-blue/10',
      accentColor: 'bg-brand-blue',
      label: 'Total Recurring Bills'
    },
    dueThisWeek: {
      count: recurringExpenses.filter(expense => {
        if (!expense.next_payment_date) return false;
        const nextDate = new Date(expense.next_payment_date);
        const today = new Date();
        const diffDays = Math.ceil((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays <= 7 && diffDays >= 0;
      }).length,
      amount: recurringExpenses
        .filter(expense => {
          if (!expense.next_payment_date) return false;
          const nextDate = new Date(expense.next_payment_date);
          const today = new Date();
          const diffDays = Math.ceil((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          return diffDays <= 7 && diffDays >= 0;
        })
        .reduce((sum, expense) => sum + expense.amount, 0),
      icon: Clock,
      color: 'text-brand-blue',
      bgColor: 'bg-brand-blue/10',
      accentColor: 'bg-brand-blue',
      label: 'Due This Week'
    },
    overdue: {
      count: recurringExpenses.filter(expense => {
        if (!expense.next_payment_date) return false;
        const nextDate = new Date(expense.next_payment_date);
        const today = new Date();
        return nextDate < today;
      }).length,
      amount: recurringExpenses
        .filter(expense => {
          if (!expense.next_payment_date) return false;
          const nextDate = new Date(expense.next_payment_date);
          const today = new Date();
          return nextDate < today;
        })
        .reduce((sum, expense) => sum + expense.amount, 0),
      icon: AlertTriangle,
      color: 'text-brand-red',
      bgColor: 'bg-brand-red/10',
      accentColor: 'bg-brand-red',
      label: 'Overdue'
    },
    completed: {
      count: recurringExpenses.filter(expense => expense.status === 'paid').length,
      amount: recurringExpenses
        .filter(expense => expense.status === 'paid')
        .reduce((sum, expense) => sum + expense.amount, 0),
      icon: CheckCircle,
      color: 'text-brand-blue',
      bgColor: 'bg-brand-blue/10',
      accentColor: 'bg-brand-blue',
      label: 'Completed'
    }
  };

  const cards = ['total', 'dueThisWeek', 'overdue', 'completed'] as const;

  return (
    <>
      {cards.map((key) => {
        const metric = metrics[key];
        const Icon = metric.icon;
        
        return (
          <div key={key} className="bg-card rounded-md border border-border p-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="text-xs font-medium text-muted-foreground mb-1">{metric.label}</div>
                <div className="text-lg font-bold text-foreground">{metric.count}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {formatToRupiah(metric.amount)}
                </div>
              </div>
              <div className={`p-2 rounded-md ${metric.bgColor}`}>
                <Icon className={`h-4 w-4 ${metric.color}`} />
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
};

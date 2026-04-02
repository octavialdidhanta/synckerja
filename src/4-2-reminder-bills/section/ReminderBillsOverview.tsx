import { Expense } from '@/shared/hooks/finance/useExpenses';
import { formatToRupiah } from '@/utils/formatCurrency';
import { Badge } from '@/shared/components/ui/badge';
import { Calendar, Clock, AlertTriangle, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';

interface ReminderBillsOverviewProps {
  bills?: Expense[];
}

export const ReminderBillsOverview = ({ bills: providedBills }: ReminderBillsOverviewProps) => {
  // Use provided bills or use empty array (will be handled by parent)
  const bills = providedBills || [];

  // Calculate metrics
  const totalAmount = bills.reduce((sum, bill) => sum + bill.amount, 0);
  const overdueCount = bills.filter(bill => {
    if (!bill.next_payment_date) return false;
    const nextDate = new Date(bill.next_payment_date);
    const today = new Date();
    return nextDate < today;
  }).length;
  const dueThisWeekCount = bills.filter(bill => {
    if (!bill.next_payment_date) return false;
    const nextDate = new Date(bill.next_payment_date);
    const today = new Date();
    const diffDays = Math.ceil((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= 7 && diffDays >= 0;
  }).length;
  const paidCount = bills.filter(bill => bill.status === 'paid').length;
  
  // Get this month bills
  const thisMonth = new Date();
  const thisMonthBills = bills.filter(bill => {
    if (!bill.next_payment_date) return false;
    const billDate = new Date(bill.next_payment_date);
    return billDate.getMonth() === thisMonth.getMonth() && 
           billDate.getFullYear() === thisMonth.getFullYear();
  });
  const thisMonthTotal = thisMonthBills.reduce((sum, bill) => sum + bill.amount, 0);

  // Get recent bills (last 5)
  const recentBills = bills
    .filter(bill => bill.next_payment_date)
    .sort((a, b) => new Date(a.next_payment_date!).getTime() - new Date(b.next_payment_date!).getTime())
    .slice(0, 5);

  const getDaysUntilDue = (dateString: string) => {
    const dueDate = new Date(dateString);
    const today = new Date();
    const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'Overdue';
    if (diffDays === 0) return 'Due today';
    if (diffDays === 1) return 'Due tomorrow';
    return `${diffDays} days`;
  };

  const getStatusIcon = (bill: Expense) => {
    if (bill.next_payment_date) {
      const nextDate = new Date(bill.next_payment_date);
      const today = new Date();
      if (nextDate < today) {
        return <AlertTriangle className="h-3.5 w-3.5 text-brand-red" />;
      }
    }
    if (bill.status === 'paid') {
      return <Calendar className="h-3.5 w-3.5 text-brand-blue" />;
    }
    return <Clock className="h-3.5 w-3.5 text-brand-blue" />;
  };

  const getStatusColor = (bill: Expense) => {
    if (bill.next_payment_date) {
      const nextDate = new Date(bill.next_payment_date);
      const today = new Date();
      if (nextDate < today) {
        return 'bg-brand-red/10 text-brand-red';
      }
    }
    if (bill.status === 'paid') {
      return 'bg-brand-blue/10 text-brand-blue';
    }
    return 'bg-brand-blue/10 text-brand-blue';
  };

  const getStatusText = (bill: Expense) => {
    if (bill.next_payment_date) {
      const nextDate = new Date(bill.next_payment_date);
      const today = new Date();
      if (nextDate < today) {
        return 'Overdue';
      }
    }
    if (bill.status === 'paid') {
      return 'Paid';
    }
    return 'Pending';
  };

  return (
    <div className="space-y-4">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 gap-3">
        <div className="p-3 bg-brand-blue/10 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-brand-blue" />
              <span className="text-xs font-medium text-brand-blue">Total Amount</span>
            </div>
          </div>
          <div className="text-lg font-bold text-brand-blue">{formatToRupiah(totalAmount)}</div>
          <div className="text-xs text-brand-blue mt-1">{bills.length} bills</div>
        </div>

        <div className="p-3 bg-brand-blue/10 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-brand-blue" />
              <span className="text-xs font-medium text-brand-blue">Due This Week</span>
            </div>
          </div>
          <div className="text-lg font-bold text-brand-blue">{dueThisWeekCount}</div>
          <div className="text-xs text-brand-blue mt-1">Awaiting payment</div>
        </div>

        <div className="p-3 bg-brand-red/10 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-brand-red" />
              <span className="text-xs font-medium text-brand-red">Overdue</span>
            </div>
          </div>
          <div className="text-lg font-bold text-brand-red">{overdueCount}</div>
          <div className="text-xs text-brand-red mt-1">Requires attention</div>
        </div>
      </div>

      {/* This Month */}
      <div className="p-3 bg-card rounded-lg border border-border">
        <div className="text-xs font-medium text-muted-foreground mb-2">This Month</div>
        <div className="text-sm font-semibold text-foreground">{formatToRupiah(thisMonthTotal)}</div>
        <div className="text-xs text-muted-foreground mt-1">{thisMonthBills.length} bills</div>
      </div>

      {/* Recent Bills */}
      <div>
        <div className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Recent Bills</div>
        <div className="space-y-2">
          {recentBills.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No upcoming bills</p>
          ) : (
            recentBills.map((bill) => (
              <div key={bill.id} className="flex items-start gap-3 p-2 bg-card rounded-md border border-border hover:bg-muted/50 transition-colors">
                <div className="p-1 rounded bg-muted/30 flex-shrink-0">
                  {getStatusIcon(bill)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">
                    {bill.expense_name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {bill.category}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className={`text-xs px-1.5 py-0.5 ${getStatusColor(bill)}`}>
                      {getStatusText(bill)}
                    </Badge>
                    {bill.next_payment_date && (
                      <span className="text-xs text-muted-foreground/70">
                        {format(new Date(bill.next_payment_date), 'MMM dd')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-semibold text-foreground">
                    {formatToRupiah(bill.amount)}
                  </p>
                  {bill.next_payment_date && (
                    <p className="text-xs text-muted-foreground">
                      {getDaysUntilDue(bill.next_payment_date)}
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

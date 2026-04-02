import { Expense } from '@/shared/hooks/finance/useExpenses';
import { isRecurringBillPayNowEligible } from '@/4-2-reminder-bills/utils/reminderBillsUtils';
import { formatToRupiah } from '@/shared/utils/formatCurrency';
import { Badge } from '@/shared/components/ui/badge';
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { Building, Calendar, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { ActionsDropdown } from '@/4-2-dashboard/components/ActionsDropdown';

interface ReminderBillsTableProps {
  bills: Expense[];
  isLoading?: boolean;
  onRefresh?: () => void;
  onViewDetails: (bill: Expense) => void;
  onEdit: (bill: Expense) => void;
  onDelete: (bill: Expense) => void;
  onPayNow?: (bill: Expense) => void;
}

export const ReminderBillsTable = ({
  bills,
  isLoading = false,
  onRefresh: _onRefresh,
  onViewDetails,
  onEdit,
  onDelete,
  onPayNow,
}: ReminderBillsTableProps) => {
  const getStatusBadge = (bill: Expense) => {
    // Check if overdue
    if (bill.next_payment_date) {
      const nextDate = new Date(bill.next_payment_date);
      const today = new Date();
      if (nextDate < today) {
        return (
          <Badge className="bg-brand-red/10 text-brand-red text-xs font-medium px-2 py-0.5 rounded-full">
            Overdue
          </Badge>
        );
      }
    }

    // Check status
    switch (bill.status?.toLowerCase()) {
      case 'paid':
        return (
          <Badge className="bg-brand-blue/10 text-brand-blue text-xs font-medium px-2 py-0.5 rounded-full">
            Paid
          </Badge>
        );
      case 'pending':
        return (
          <Badge className="bg-brand-blue/10 text-brand-blue text-xs font-medium px-2 py-0.5 rounded-full">
            Pending
          </Badge>
        );
      default:
        return (
          <Badge className="bg-brand-blue/10 text-brand-blue text-xs font-medium px-2 py-0.5 rounded-full">
            Active
          </Badge>
        );
    }
  };

  const getFrequencyText = (frequency: string) => {
    switch (frequency) {
      case 'monthly': return 'Monthly';
      case 'quarterly': return 'Quarterly';
      case 'annually': return 'Annually';
      case 'weekly': return 'Weekly';
      case 'daily': return 'Daily';
      default: return 'Monthly';
    }
  };

  const getDaysUntilDue = (dateString: string) => {
    const dueDate = new Date(dateString);
    const today = new Date();
    const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'Overdue';
    if (diffDays === 0) return 'Due today';
    if (diffDays === 1) return 'Due tomorrow';
    return `${diffDays} days`;
  };

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-muted rounded w-1/4"></div>
          <div className="h-10 bg-muted rounded"></div>
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b flex-shrink-0">
        <h2 className="text-sm font-semibold text-foreground">Reminder Bills</h2>
      </div>

      {/* Horizontal scroll only; vertikal mengikuti scroll halaman */}
      <div className="min-h-0 min-w-0 flex-1 overflow-x-auto">
        <table className="w-full min-w-[1200px] caption-bottom text-sm">
          <TableHeader className="sticky top-0 z-10 bg-muted/30 shadow-sm">
            <TableRow className="bg-muted/30">
              <TableHead className="h-8 px-3 text-xs font-medium">Bill Name</TableHead>
              <TableHead className="h-8 px-3 text-xs font-medium">Category</TableHead>
              <TableHead className="h-8 px-3 text-xs font-medium">Amount</TableHead>
              <TableHead className="h-8 px-3 text-xs font-medium">Frequency</TableHead>
              <TableHead className="h-8 px-3 text-xs font-medium">Next Due Date</TableHead>
              <TableHead className="h-8 px-3 text-xs font-medium">Status</TableHead>
              <TableHead className="h-8 px-3 text-xs font-medium">Department</TableHead>
              <TableHead className="h-8 px-3 text-xs font-medium w-16">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bills.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-16 text-center">
                  <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground mb-1">No recurring bills found</p>
                  <p className="text-xs text-muted-foreground/70">Create your first recurring bill to get started</p>
                </TableCell>
              </TableRow>
            ) : (
              bills.map((bill) => (
                <TableRow key={bill.id} className="hover:bg-muted/50">
                  <TableCell className="px-3 py-2 text-xs">
                    <div className="flex items-start gap-2">
                      <div className="p-1.5 rounded-md bg-brand-blue/10 flex-shrink-0">
                        <DollarSign className="h-3.5 w-3.5 text-brand-blue" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-foreground truncate">
                          {bill.expense_name}
                        </div>
                        <div className="text-xs text-muted-foreground truncate mt-0.5">
                          {bill.expense_type}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-3 py-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded-md bg-muted/30">
                        <DollarSign className="h-3 w-3 text-muted-foreground" />
                      </div>
                      <span>{bill.category}</span>
                    </div>
                  </TableCell>
                  <TableCell className="px-3 py-2 text-xs">
                    <div className="font-bold text-foreground">{formatToRupiah(bill.amount)}</div>
                  </TableCell>
                  <TableCell className="px-3 py-2 text-xs">
                    <Badge variant="outline" className="text-xs">
                      {getFrequencyText(bill.recurring_frequency || 'monthly')}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-3 py-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded-md bg-muted/30">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                      </div>
                      <div>
                        {bill.next_payment_date ? (
                          <>
                            <div className="font-medium text-foreground">
                              {format(new Date(bill.next_payment_date), 'MMM dd, yyyy')}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {getDaysUntilDue(bill.next_payment_date)}
                            </div>
                          </>
                        ) : (
                          <span className="text-muted-foreground/70">Not scheduled</span>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-3 py-2 text-xs">
                    {getStatusBadge(bill)}
                  </TableCell>
                  <TableCell className="px-3 py-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded-md bg-muted/30">
                        <Building className="h-3 w-3 text-muted-foreground" />
                      </div>
                      <span>{bill.department || 'Not specified'}</span>
                    </div>
                  </TableCell>
                  <TableCell className="px-3 py-2 text-xs">
                    <ActionsDropdown
                      onViewDetails={() => onViewDetails(bill)}
                      onEdit={() => onEdit(bill)}
                      onDelete={() => onDelete(bill)}
                      showPayNow={isRecurringBillPayNowEligible(bill) && !!onPayNow}
                      onPayNow={onPayNow ? () => onPayNow(bill) : undefined}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </table>
      </div>
    </div>
  );
};

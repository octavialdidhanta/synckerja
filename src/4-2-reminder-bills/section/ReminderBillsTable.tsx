import { Expense } from '@/shared/hooks/finance/useExpenses';
import { isRecurringBillPayNowEligible } from '@/4-2-reminder-bills/utils/reminderBillsUtils';
import { formatToRupiah } from '@/shared/utils/formatCurrency';
import { Badge } from '@/shared/components/ui/badge';
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Building, Calendar, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { ActionsDropdown } from '@/4-2-dashboard/components/ActionsDropdown';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { cn } from '@/shared/lib/utils';

const SCROLL_HIDE =
  'scrollbar-hide [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

export type ReminderBillsTableVariant = 'module' | 'mobileCard';

interface ReminderBillsTableProps {
  bills: Expense[];
  isLoading?: boolean;
  onRefresh?: () => void;
  onViewDetails: (bill: Expense) => void;
  onEdit: (bill: Expense) => void;
  onDelete: (bill: Expense) => void;
  onPayNow?: (bill: Expense) => void;
  variant?: ReminderBillsTableVariant;
}

export const ReminderBillsTable = ({
  bills,
  isLoading = false,
  onRefresh: _onRefresh,
  onViewDetails,
  onEdit,
  onDelete,
  onPayNow,
  variant = 'module',
}: ReminderBillsTableProps) => {
  const { t } = useAppTranslation();
  const isMobileCard = variant === 'mobileCard';

  const getStatusBadge = (bill: Expense) => {
    if (bill.next_payment_date) {
      const nextDate = new Date(bill.next_payment_date);
      const today = new Date();
      if (nextDate < today) {
        return (
          <Badge className="rounded-full bg-brand-red/10 px-2 py-0.5 text-xs font-medium text-brand-red">
            {t('reminderBills.status.overdue', 'Overdue')}
          </Badge>
        );
      }
    }

    switch (bill.status?.toLowerCase()) {
      case 'paid':
        return (
          <Badge className="rounded-full bg-brand-blue/10 px-2 py-0.5 text-xs font-medium text-brand-blue">
            {t('reminderBills.status.paid', 'Paid')}
          </Badge>
        );
      case 'pending':
        return (
          <Badge className="rounded-full bg-brand-blue/10 px-2 py-0.5 text-xs font-medium text-brand-blue">
            {t('reminderBills.status.pending', 'Pending')}
          </Badge>
        );
      default:
        return (
          <Badge className="rounded-full bg-brand-blue/10 px-2 py-0.5 text-xs font-medium text-brand-blue">
            {t('reminderBills.status.active', 'Active')}
          </Badge>
        );
    }
  };

  const getFrequencyText = (frequency: string) => {
    switch (frequency) {
      case 'monthly':
        return t('reminderBills.frequency.monthly', 'Monthly');
      case 'quarterly':
        return t('reminderBills.frequency.quarterly', 'Quarterly');
      case 'annually':
        return t('reminderBills.frequency.annually', 'Annually');
      case 'weekly':
        return t('reminderBills.frequency.weekly', 'Weekly');
      case 'daily':
        return t('reminderBills.frequency.daily', 'Daily');
      default:
        return t('reminderBills.frequency.monthly', 'Monthly');
    }
  };

  const getDaysUntilDue = (dateString: string) => {
    const dueDate = new Date(dateString);
    const today = new Date();
    const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return t('reminderBills.due.overdue', 'Overdue');
    if (diffDays === 0) return t('reminderBills.due.today', 'Due today');
    if (diffDays === 1) return t('reminderBills.due.tomorrow', 'Due tomorrow');
    return `${diffDays} ${t('reminderBills.due.daysLabel', 'days')}`;
  };

  const cellPx = isMobileCard ? 'px-2 py-2' : 'px-3 py-2';

  const skeletonRows = Array.from({ length: 6 }).map((_, rowIndex) => (
    <TableRow key={rowIndex} className="border-b">
      {Array.from({ length: 8 }).map((__, ci) => (
        <TableCell key={ci} className={cellPx}>
          <Skeleton className="h-4 w-full max-w-[100px]" />
        </TableCell>
      ))}
    </TableRow>
  ));

  if (isLoading && !isMobileCard) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-2">
          <div className="h-4 w-1/4 rounded bg-muted" />
          <div className="h-10 rounded bg-muted" />
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 rounded bg-muted" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const scrollWrapClass = cn(
    'min-w-0 overflow-x-auto',
    isMobileCard
      ? 'nested-scroll-touch-chain-xy scrollbar-hide seamless-scroll max-h-[50vh] min-h-0 flex-1 touch-pan-x overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
      : 'min-h-0 flex-1',
    isMobileCard && SCROLL_HIDE,
  );

  const tableSection = (
    <div className={scrollWrapClass}>
      <table className="w-full min-w-[1200px] caption-bottom text-sm">
        <TableHeader
          className={cn(
            'sticky top-0 z-10',
            isMobileCard ? 'border-b border-white/20 bg-brand-blue' : 'bg-muted/30 shadow-sm',
          )}
        >
          {isMobileCard ? (
            <TableRow className="border-b border-white/20 bg-brand-blue hover:bg-brand-blue">
              <TableHead className="h-8 whitespace-nowrap bg-brand-blue px-2 py-2 text-left text-xs font-medium text-white">
                {t('reminderBills.table.billName', 'Bill Name')}
              </TableHead>
              <TableHead className="h-8 whitespace-nowrap bg-brand-blue px-2 py-2 text-left text-xs font-medium text-white">
                {t('reminderBills.table.category', 'Category')}
              </TableHead>
              <TableHead className="h-8 whitespace-nowrap bg-brand-blue px-2 py-2 text-left text-xs font-medium text-white">
                {t('reminderBills.table.amount', 'Amount')}
              </TableHead>
              <TableHead className="h-8 whitespace-nowrap bg-brand-blue px-2 py-2 text-left text-xs font-medium text-white">
                {t('reminderBills.table.frequency', 'Frequency')}
              </TableHead>
              <TableHead className="h-8 whitespace-nowrap bg-brand-blue px-2 py-2 text-left text-xs font-medium text-white">
                {t('reminderBills.table.nextDue', 'Next Due Date')}
              </TableHead>
              <TableHead className="h-8 whitespace-nowrap bg-brand-blue px-2 py-2 text-left text-xs font-medium text-white">
                {t('reminderBills.table.status', 'Status')}
              </TableHead>
              <TableHead className="h-8 whitespace-nowrap bg-brand-blue px-2 py-2 text-left text-xs font-medium text-white">
                {t('reminderBills.table.department', 'Department')}
              </TableHead>
              <TableHead className="h-8 w-16 whitespace-nowrap bg-brand-blue px-2 py-2 text-left text-xs font-medium text-white">
                {t('reminderBills.table.actions', 'Actions')}
              </TableHead>
            </TableRow>
          ) : (
            <TableRow className="bg-muted/30">
              <TableHead className="h-8 px-3 text-xs font-medium">Bill Name</TableHead>
              <TableHead className="h-8 px-3 text-xs font-medium">Category</TableHead>
              <TableHead className="h-8 px-3 text-xs font-medium">Amount</TableHead>
              <TableHead className="h-8 px-3 text-xs font-medium">Frequency</TableHead>
              <TableHead className="h-8 px-3 text-xs font-medium">Next Due Date</TableHead>
              <TableHead className="h-8 px-3 text-xs font-medium">Status</TableHead>
              <TableHead className="h-8 px-3 text-xs font-medium">Department</TableHead>
              <TableHead className="h-8 w-16 px-3 text-xs font-medium">Actions</TableHead>
            </TableRow>
          )}
        </TableHeader>
        <TableBody>
          {isLoading && isMobileCard ? (
            skeletonRows
          ) : bills.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className={cn('h-16 text-center', isMobileCard && 'py-8')}>
                <Calendar className="mx-auto mb-2 h-12 w-12 text-muted-foreground" />
                <p className="mb-1 text-sm text-muted-foreground">
                  {t('reminderBills.table.emptyTitle', 'No recurring bills found')}
                </p>
                <p className="text-xs text-muted-foreground/70">
                  {t('reminderBills.table.emptyHint', 'Create your first recurring bill to get started')}
                </p>
              </TableCell>
            </TableRow>
          ) : (
            bills.map((bill) => (
              <TableRow key={bill.id} className="hover:bg-muted/50">
                <TableCell className={cn(cellPx, 'text-xs')}>
                  <div className="flex items-start gap-2">
                    <div className="flex-shrink-0 rounded-md bg-brand-blue/10 p-1.5">
                      <DollarSign className="h-3.5 w-3.5 text-brand-blue" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-foreground">{bill.expense_name}</div>
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">{bill.expense_type}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className={cn(cellPx, 'text-xs text-muted-foreground')}>
                  <div className="flex items-center gap-2">
                    <div className="rounded-md bg-muted/30 p-1">
                      <DollarSign className="h-3 w-3 text-muted-foreground" />
                    </div>
                    <span>{bill.category}</span>
                  </div>
                </TableCell>
                <TableCell className={cn(cellPx, 'text-xs')}>
                  <div className="font-bold text-foreground">{formatToRupiah(bill.amount)}</div>
                </TableCell>
                <TableCell className={cn(cellPx, 'text-xs')}>
                  <Badge variant="outline" className="text-xs">
                    {getFrequencyText(bill.recurring_frequency || 'monthly')}
                  </Badge>
                </TableCell>
                <TableCell className={cn(cellPx, 'text-xs text-muted-foreground')}>
                  <div className="flex items-center gap-2">
                    <div className="rounded-md bg-muted/30 p-1">
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
                        <span className="text-muted-foreground/70">
                          {t('reminderBills.table.notScheduled', 'Not scheduled')}
                        </span>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell className={cn(cellPx, 'text-xs')}>{getStatusBadge(bill)}</TableCell>
                <TableCell className={cn(cellPx, 'text-xs text-muted-foreground')}>
                  <div className="flex items-center gap-2">
                    <div className="rounded-md bg-muted/30 p-1">
                      <Building className="h-3 w-3 text-muted-foreground" />
                    </div>
                    <span>{bill.department || t('reminderBills.table.notSpecified', 'Not specified')}</span>
                  </div>
                </TableCell>
                <TableCell className={cn(cellPx, 'text-xs')}>
                  <ActionsDropdown
                    onViewDetails={() => onViewDetails(bill)}
                    onEdit={() => onEdit(bill)}
                    onDelete={() => onDelete(bill)}
                    showPayNow={isRecurringBillPayNowEligible(bill) && !!onPayNow}
                    onPayNow={onPayNow ? () => onPayNow(bill) : undefined}
                    triggerButtonClassName={isMobileCard ? 'h-10 w-10 touch-manipulation p-0' : undefined}
                  />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </table>
    </div>
  );

  if (isMobileCard) {
    return <div className="min-w-0 w-full">{tableSection}</div>;
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex flex-shrink-0 items-center justify-between border-b px-4 py-2">
        <h2 className="text-sm font-semibold text-foreground">
          {t('reminderBills.table.sectionTitle', 'Reminder Bills')}
        </h2>
      </div>
      {tableSection}
    </div>
  );
};

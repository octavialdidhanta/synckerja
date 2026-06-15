import { lazy, Suspense, useState, useMemo, useCallback } from 'react';
import { Plus, MoreHorizontal, Edit, Trash2, Eye, FileDown, Wallet } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { Badge } from '@/shared/components/ui/badge';
import { useIncomeTransactions } from '@/4-1-dashboard/hooks';
import { formatToRupiah } from '@/shared/utils/formatCurrency';
import { format } from 'date-fns';
import { IncomeTransactionWithRelations } from '@/4-1-dashboard/types';
import { useBankAccounts, type BankAccount } from '@/shared/hooks/finance/useBankAccounts';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { getIncomeTransactionIdDisplay } from '@/4-1-dashboard/utils/incomeTransactionDisplayId';
import { isIncomeAllocationIncomplete, incomeStatusBadgeVariant } from '@/4-1-dashboard/utils/incomeAllocationStatus';
import { useCanAllocateIncome } from '@/4-1-dashboard/hooks/useCanAllocateIncome';

const IncomeTransactionTableDialogs = lazy(() =>
  import('./IncomeTransactionTableDialogs').then((m) => ({
    default: m.IncomeTransactionTableDialogs,
  })),
);

interface IncomeTransactionTableProps {
  transactions: any[];
  onRefresh?: () => void;
}

export const IncomeTransactionTable = ({ transactions, onRefresh }: IncomeTransactionTableProps) => {
  const { t } = useAppTranslation();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<IncomeTransactionWithRelations | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAllocationDialogOpen, setIsAllocationDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const { canAllocateIncome } = useCanAllocateIncome();
  const { deleteIncomeTransaction, isDeleting } = useIncomeTransactions();
  const [mountDialogs, setMountDialogs] = useState(false);
  const ensureDialogs = useCallback(() => setMountDialogs(true), []);
  const { bankAccounts } = useBankAccounts({ includeInactive: true });
  const bankById = useMemo(
    () => new Map<string, BankAccount>(bankAccounts.map((b) => [b.id, b])),
    [bankAccounts]
  );

  const getStatusBadgeVariant = (status: string) => incomeStatusBadgeVariant(status);

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return t('incomes.deposit.statusPending', 'Menunggu deposit');
      case 'deposited':
        return t('incomes.deposit.statusDeposited', 'Uang masuk');
      case 'completed':
        return t('incomes.deposit.statusCompleted', 'Completed');
      case 'cancelled':
        return t('incomes.deposit.statusCancelled', 'Cancelled');
      default:
        return status;
    }
  };

  const handleViewDetails = (transaction: IncomeTransactionWithRelations) => {
    ensureDialogs();
    setSelectedTransaction(transaction);
    setIsViewDialogOpen(true);
  };

  const handleEdit = (transaction: IncomeTransactionWithRelations) => {
    ensureDialogs();
    setSelectedTransaction(transaction);
    setIsEditDialogOpen(true);
  };

  const handleAllocate = (transaction: IncomeTransactionWithRelations) => {
    ensureDialogs();
    setSelectedTransaction(transaction);
    setIsAllocationDialogOpen(true);
  };

  const handleDelete = (transaction: IncomeTransactionWithRelations) => {
    ensureDialogs();
    setSelectedTransaction(transaction);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (!selectedTransaction) return;
    
    deleteIncomeTransaction(selectedTransaction.id, {
      onSuccess: () => {
        setIsDeleteDialogOpen(false);
        setSelectedTransaction(null);
        if (onRefresh) {
          onRefresh();
        }
      }
    });
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {/* Header */}
      <div className="flex flex-shrink-0 items-center justify-between border-b border-border px-4 py-2">
        <h2 className="text-sm font-semibold text-gray-900">Income Transactions</h2>
        {canAllocateIncome ? (
          <Button
            type="button"
            size="sm"
            className="h-8 px-3 text-xs"
            onClick={() => {
              ensureDialogs();
              setIsAddDialogOpen(true);
            }}
          >
            <Plus className="mr-1 h-3 w-3" />
            {t('incomes.addIncome', 'Add Income')}
          </Button>
        ) : null}
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Table
          containerClassName="scrollbar-hide seamless-scroll min-h-0 min-w-0 flex-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <TableHeader className="sticky top-0 z-20">
            <TableRow className="bg-gray-50">
              <TableHead className="h-8 w-[200px] min-w-[200px] px-3 text-xs font-medium bg-gray-50">Transaction</TableHead>
              <TableHead className="h-8 w-[130px] min-w-[130px] px-3 text-xs font-medium bg-gray-50">Customer</TableHead>
              <TableHead className="h-8 w-[160px] min-w-[160px] px-3 text-xs font-medium bg-gray-50">
                Service
              </TableHead>
              <TableHead className="h-8 w-[150px] min-w-[150px] px-3 text-xs font-medium bg-gray-50">Type & Category</TableHead>
              <TableHead className="h-8 px-3 text-xs font-medium bg-gray-50">Amount</TableHead>
              <TableHead className="h-8 min-w-[150px] w-[150px] px-3 text-xs font-medium bg-gray-50">Payment Method</TableHead>
              <TableHead className="h-8 min-w-[200px] w-[200px] px-3 text-xs font-medium bg-gray-50">Bank Account</TableHead>
              <TableHead className="h-8 w-[118px] min-w-[118px] px-3 text-xs font-medium bg-gray-50">Recurring</TableHead>
              <TableHead className="h-8 px-3 text-xs font-medium bg-gray-50">Receipt</TableHead>
              <TableHead className="h-8 px-3 text-xs font-medium bg-gray-50">Status</TableHead>
              <TableHead className="h-8 w-[130px] min-w-[130px] px-3 text-xs font-medium bg-gray-50">
                {t('incomes.tableTransactionId', 'Transaction ID')}
              </TableHead>
              <TableHead className="h-8 w-[110px] min-w-[110px] px-3 text-xs font-medium bg-gray-50">Date</TableHead>
              <TableHead className="h-8 px-3 text-xs font-medium w-16 bg-gray-50">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={13} className="h-16 text-center text-xs text-gray-500">
                  No transactions found
                </TableCell>
              </TableRow>
            ) : (
              transactions.map((transaction) => {
                const needsAllocation = isIncomeAllocationIncomplete(transaction);
                const canAllocateRow =
                  transaction.status === 'deposited' && needsAllocation;
                return (
                <TableRow
                  key={transaction.id}
                  className={
                    transaction.status === 'pending'
                      ? 'hover:bg-amber-50/40 border-l-2 border-l-amber-300'
                      : needsAllocation
                        ? 'hover:bg-amber-50/50 border-l-2 border-l-amber-400'
                        : 'hover:bg-gray-50'
                  }
                >
                  <TableCell className="w-[200px] min-w-[200px] px-3 py-2 text-xs">
                    <div className="font-medium break-words leading-snug line-clamp-2">
                      {transaction.description || 'Transaction'}
                    </div>
                  </TableCell>
                  <TableCell className="w-[130px] min-w-[130px] px-3 py-2 text-xs font-medium">
                    {transaction.customer_name || '-'}
                  </TableCell>
                  <TableCell className="w-[160px] min-w-[160px] px-3 py-2 text-xs align-top">
                    <div className="break-words leading-snug">
                      {transaction.services?.name || '-'}
                    </div>
                    {transaction.sub_services?.name && (
                      <div className="mt-0.5 break-words text-xs text-gray-500">
                        {transaction.sub_services.name}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="w-[150px] min-w-[150px] px-3 py-2 text-xs">
                    <div>
                      {transaction.income_types?.name || 'Unknown'}
                    </div>
                    {transaction.income_categories?.name && (
                      <div className="text-gray-500 text-xs">
                        {transaction.income_categories.name}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="px-3 py-2 text-xs">
                    <div className="font-semibold text-green-600">
                      {formatToRupiah(transaction.amount)}
                    </div>
                  </TableCell>
                  <TableCell className="min-w-[150px] w-[150px] px-3 py-2 text-xs align-top">
                    {transaction.payment_method || '-'}
                  </TableCell>
                  <TableCell className="min-w-[200px] w-[200px] px-3 py-2 text-xs align-top">
                    {(() => {
                      const joined = transaction.bank_accounts;
                      const fromJoin =
                        joined && typeof joined === 'object' && !Array.isArray(joined) && joined.name
                          ? joined
                          : null;
                      const id = transaction.bank_account_id;
                      const fromList =
                        !fromJoin && id ? bankById.get(id) : undefined;
                      const row = fromJoin
                        ? fromJoin
                        : fromList
                          ? {
                              name: fromList.name,
                              bank_name: fromList.bank_name,
                              account_number: fromList.account_number,
                            }
                          : null;
                      if (!row?.name) {
                        return <span className="text-gray-400">-</span>;
                      }
                      return (
                        <div>
                          <div className="font-medium text-wrap break-words">{row.name}</div>
                          {(row.bank_name || row.account_number) && (
                            <div className="text-gray-500 text-xs text-wrap break-words">
                              {[row.bank_name, row.account_number].filter(Boolean).join(' · ')}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="w-[118px] min-w-[118px] px-3 py-2 text-xs">
                    <Badge
                      variant="outline"
                      className={
                        transaction.is_recurring
                          ? "text-xs bg-brand-blue/10 text-brand-blue border-brand-blue/20"
                          : "text-xs"
                      }
                    >
                      {transaction.is_recurring ? (transaction.recurring_frequency ? `Recurring • ${transaction.recurring_frequency}` : "Recurring") : "One-time"}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-3 py-2 text-xs">
                    {transaction.receipt_file_path ? (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 px-2 text-xs hover:bg-brand-blue/10 hover:text-brand-blue"
                        onClick={async () => {
                          try {
                            const path = transaction.receipt_file_path as string;
                            if (path.startsWith('http')) {
                              window.open(path, '_blank');
                              return;
                            }
                            const { supabase } = await import('@/shared/lib/supabaseClient');
                            const { data, error } = await supabase.storage
                              .from('income-receipts')
                              .download(path);
                            if (error) {
                              console.error('Error downloading receipt:', error);
                              return;
                            }
                            const url = URL.createObjectURL(data);
                            const link = document.createElement('a');
                            link.href = url;
                            link.download = transaction.receipt_file_name || `receipt-${transaction.id.substring(0, 8)}`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            URL.revokeObjectURL(url);
                          } catch (err) {
                            console.error('Failed to download receipt:', err);
                          }
                        }}
                      >
                        <FileDown className="h-3 w-3 mr-1" />
                        Download
                      </Button>
                    ) : (
                      <span className="text-gray-400 text-xs">-</span>
                    )}
                  </TableCell>
                  <TableCell className="px-3 py-2 text-xs">
                    <div className="flex flex-col items-start gap-1">
                      <Badge variant={getStatusBadgeVariant(transaction.status)} className="text-xs">
                        {getStatusLabel(transaction.status)}
                      </Badge>
                      {needsAllocation && transaction.status === 'deposited' ? (
                        <Badge variant="outline" className="text-xs border-amber-300 bg-amber-50 text-amber-800">
                          {t('incomes.allocation.badgeNeedsAllocation', 'Needs allocation')}
                        </Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="w-[130px] min-w-[130px] px-3 py-2 text-xs">
                    {(() => {
                      const { display, title } = getIncomeTransactionIdDisplay(transaction);
                      return (
                        <div className="truncate font-mono text-xs" title={title}>
                          {display}
                        </div>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="w-[110px] min-w-[110px] px-3 py-2 text-xs">
                    {format(new Date(transaction.transaction_date), 'MMM dd, yyyy')}
                  </TableCell>
                  <TableCell className="px-3 py-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-6 w-6 p-0">
                          <MoreHorizontal className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem 
                          className="text-xs cursor-pointer"
                          onClick={() => handleViewDetails(transaction)}
                        >
                          <Eye className="mr-2 h-3 w-3" />
                          View Details
                        </DropdownMenuItem>
                        {canAllocateIncome && canAllocateRow ? (
                          <DropdownMenuItem
                            className="text-xs cursor-pointer font-medium text-amber-800"
                            onClick={() => handleAllocate(transaction)}
                          >
                            <Wallet className="mr-2 h-3 w-3" />
                            {t('incomes.allocation.actionAllocate', 'Allocate')}
                          </DropdownMenuItem>
                        ) : null}
                        {canAllocateIncome ? (
                          <DropdownMenuItem
                            className="text-xs cursor-pointer"
                            onClick={() => handleEdit(transaction)}
                          >
                            <Edit className="mr-2 h-3 w-3" />
                            {t('common.edit', 'Edit')}
                          </DropdownMenuItem>
                        ) : null}
                        <DropdownMenuItem
                          className="text-xs text-brand-red cursor-pointer"
                          disabled={!!transaction.has_income_allocations}
                          onClick={() => {
                            if (transaction.has_income_allocations) return;
                            handleDelete(transaction);
                          }}
                        >
                          <Trash2 className="mr-2 h-3 w-3" />
                          {t('common.delete', 'Delete')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {mountDialogs ? (
        <Suspense fallback={null}>
          <IncomeTransactionTableDialogs
            isAddDialogOpen={isAddDialogOpen}
            setIsAddDialogOpen={setIsAddDialogOpen}
            selectedTransaction={selectedTransaction}
            isViewDialogOpen={isViewDialogOpen}
            setIsViewDialogOpen={setIsViewDialogOpen}
            setIsEditDialogOpen={setIsEditDialogOpen}
            isEditDialogOpen={isEditDialogOpen}
            isAllocationDialogOpen={isAllocationDialogOpen}
            setIsAllocationDialogOpen={setIsAllocationDialogOpen}
            isDeleteDialogOpen={isDeleteDialogOpen}
            setIsDeleteDialogOpen={setIsDeleteDialogOpen}
            setSelectedTransaction={setSelectedTransaction}
            confirmDelete={confirmDelete}
            isDeleting={isDeleting}
            onRefresh={onRefresh}
          />
        </Suspense>
      ) : null}
    </div>
  );
};


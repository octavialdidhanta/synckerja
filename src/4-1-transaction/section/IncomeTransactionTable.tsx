import { useState, useMemo } from 'react';
import { Plus, MoreHorizontal, Edit, Trash2, Eye, FileDown } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/shared/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/shared/components/ui/alert-dialog';
import { Badge } from '@/shared/components/ui/badge';
import { useIncomeTransactions } from '@/4-1-dashboard/hooks';
import { IncomeTransactionDialog } from '@/4-1-dashboard/components/IncomeTransactionDialog';
import { IncomeTransactionViewDialog } from './IncomeTransactionViewDialog';
import { formatToRupiah } from '@/shared/utils/formatCurrency';
import { format } from 'date-fns';
import { AddIncomeForm } from '@/4-1-dashboard/components/AddIncomeForm';
import { IncomeTransactionWithRelations } from '@/4-1-dashboard/types';
import { useBankAccounts, type BankAccount } from '@/shared/hooks/finance/useBankAccounts';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { getIncomeTransactionIdDisplay } from '@/4-1-dashboard/utils/incomeTransactionDisplayId';

interface IncomeTransactionTableProps {
  transactions: any[];
  isLoading?: boolean;
  onRefresh?: () => void;
}

export const IncomeTransactionTable = ({ 
  transactions, 
  isLoading = false,
  onRefresh 
}: IncomeTransactionTableProps) => {
  const { t } = useAppTranslation();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<IncomeTransactionWithRelations | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const { deleteIncomeTransaction, isDeleting } = useIncomeTransactions();
  const { bankAccounts } = useBankAccounts({ includeInactive: true });
  const bankById = useMemo(
    () => new Map<string, BankAccount>(bankAccounts.map((b) => [b.id, b])),
    [bankAccounts]
  );

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'pending':
        return 'secondary';
      case 'cancelled':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const handleViewDetails = (transaction: IncomeTransactionWithRelations) => {
    setSelectedTransaction(transaction);
    setIsViewDialogOpen(true);
  };

  const handleEdit = (transaction: IncomeTransactionWithRelations) => {
    setSelectedTransaction(transaction);
    setIsEditDialogOpen(true);
  };

  const handleDelete = (transaction: IncomeTransactionWithRelations) => {
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

  if (isLoading) {
    return null;
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {/* Header */}
      <div className="flex flex-shrink-0 items-center justify-between border-b border-border px-4 py-2">
        <h2 className="text-sm font-semibold text-gray-900">Income Transactions</h2>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="h-8 px-3 text-xs">
              <Plus className="h-3 w-3 mr-1" />
              Add Income
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Income Transaction</DialogTitle>
              <DialogDescription>
                Create a new income transaction record
              </DialogDescription>
            </DialogHeader>
            <AddIncomeForm onSuccess={() => setIsAddDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Table
          containerClassName="scrollbar-hide seamless-scroll min-h-0 min-w-0 flex-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <TableHeader className="sticky top-0 z-20">
            <TableRow className="bg-gray-50">
              <TableHead className="h-8 w-[200px] min-w-[200px] px-3 text-xs font-medium bg-gray-50">Transaction</TableHead>
              <TableHead className="h-8 w-[130px] min-w-[130px] px-3 text-xs font-medium bg-gray-50">Customer</TableHead>
              <TableHead className="h-8 px-3 text-xs font-medium bg-gray-50">Service</TableHead>
              <TableHead className="h-8 w-[150px] min-w-[150px] px-3 text-xs font-medium bg-gray-50">Type & Category</TableHead>
              <TableHead className="h-8 px-3 text-xs font-medium bg-gray-50">Amount</TableHead>
              <TableHead className="h-8 px-3 text-xs font-medium bg-gray-50">Payment Method</TableHead>
              <TableHead className="h-8 px-3 text-xs font-medium bg-gray-50">Bank Account</TableHead>
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
              transactions.map((transaction) => (
                <TableRow key={transaction.id} className="hover:bg-gray-50">
                  <TableCell className="w-[200px] min-w-[200px] px-3 py-2 text-xs">
                    <div className="font-medium break-words leading-snug line-clamp-2">
                      {transaction.description || 'Transaction'}
                    </div>
                  </TableCell>
                  <TableCell className="w-[130px] min-w-[130px] px-3 py-2 text-xs font-medium">
                    {transaction.customer_name || '-'}
                  </TableCell>
                  <TableCell className="px-3 py-2 text-xs">
                    <div>
                      {transaction.services?.name || '-'}
                    </div>
                    {transaction.sub_services?.name && (
                      <div className="text-gray-500 text-xs">
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
                  <TableCell className="px-3 py-2 text-xs">
                    {transaction.payment_method || '-'}
                  </TableCell>
                  <TableCell className="px-3 py-2 text-xs max-w-[10rem]">
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
                    <Badge variant={getStatusBadgeVariant(transaction.status)} className="text-xs">
                      {transaction.status}
                    </Badge>
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
                        <DropdownMenuItem 
                          className="text-xs cursor-pointer"
                          onClick={() => handleEdit(transaction)}
                        >
                          <Edit className="mr-2 h-3 w-3" />
                          Edit
                        </DropdownMenuItem>
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
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* View Details Dialog */}
      <IncomeTransactionViewDialog
        transaction={selectedTransaction}
        open={isViewDialogOpen}
        onOpenChange={(open) => {
          setIsViewDialogOpen(open);
          if (!open) {
            setSelectedTransaction(null);
          }
        }}
        onEdit={() => {
          setIsViewDialogOpen(false);
          setIsEditDialogOpen(true);
        }}
      />

      {/* Edit Dialog */}
      <IncomeTransactionDialog
        income={selectedTransaction}
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) {
            setSelectedTransaction(null);
            if (onRefresh) {
              onRefresh();
            }
          }
        }}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Income Transaction</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedTransaction?.has_income_allocations ? (
                <span className="text-foreground">
                  {t(
                    'incomes.delete.error.lockedByAllocation',
                    'This income is allocated to an expense or debt payment. Delete or change that payment first, then try again.'
                  )}
                </span>
              ) : (
                <>
                  Are you sure you want to delete this income transaction?
                </>
              )}
              {selectedTransaction && !selectedTransaction.has_income_allocations && (
                <>
                  <br />
                  <span className="font-semibold">
                    {selectedTransaction.description || selectedTransaction.customer_name || 'Transaction'}
                  </span>
                  <br />
                  Amount: {formatToRupiah(selectedTransaction.amount)}
                  <br />
                  This action cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setIsDeleteDialogOpen(false);
              setSelectedTransaction(null);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting || !!selectedTransaction?.has_income_allocations}
              className="bg-brand-red hover:bg-brand-red/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};


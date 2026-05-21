import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog';
import { cn } from '@/shared/lib/utils';
import { MODAL_BRAND_HEADER_BAR } from '@/shared/constants/modalBrandHeaderClasses';
import { AddIncomeForm } from '@/4-1-dashboard/components/AddIncomeForm';
import { IncomeTransactionDialog } from '@/4-1-dashboard/components/IncomeTransactionDialog';
import { IncomeAllocationDialog } from '@/4-1-dashboard/components/IncomeAllocationDialog';
import { IncomeTransactionViewDialog } from './IncomeTransactionViewDialog';
import { formatToRupiah } from '@/shared/utils/formatCurrency';
import type { IncomeTransactionWithRelations } from '@/4-1-dashboard/types';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { useCanAllocateIncome } from '@/4-1-dashboard/hooks/useCanAllocateIncome';

export type IncomeTransactionTableDialogsProps = {
  isAddDialogOpen: boolean;
  setIsAddDialogOpen: (open: boolean) => void;
  selectedTransaction: IncomeTransactionWithRelations | null;
  isViewDialogOpen: boolean;
  setIsViewDialogOpen: (open: boolean) => void;
  setIsEditDialogOpen: (open: boolean) => void;
  isEditDialogOpen: boolean;
  isAllocationDialogOpen: boolean;
  setIsAllocationDialogOpen: (open: boolean) => void;
  isDeleteDialogOpen: boolean;
  setIsDeleteDialogOpen: (open: boolean) => void;
  setSelectedTransaction: (tx: IncomeTransactionWithRelations | null) => void;
  confirmDelete: () => void;
  isDeleting: boolean;
  onRefresh?: () => void;
};

export function IncomeTransactionTableDialogs({
  isAddDialogOpen,
  setIsAddDialogOpen,
  selectedTransaction,
  isViewDialogOpen,
  setIsViewDialogOpen,
  setIsEditDialogOpen,
  isEditDialogOpen,
  isAllocationDialogOpen,
  setIsAllocationDialogOpen,
  isDeleteDialogOpen,
  setIsDeleteDialogOpen,
  setSelectedTransaction,
  confirmDelete,
  isDeleting,
  onRefresh,
}: IncomeTransactionTableDialogsProps) {
  const { t } = useAppTranslation();
  const { canAllocateIncome } = useCanAllocateIncome();

  return (
    <>
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col gap-0 overflow-hidden p-0">
          <DialogHeader
            className={cn('flex-shrink-0 space-y-1 px-4 py-3 text-left', MODAL_BRAND_HEADER_BAR)}
          >
            <DialogTitle className="text-lg font-semibold text-primary-foreground">
              {t('incomes.addTransactionTitle', 'Add New Income Transaction')}
            </DialogTitle>
            <DialogDescription className="text-primary-foreground/90">
              {t('incomes.addTransactionSubtitle', 'Create a new income transaction record')}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <AddIncomeForm onSuccess={() => setIsAddDialogOpen(false)} />
          </div>
        </DialogContent>
      </Dialog>

      <IncomeTransactionViewDialog
        transaction={selectedTransaction}
        open={isViewDialogOpen}
        onOpenChange={(open) => {
          setIsViewDialogOpen(open);
          if (!open) setSelectedTransaction(null);
        }}
        onEdit={
          canAllocateIncome
            ? () => {
                setIsViewDialogOpen(false);
                setIsEditDialogOpen(true);
              }
            : undefined
        }
      />

      <IncomeTransactionDialog
        income={selectedTransaction}
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) {
            setSelectedTransaction(null);
            onRefresh?.();
          }
        }}
      />

      <IncomeAllocationDialog
        income={selectedTransaction}
        open={isAllocationDialogOpen}
        onOpenChange={(open) => {
          setIsAllocationDialogOpen(open);
          if (!open) {
            setSelectedTransaction(null);
            onRefresh?.();
          }
        }}
      />

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Income Transaction</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedTransaction?.has_income_allocations ? (
                <span className="text-foreground">
                  {t(
                    'incomes.delete.error.lockedByAllocation',
                    'This income is allocated to an expense or debt payment. Delete or change that payment first, then try again.',
                  )}
                </span>
              ) : (
                <>Are you sure you want to delete this income transaction?</>
              )}
              {selectedTransaction && !selectedTransaction.has_income_allocations && (
                <>
                  <br />
                  <span className="font-semibold">
                    {selectedTransaction.description ||
                      selectedTransaction.customer_name ||
                      'Transaction'}
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
            <AlertDialogCancel
              onClick={() => {
                setIsDeleteDialogOpen(false);
                setSelectedTransaction(null);
              }}
            >
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
    </>
  );
}

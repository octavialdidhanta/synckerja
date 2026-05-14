import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { cn } from "@/shared/lib/utils";
import { MODAL_BRAND_HEADER_BAR } from "@/shared/constants/modalBrandHeaderClasses";
import { AddIncomeForm } from "@/4-1-dashboard/components/AddIncomeForm";
import { IncomeTransactionDialog } from "@/4-1-dashboard/components/IncomeTransactionDialog";
import { formatToRupiah } from "@/shared/utils/formatCurrency";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { IncomeTransactionListController } from "@/4-1-transaction/hooks/useIncomeTransactionListController";
import { IncomeTransactionViewDialog } from "./IncomeTransactionViewDialog";

type Props = {
  ctrl: IncomeTransactionListController;
  onRefresh?: () => void;
  /** When true, only view/edit/delete — add flow is handled elsewhere (e.g. `MobileAddIncomeTransactionModal`). */
  omitAddDialog?: boolean;
};

export function IncomeTransactionDialogsBundle({ ctrl, onRefresh, omitAddDialog }: Props) {
  const { t } = useAppTranslation();
  const {
    isAddDialogOpen,
    setIsAddDialogOpen,
    selectedTransaction,
    setSelectedTransaction,
    isViewDialogOpen,
    setIsViewDialogOpen,
    isEditDialogOpen,
    setIsEditDialogOpen,
    isDeleteDialogOpen,
    setIsDeleteDialogOpen,
    confirmDelete,
    isDeleting,
  } = ctrl;

  return (
    <>
      {!omitAddDialog ? (
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col gap-0 overflow-hidden p-0">
            <DialogHeader
              className={cn("flex-shrink-0 space-y-1 px-4 py-3 text-left", MODAL_BRAND_HEADER_BAR)}
            >
              <DialogTitle className="text-lg font-semibold text-primary-foreground">
                {t("incomes.addTransactionTitle", "Add New Income Transaction")}
              </DialogTitle>
              <DialogDescription className="text-primary-foreground/90">
                {t("incomes.addTransactionSubtitle", "Create a new income transaction record")}
              </DialogDescription>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              <AddIncomeForm
                onSuccess={() => {
                  setIsAddDialogOpen(false);
                  onRefresh?.();
                }}
              />
            </div>
          </DialogContent>
        </Dialog>
      ) : null}

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

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("incomes.deleteDialogTitle", "Delete Income Transaction")}</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedTransaction?.has_income_allocations ? (
                <span className="text-foreground">
                  {t(
                    "incomes.delete.error.lockedByAllocation",
                    "This income is allocated to an expense or debt payment. Delete or change that payment first, then try again.",
                  )}
                </span>
              ) : (
                <>
                  {t(
                    "incomes.deleteDialogBody",
                    "Are you sure you want to delete this income transaction?",
                  )}
                  {selectedTransaction && !selectedTransaction.has_income_allocations ? (
                    <>
                      <br />
                      <span className="font-semibold">
                        {selectedTransaction.description ||
                          selectedTransaction.customer_name ||
                          t("incomes.transaction", "Transaction")}
                      </span>
                      <br />
                      {t("incomes.amountLabel", "Amount")}: {formatToRupiah(selectedTransaction.amount)}
                      <br />
                      {t("incomes.deleteIrreversible", "This action cannot be undone.")}
                    </>
                  ) : null}
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
              {t("common.cancel", "Cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting || !!selectedTransaction?.has_income_allocations}
              className="bg-brand-red hover:bg-brand-red/90"
            >
              {isDeleting ? t("common.deleting", "Deleting...") : t("common.delete", "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

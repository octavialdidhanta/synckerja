import { useContext, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useDebts } from "@/4-2-debt/hooks";
import { DebtForm } from "@/4-2-debt/components/DebtForm";
import { DebtPaymentModal } from "@/4-2-debt/components/DebtPaymentModal";
import type { CreateDebtData, Debt, UpdateDebtData } from "@/4-2-debt/types";
import { ExpenseDashboardRefreshContext } from "@/mobile/2-expense/ExpenseDashboardRefreshContext";
import { debtDisplayBalance } from "@/4-2-debt/utils/resolveDebtDisplay";
import { useBankAccountBalances } from "@/shared/hooks/finance/useBankAccountBalances";
import { submitDebtPayment, type DebtPaymentModalSubmitPayload } from "@/4-2-debt/services/submitDebtPayment";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useCurrentUser } from "@/shared/hooks/useCurrentUser";
import { DebtDashboardCarousel } from "@/mobile/2-debt/section/debt/DebtDashboardCarousel";
import { DebtTableSection } from "@/mobile/2-debt/section/debt/DebtTableSection";
import { MobileDebtPaymentHistoryModal } from "@/mobile/2-debt/modal/MobileDebtPaymentHistoryModal";

export function DebtTabContent() {
  const { t } = useAppTranslation();
  const refreshContext = useContext(ExpenseDashboardRefreshContext);
  const refetchRef = refreshContext?.refetchRef;
  const {
    debts,
    totalInterestYtd,
    isLoading,
    isCreating,
    isUpdating,
    createDebt,
    updateDebt,
    deleteDebt,
    refetch: refetchDebts,
  } = useDebts();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [paymentHistoryDebt, setPaymentHistoryDebt] = useState<Debt | null>(null);
  const { updateBalance } = useBankAccountBalances();
  const { organizationId } = useCurrentOrg();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  const totalDebt = useMemo(() => debts.reduce((sum, debt) => sum + debtDisplayBalance(debt), 0), [debts]);

  const totalLimit = useMemo(() => debts.reduce((sum, debt) => sum + debt.limit_amount, 0), [debts]);

  const activeDebts = useMemo(() => debts.filter((debt) => debt.status === "active"), [debts]);

  const activeDebtTotal = useMemo(
    () => activeDebts.reduce((sum, debt) => sum + debtDisplayBalance(debt), 0),
    [activeDebts],
  );

  const handleAddClick = () => {
    setEditingDebt(null);
    setIsFormOpen(true);
  };

  const handleEditClick = (debt: Debt) => {
    setEditingDebt(debt);
    setIsFormOpen(true);
  };

  const handleDeleteClick = async (debtId: string) => {
    if (
      confirm(
        t(
          "debt.deleteConfirm",
          "Delete this debt? Amounts paid from bank accounts will be refunded to those account balances.",
        ),
      )
    ) {
      await deleteDebt(debtId);
    }
  };

  const handlePayDebt = () => setIsPaymentModalOpen(true);
  const handlePaymentClose = () => setIsPaymentModalOpen(false);

  const handlePaymentSubmit = async (paymentData: DebtPaymentModalSubmitPayload): Promise<boolean> => {
    const debt = debts.find((d) => d.id === paymentData.debtId);
    if (!debt) return false;
    if (!organizationId || !user?.id) return false;

    return submitDebtPayment({
      organizationId,
      userId: user.id,
      debtId: paymentData.debtId,
      paymentAmount: paymentData.paymentAmount,
      paymentDate: paymentData.paymentDate,
      paymentMethod: paymentData.paymentMethod,
      notes: paymentData.notes ?? null,
      transactionReference: paymentData.transactionReference ?? null,
      receiptFile: paymentData.receiptFile ?? null,
      income_allocation: paymentData.incomeAllocation ?? null,
      debtDisplayName: debt.debt_name,
      updateBalance,
      onAfterSuccess: async () => {
        await refetchDebts();
        await queryClient.invalidateQueries({ queryKey: ["income-transactions", organizationId] });
      },
      messages: {
        duplicateTransactionRef: t(
          "debt.payment.duplicateTransactionRef",
          "This transaction ID is already recorded for this organization.",
        ),
        receiptUploadFailed: t("debt.payment.receiptUploadFailed", "Failed to upload receipt."),
        paymentInsertFailed: t("debt.payment.insertFailed", "Failed to record payment."),
        bankAccountRequired: t(
          "debt.payment.bankAccountRequired",
          "Pilih rekening sumber dana untuk melanjutkan pembayaran.",
        ),
        rollbackFailed: t(
          "debt.payment.rollbackFailed",
          "Pembayaran tidak selesai. Muat ulang halaman dan coba lagi.",
        ),
        allocationLinkFailed: t(
          "debt.payment.allocationLinkFailed",
          "Could not link this payment to the selected income. The payment was not saved. Check amounts and account, then try again.",
        ),
      },
    });
  };

  const handleFormSubmit = async (data: CreateDebtData): Promise<boolean> => {
    if (editingDebt) {
      const updateData: UpdateDebtData = { id: editingDebt.id, ...data };
      return updateDebt(updateData);
    }
    return createDebt(data);
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingDebt(null);
  };

  useEffect(() => {
    if (!refetchRef) return;
    refetchRef.current = async () => {
      await refetchDebts();
    };
    return () => {
      refetchRef.current = null;
    };
  }, [refetchRef, refetchDebts]);

  return (
    <>
      <DebtDashboardCarousel
        isLoading={isLoading}
        totalDebt={totalDebt}
        debtCount={debts.length}
        totalLimit={totalLimit}
        activeDebtTotal={activeDebtTotal}
        activeDebtCount={activeDebts.length}
        totalInterestYtd={totalInterestYtd}
      />
      <DebtTableSection
        debts={debts}
        isLoading={isLoading}
        onAdd={handleAddClick}
        onPayDebt={handlePayDebt}
        onEdit={handleEditClick}
        onDelete={handleDeleteClick}
        onPaidClick={setPaymentHistoryDebt}
      />
      <DebtForm
        isOpen={isFormOpen}
        onClose={handleFormClose}
        onSubmit={handleFormSubmit}
        initialData={editingDebt || undefined}
        isLoading={isCreating || isUpdating}
      />
      <MobileDebtPaymentHistoryModal
        debt={paymentHistoryDebt}
        isOpen={!!paymentHistoryDebt}
        onClose={() => setPaymentHistoryDebt(null)}
        onPaymentDeleted={() => void refetchDebts()}
      />
      <DebtPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={handlePaymentClose}
        onSubmit={handlePaymentSubmit}
        debts={debts}
        isLoading={isUpdating}
      />
    </>
  );
}

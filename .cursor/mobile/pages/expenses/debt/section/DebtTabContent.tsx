import { useContext, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAppTranslation } from "@/features/share/i18n/useAppTranslation";
import { useDebts } from "@/features/4_2_debt/hooks";
import { DebtForm, DebtPaymentModal } from "@/features/4_2_debt/components";
import type { CreateDebtData, Debt, UpdateDebtData } from "@/features/4_2_debt/types";
import { DebtDashboardCarousel } from "@/mobile/pages/expenses/debt/section/DebtDashboardCarousel";
import { DebtTableSection } from "@/mobile/pages/expenses/debt/section/DebtTableSection";
import { MobileDebtPaymentHistoryModal } from "@/mobile/pages/expenses/debt/modal/MobileDebtPaymentHistoryModal";
import { useBankAccountBalances } from "@/hooks/organized/useBankAccountBalances";
import {
  submitDebtPayment,
  type DebtPaymentModalSubmitPayload,
} from "@/features/4_2_debt/services/submitDebtPayment";
import { useCurrentOrg } from "@/features/share/hooks/useCurrentOrg";
import { useCurrentUser } from "@/features/share/hooks/useCurrentUser";
import { ExpenseDashboardRefreshContext } from "@/mobile/pages/expenses/ExpenseDashboardRefreshContext";
import { debtDisplayBalance } from "@/features/4_2_debt/utils/resolveDebtDisplay";

export function DebtTabContent() {
  const { t } = useAppTranslation();
  const refreshContext = useContext(ExpenseDashboardRefreshContext);
  const refetchRef = refreshContext?.refetchRef;
  const { debts, totalInterestYtd, isLoading, isCreating, isUpdating, createDebt, updateDebt, deleteDebt, refetch: refetchDebts } =
    useDebts();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [paymentHistoryDebt, setPaymentHistoryDebt] = useState<Debt | null>(null);
  const { updateBalance } = useBankAccountBalances();
  const { organizationId } = useCurrentOrg();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  const totalDebt = useMemo(() => {
    return debts.reduce((sum, debt) => sum + debtDisplayBalance(debt), 0);
  }, [debts]);

  const totalLimit = useMemo(() => {
    return debts.reduce((sum, debt) => sum + debt.limit_amount, 0);
  }, [debts]);

  const activeDebts = useMemo(() => {
    return debts.filter((debt) => debt.status === "active");
  }, [debts]);

  const activeDebtTotal = useMemo(() => {
    return activeDebts.reduce((sum, debt) => sum + debtDisplayBalance(debt), 0);
  }, [activeDebts]);

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
          "Delete this debt? Amounts paid from bank accounts will be refunded to those account balances."
        )
      )
    ) {
      await deleteDebt(debtId);
    }
  };

  const handlePayDebt = () => {
    setIsPaymentModalOpen(true);
  };

  const handlePaymentClose = () => {
    setIsPaymentModalOpen(false);
  };

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
          "This transaction ID is already recorded for this organization."
        ),
        receiptUploadFailed: t("debt.payment.receiptUploadFailed", "Failed to upload receipt."),
        paymentInsertFailed: t("debt.payment.insertFailed", "Failed to record payment."),
        bankAccountRequired: t(
          "debt.payment.bankAccountRequired",
          "Pilih rekening sumber dana untuk melanjutkan pembayaran."
        ),
        rollbackFailed: t(
          "debt.payment.rollbackFailed",
          "Pembayaran tidak selesai. Muat ulang halaman dan coba lagi."
        ),
        allocationLinkFailed: t(
          "debt.payment.allocationLinkFailed",
          "Could not link this payment to the selected income. The payment was not saved. Check amounts and account, then try again."
        ),
      },
    });
  };

  const handleFormSubmit = async (data: CreateDebtData): Promise<boolean> => {
    if (editingDebt) {
      const updateData: UpdateDebtData = {
        id: editingDebt.id,
        ...data,
      };
      return await updateDebt(updateData);
    }
    return await createDebt(data);
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

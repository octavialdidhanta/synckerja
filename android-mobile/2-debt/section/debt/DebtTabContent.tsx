import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
import { MobileDebtFullViewportOverlay } from "@/mobile/2-debt/pages/MobileDebtPageSkeleton";
import { cn } from "@/shared/lib/utils";

const SKELETON_MIN_MS = 200;

export function DebtTabContent() {
  const { t } = useAppTranslation();
  const refreshContext = useContext(ExpenseDashboardRefreshContext);
  const refetchRef = refreshContext?.refetchRef;
  const isRefreshing = refreshContext?.isRefreshing ?? false;
  const {
    debts,
    totalInterestYtd,
    isLoading: debtsQueryLoading,
    isCreating,
    isUpdating,
    createDebt,
    updateDebt,
    deleteDebt,
    refetch: refetchDebts,
  } = useDebts();
  const { organizationId, loading: orgContextLoading } = useCurrentOrg();
  const {
    loading: bankBalancesLoading,
    isPending: bankBalancesPending,
    updateBalance,
  } = useBankAccountBalances();
  const hasOrg = Boolean(organizationId);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [paymentHistoryDebt, setPaymentHistoryDebt] = useState<Debt | null>(null);
  const { user, loading: userLoading } = useCurrentUser();
  const queryClient = useQueryClient();

  const [minSettleDone, setMinSettleDone] = useState(true);
  const skeletonShownAtRef = useRef<number | null>(null);
  const prevPendingRef = useRef(false);

  const queriesPending = hasOrg && (debtsQueryLoading || bankBalancesLoading || bankBalancesPending);

  /**
   * Hold debt skeleton until first data cycle for active org is fully settled.
   * Avoids premature skeleton hide during org bootstrap / org switch.
   */
  const [initialOrgSettled, setInitialOrgSettled] = useState(false);
  const settledOrgIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (orgContextLoading || userLoading) return;

    if (!hasOrg) {
      settledOrgIdRef.current = null;
      setInitialOrgSettled(true);
      return;
    }

    if (settledOrgIdRef.current !== organizationId) {
      settledOrgIdRef.current = null;
      setInitialOrgSettled(false);
    }
  }, [hasOrg, organizationId, orgContextLoading, userLoading]);

  useEffect(() => {
    if (orgContextLoading || userLoading || !hasOrg) return;
    if (queriesPending) return;

    settledOrgIdRef.current = organizationId;
    setInitialOrgSettled(true);
  }, [hasOrg, organizationId, orgContextLoading, userLoading, queriesPending]);

  const dataPending = orgContextLoading || userLoading || !initialOrgSettled || queriesPending;

  useEffect(() => {
    const pending = dataPending;
    const wasPending = prevPendingRef.current;
    prevPendingRef.current = pending;

    if (pending) {
      if (skeletonShownAtRef.current == null) skeletonShownAtRef.current = Date.now();
      setMinSettleDone(false);
      return;
    }

    if (wasPending && skeletonShownAtRef.current != null) {
      const elapsed = Date.now() - skeletonShownAtRef.current;
      const remaining = Math.max(0, SKELETON_MIN_MS - elapsed);
      const tId = window.setTimeout(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setMinSettleDone(true);
            skeletonShownAtRef.current = null;
          });
        });
      }, remaining);
      return () => window.clearTimeout(tId);
    }

    skeletonShownAtRef.current = null;
    setMinSettleDone(true);
  }, [dataPending]);

  const showPageSkeleton = (dataPending || !minSettleDone) && !isRefreshing;

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
      <div
        className={cn(
          "relative flex min-h-0 min-w-0 flex-1 flex-col gap-1",
          showPageSkeleton && "pointer-events-none invisible",
        )}
      >
        <div className="shrink-0">
          <DebtDashboardCarousel
            isLoading={false}
            totalDebt={totalDebt}
            debtCount={debts.length}
            totalLimit={totalLimit}
            activeDebtTotal={activeDebtTotal}
            activeDebtCount={activeDebts.length}
            totalInterestYtd={totalInterestYtd}
          />
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <DebtTableSection
            debts={debts}
            isLoading={false}
            onAdd={handleAddClick}
            onPayDebt={handlePayDebt}
            onEdit={handleEditClick}
            onDelete={handleDeleteClick}
            onPaidClick={setPaymentHistoryDebt}
          />
        </div>
      </div>

      {showPageSkeleton &&
        typeof document !== "undefined" &&
        createPortal(<MobileDebtFullViewportOverlay />, document.body)}

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

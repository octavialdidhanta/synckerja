import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { useBankAccountManagementModel } from "@/4-1-transaction/hooks/useBankAccountManagementModel";
import { BankAccountFormFields } from "@/4-1-transaction/section/BankAccountFormFields";
import { BankAccountDeleteAlertDialog } from "@/4-1-transaction/section/BankAccountDeleteAlertDialog";
import { IncomeDashboardRefreshContext } from "@/mobile/3-dashboard/IncomeDashboardRefreshContext";
import { MobileBankAccountFullViewportOverlay } from "@/mobile/3-bank-account/pages/MobileBankAccountViewportSkeleton";
import { MobileBankAccountTable } from "./MobileBankAccountTable";

const SKELETON_MIN_MS = 200;

/** Mirrors `.cursor/mobile/.../BankAccountTableSection`: outer card, inline form, swipe rows + copy. */
export function MobileBankAccountSection() {
  const { t } = useAppTranslation();
  const queryClient = useQueryClient();
  const refreshCtx = useContext(IncomeDashboardRefreshContext);
  const refetchRef = refreshCtx?.refetchRef;
  const isRefreshing = refreshCtx?.isRefreshing ?? false;

  const [minSettleDone, setMinSettleDone] = useState(true);
  const skeletonShownAtRef = useRef<number | null>(null);
  const prevPending = useRef(false);

  const m = useBankAccountManagementModel();

  const invalidateBank = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] }),
      queryClient.invalidateQueries({ queryKey: ["bank-account-balances"] }),
    ]);
  }, [queryClient]);

  useEffect(() => {
    if (!refetchRef) return;
    refetchRef.current = invalidateBank;
    return () => {
      refetchRef.current = null;
    };
  }, [invalidateBank, refetchRef]);

  useEffect(() => {
    const pending = m.rawPendingLoad;
    const wasPending = prevPending.current;
    prevPending.current = pending;

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
  }, [m.rawPendingLoad]);

  const showPageSkeleton = (m.rawPendingLoad || !minSettleDone) && !isRefreshing;

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
      <div
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col",
          showPageSkeleton && "pointer-events-none invisible select-none",
        )}
        aria-hidden={showPageSkeleton}
      >
        <Card className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border border-border bg-card">
          <CardContent className="flex min-h-0 min-w-0 flex-1 flex-col p-0">
            <div className="flex flex-shrink-0 items-center justify-between border-b bg-muted/50 px-3 py-2">
              <h2 className="text-sm font-semibold text-gray-900">
                {t("incomes.bankAccountsHeading", "Bank Accounts")}
              </h2>
              {!m.isEditing ? (
                <Button type="button" variant="outline" size="sm" onClick={m.handleAdd} className="h-8 px-2 text-xs">
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  {t("incomes.addBankAccount", "Add Bank Account")}
                </Button>
              ) : null}
            </div>

            {m.isEditing ? (
              <form onSubmit={m.handleSubmit} className="flex-shrink-0 space-y-3 border-b bg-gray-50 p-3">
                <BankAccountFormFields
                  twoColumn
                  formData={m.formData}
                  setFormData={m.setFormData}
                  idPrefix="mobile-bank"
                  inputClassName="h-8 text-sm"
                />
                <div className="flex gap-2">
                  <Button type="submit" size="sm" className="h-8 text-xs" disabled={m.submitting}>
                    {m.submitting ? (
                      <>
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        {m.editingBankAccount
                          ? t("incomes.updatingBankAccount", "Updating...")
                          : t("incomes.creatingBankAccount", "Creating...")}
                      </>
                    ) : m.editingBankAccount ? (
                      t("common.update", "Update")
                    ) : (
                      t("common.create", "Create")
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={m.handleCancel}
                    disabled={m.submitting}
                  >
                    {t("common.cancel", "Cancel")}
                  </Button>
                </div>
              </form>
            ) : null}

            {showPageSkeleton ? null : m.loading ? (
              <div className="flex min-h-[10rem] flex-1 flex-row items-center justify-center gap-2 py-8">
                <Loader2 className="h-5 w-5 shrink-0 animate-spin text-muted-foreground" aria-hidden />
                <span className="text-sm text-gray-500">
                  {t("incomes.loadingBankAccounts", "Loading bank accounts...")}
                </span>
              </div>
            ) : (
              <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                <MobileBankAccountTable
                  bankAccounts={m.bankAccounts}
                  onEdit={m.handleEdit}
                  onDelete={m.handleDeleteRequest}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {showPageSkeleton &&
        typeof document !== "undefined" &&
        createPortal(<MobileBankAccountFullViewportOverlay />, document.body)}

      <BankAccountDeleteAlertDialog
        open={!!m.deleteTargetId}
        onOpenChange={(open) => !open && m.cancelDeleteDialog()}
        onConfirm={m.confirmDelete}
        accountName={
          m.deleteTargetId ? m.bankAccounts.find((b) => b.id === m.deleteTargetId)?.name ?? null : null
        }
      />
    </div>
  );
}

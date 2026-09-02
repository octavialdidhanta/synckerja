import { useTranslation } from "react-i18next";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { XenditBalanceTabSkeleton } from "@/4-1-transaction/xendit/skeletons/XenditBalancePageSkeleton";
import { XenditContentCard } from "@/4-1-transaction/xendit/components/XenditContentCard";
import { XenditPayoutBankCard } from "@/4-1-transaction/xendit/components/XenditPayoutBankCard";
import { XenditWithdrawDialog } from "@/4-1-transaction/xendit/components/XenditWithdrawDialog";
import { XenditSubAccountEmptyState } from "@/4-1-transaction/xendit/components/XenditSubAccountEmptyState";
import { XenditAggregateBalanceCard } from "@/xendit/components/XenditAggregateBalanceCard";
import { XenditSubAccountBalanceGrid } from "@/xendit/components/XenditSubAccountBalanceGrid";
import { useXenditFinancePanel } from "@/4-1-transaction/xendit/hooks/useXenditFinancePanel";
import { XenditWorkspace } from "@/4-1-transaction/xendit/layout/XenditWorkspace";
import { XenditBalancePanelFooter } from "@/4-1-transaction/xendit/layout/XenditBalancePanelFooter";
import { formatToRupiah } from "@/shared/utils/formatCurrency";
import { formatGatewaySyncedAtLabel } from "@/shared/utils/formatGatewaySyncedAt";

function WithdrawStatusHint({
  panel,
}: {
  panel: ReturnType<typeof useXenditFinancePanel>;
}) {
  const { t } = useTranslation();

  if (!panel.canAllocateIncome) {
    return (
      <p className="text-xs text-muted-foreground">
        {t("xendit.finance.withdrawAdminOnly", "Hanya owner/admin yang dapat menarik dana.")}
      </p>
    );
  }
  if (panel.hasProcessing) {
    return (
      <p className="text-xs text-amber-700">
        {t(
          "xendit.finance.processingHint",
          "Penarikan lain masih diproses. Tunggu sebentar lalu refresh.",
        )}
      </p>
    );
  }
  if (!panel.payoutValidated && panel.hasPayoutBank) {
    return <p className="text-xs text-amber-700">{panel.validationBlockMessage}</p>;
  }
  if (!panel.hasPayoutBank) {
    return (
      <p className="text-xs text-muted-foreground">
        {t("xendit.finance.withdrawBlockedNoBank", "Atur rekening payout untuk menarik dana.")}
      </p>
    );
  }
  if (panel.usableBalance <= 0) {
    return (
      <p className="text-xs text-muted-foreground">
        {t("xendit.finance.withdrawBlockedNoBalance", "Saldo CASH kosong.")}
      </p>
    );
  }
  return null;
}

export default function XenditBalancePage() {
  const { t } = useTranslation();
  const panel = useXenditFinancePanel();
  const showAccountBreakdown = panel.selectableCount > 1 && panel.subAccountWallets.length > 0;

  if (panel.pageLoadPending) {
    return <XenditBalanceTabSkeleton />;
  }

  return (
    <>
      <XenditWorkspace>
        <XenditContentCard
          header={
            <div className="flex items-center justify-between gap-3 p-4 [@media(max-height:900px)]:p-3">
              <h2 className="text-base font-semibold text-foreground">
                {t("xendit.finance.title", "Saldo & Penarikan")}
              </h2>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-8 w-8 shrink-0"
                aria-label={t("common.refresh", "Refresh")}
                disabled={panel.refreshing}
                onClick={() => void panel.handleRefresh()}
              >
                {panel.refreshing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </div>
          }
          footer={<XenditBalancePanelFooter count={panel.selectableCount} />}
          bodyClassName="p-4 [@media(max-height:900px)]:p-3"
        >
          {panel.hasSubAccount ? (
            <div className="mx-auto w-full max-w-2xl space-y-4">
              <XenditAggregateBalanceCard
                aggregate={panel.aggregate}
                subAccountCount={panel.selectableCount}
                loading={panel.balanceLoading}
                syncedAt={panel.xenditSyncedAt}
                syncing={panel.isXenditSyncing}
                syncError={panel.xenditSyncError}
              />

              {showAccountBreakdown ? (
                <XenditSubAccountBalanceGrid
                  wallets={panel.subAccountWallets}
                  loading={panel.balanceLoading}
                />
              ) : null}

              <div className="space-y-3 rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">
                      {panel.selectableCount > 1
                        ? t("xendit.subAccount.primaryWithdrawTitle", "Penarikan (akun utama)")
                        : t("xendit.finance.withdrawAvailable", "Saldo CASH tersedia")}
                    </p>
                    <p className="mt-0.5 text-2xl font-semibold tabular-nums text-foreground">
                      {panel.balanceLoading || panel.isXenditSyncing
                        ? "…"
                        : formatToRupiah(panel.usableBalance)}
                    </p>
                    {panel.xenditSyncError ? (
                      <p className="mt-1 text-xs text-destructive">{panel.xenditSyncError}</p>
                    ) : panel.isXenditSyncing ? (
                      <p className="text-muted-foreground mt-1 text-xs">
                        {t("xendit.finance.syncingBalance", "Menyinkronkan saldo…")}
                      </p>
                    ) : (
                      <p className="text-muted-foreground mt-1 text-xs">
                        {formatGatewaySyncedAtLabel(panel.xenditSyncedAt, t)}
                      </p>
                    )}
                  </div>
                  <Button
                    type="button"
                    disabled={!panel.canOpenWithdraw}
                    onClick={() => panel.setWithdrawOpen(true)}
                    className="shrink-0"
                  >
                    {t("xendit.finance.withdrawCta", "Tarik Dana")}
                  </Button>
                </div>

                <XenditPayoutBankCard
                  compact
                  payoutBank={panel.payoutBank}
                  onRevalidate={
                    panel.canAllocateIncome ? () => void panel.handleRevalidatePayout() : undefined
                  }
                  revalidating={panel.revalidating}
                />

                <WithdrawStatusHint panel={panel} />
              </div>
            </div>
          ) : (
            <XenditSubAccountEmptyState />
          )}
        </XenditContentCard>
      </XenditWorkspace>

      {panel.organizationId ? (
        <XenditWithdrawDialog
          open={panel.withdrawOpen}
          onOpenChange={panel.setWithdrawOpen}
          organizationId={panel.organizationId}
          usableBalance={panel.usableBalance}
          platformFee={panel.platformFee}
          payoutBank={panel.payoutBank}
          onSuccess={() => void panel.handleRefresh()}
        />
      ) : null}
    </>
  );
}

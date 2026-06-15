import { useTranslation } from "react-i18next";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { IncomeXenditPageSkeleton } from "@/4-1-transaction/xendit/skeletons/IncomeXenditPageSkeleton";
import { XenditFinanceBalanceCard } from "@/4-1-transaction/xendit/components/XenditFinanceBalanceCard";
import { XenditPayoutBankCard } from "@/4-1-transaction/xendit/components/XenditPayoutBankCard";
import { XenditWithdrawDialog } from "@/4-1-transaction/xendit/components/XenditWithdrawDialog";
import { XenditSubAccountEmptyState } from "@/4-1-transaction/xendit/components/XenditSubAccountEmptyState";
import { useXenditFinancePanel } from "@/4-1-transaction/xendit/hooks/useXenditFinancePanel";

const MAIN_INNER_SCROLL =
  "scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

export default function XenditBalancePage() {
  const { t } = useTranslation();
  const panel = useXenditFinancePanel();

  if (panel.pageLoadPending) {
    return <IncomeXenditPageSkeleton variant="balance" />;
  }

  return (
    <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
      <div className="col-span-12 flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="shrink-0 space-y-3 border-b border-gray-200 p-4 [@media(max-height:900px)]:space-y-2 [@media(max-height:900px)]:p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-gray-900">
                  {t("xendit.finance.title", "Saldo & Penarikan")}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {t(
                    "xendit.finance.subtitle",
                    "Saldo CASH sub-account Xendit dan penarikan ke rekening payout.",
                  )}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
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
            </div>
          </div>

          <div className={`${MAIN_INNER_SCROLL} p-6`}>
            {panel.hasSubAccount ? (
              <div className="mx-auto w-full max-w-2xl space-y-5">
                <XenditFinanceBalanceCard
                  usableBalance={panel.usableBalance}
                  pendingBalance={panel.pendingBalance}
                  totalBalance={panel.totalBalance}
                  loading={panel.balanceLoading}
                  syncError={panel.xenditWallet?.sync_error}
                />

                <XenditPayoutBankCard
                  payoutBank={panel.payoutBank}
                  onRevalidate={
                    panel.canAllocateIncome ? () => void panel.handleRevalidatePayout() : undefined
                  }
                  revalidating={panel.revalidating}
                />

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    {panel.canAllocateIncome ? (
                      panel.hasProcessing ? (
                        <p className="text-xs text-amber-700">
                          {t(
                            "xendit.finance.processingHint",
                            "Penarikan lain masih diproses. Tunggu sebentar lalu refresh.",
                          )}
                        </p>
                      ) : !panel.payoutValidated && panel.hasPayoutBank ? (
                        <p className="text-xs text-amber-700">{panel.validationBlockMessage}</p>
                      ) : !panel.hasPayoutBank ? (
                        <p className="text-xs text-muted-foreground">
                          {t(
                            "xendit.finance.withdrawBlockedNoBank",
                            "Atur rekening payout untuk menarik dana.",
                          )}
                        </p>
                      ) : panel.usableBalance <= 0 ? (
                        <p className="text-xs text-muted-foreground">
                          {t("xendit.finance.withdrawBlockedNoBalance", "Saldo CASH kosong.")}
                        </p>
                      ) : null
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {t(
                          "xendit.finance.withdrawAdminOnly",
                          "Hanya owner/admin yang dapat menarik dana.",
                        )}
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
              </div>
            ) : (
              <XenditSubAccountEmptyState />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

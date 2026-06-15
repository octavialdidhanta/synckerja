import { useTranslation } from "react-i18next";
import { IncomeXenditPageSkeleton } from "@/4-1-transaction/xendit/skeletons/IncomeXenditPageSkeleton";
import { XenditWithdrawHistoryTable } from "@/4-1-transaction/xendit/components/XenditWithdrawHistoryTable";
import { XenditSubAccountEmptyState } from "@/4-1-transaction/xendit/components/XenditSubAccountEmptyState";
import { useXenditFinancePanel } from "@/4-1-transaction/xendit/hooks/useXenditFinancePanel";

const MAIN_INNER_SCROLL =
  "scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

export default function XenditHistoryPage() {
  const { t } = useTranslation();
  const panel = useXenditFinancePanel();

  if (panel.pageLoadPending) {
    return <IncomeXenditPageSkeleton variant="history" />;
  }

  return (
    <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
      <div className="col-span-12 flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="shrink-0 border-b border-gray-200 p-4 [@media(max-height:900px)]:p-3">
            <h2 className="text-base font-semibold text-gray-900">
              {t("xendit.tabs.history", "Withdrawal history")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t(
                "xendit.history.subtitle",
                "Riwayat penarikan dana dari sub-account Xendit ke rekening payout.",
              )}
            </p>
          </div>

          <div className={`${MAIN_INNER_SCROLL} p-6`}>
            {panel.hasSubAccount ? (
              <XenditWithdrawHistoryTable
                organizationId={panel.organizationId}
                enabled={panel.hasSubAccount}
              />
            ) : (
              <XenditSubAccountEmptyState />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

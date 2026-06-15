import { useTranslation } from "react-i18next";
import { IncomeXenditPageSkeleton } from "@/4-1-transaction/xendit/skeletons/IncomeXenditPageSkeleton";
import { XenditContentCard } from "@/4-1-transaction/xendit/components/XenditContentCard";
import { XenditPanelFooter } from "@/4-1-transaction/xendit/components/XenditPanelFooter";
import { XenditWithdrawHistoryTable } from "@/4-1-transaction/xendit/components/XenditWithdrawHistoryTable";
import { XenditSubAccountEmptyState } from "@/4-1-transaction/xendit/components/XenditSubAccountEmptyState";
import { useXenditFinancePanel } from "@/4-1-transaction/xendit/hooks/useXenditFinancePanel";
import {
  XENDIT_MAIN_GRID,
  XENDIT_TABLE_SECTION,
} from "@/4-1-transaction/xendit/layout/xenditPageLayout";

export default function XenditHistoryPage() {
  const { t } = useTranslation();
  const panel = useXenditFinancePanel();

  if (panel.pageLoadPending) {
    return <IncomeXenditPageSkeleton variant="history" />;
  }

  return (
    <div className={XENDIT_MAIN_GRID}>
      <div className="col-span-12 flex h-full min-h-0 min-w-0 flex-col self-stretch overflow-hidden">
        <div className={XENDIT_TABLE_SECTION}>
          <XenditContentCard
            fillBody
            header={
              <div className="p-4 [@media(max-height:900px)]:p-3">
                <h2 className="text-base font-semibold text-foreground">
                  {t("xendit.tabs.history", "Withdrawal history")}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {t(
                    "xendit.history.subtitle",
                    "Riwayat penarikan dana dari sub-account Xendit ke rekening payout.",
                  )}
                </p>
              </div>
            }
            footer={
              !panel.hasSubAccount ? (
                <XenditPanelFooter
                  left={t("xendit.finance.footerShowing", "Showing {{count}} withdrawals", {
                    count: 0,
                  })}
                  right={t("xendit.finance.footerCount", "Total: {{count}}", { count: 0 })}
                />
              ) : undefined
            }
          >
            {panel.hasSubAccount ? (
              <XenditWithdrawHistoryTable
                layout="page"
                organizationId={panel.organizationId}
                enabled={panel.hasSubAccount}
              />
            ) : (
              <div className="flex flex-1 items-center justify-center p-6">
                <XenditSubAccountEmptyState />
              </div>
            )}
          </XenditContentCard>
        </div>
      </div>
    </div>
  );
}

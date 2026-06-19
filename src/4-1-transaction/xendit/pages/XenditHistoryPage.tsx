import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/lib/utils";
import { useOrgBootstrapPending } from "@/shared/auth/hooks/useOrgBootstrapPending";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useModulePageOverlaySkeleton } from "@/shared/auth/page-access/useModulePageOverlaySkeleton";
import { useDebouncedReady } from "@/shared/hooks/useDebouncedReady";
import { XenditContentCard } from "@/4-1-transaction/xendit/components/XenditContentCard";
import { XenditPanelFooter } from "@/4-1-transaction/xendit/components/XenditPanelFooter";
import { XenditWithdrawHistoryTable } from "@/4-1-transaction/xendit/components/XenditWithdrawHistoryTable";
import { XenditSubAccountEmptyState } from "@/4-1-transaction/xendit/components/XenditSubAccountEmptyState";
import { useXenditGatewayWithdrawals } from "@/4-1-transaction/xendit/hooks/useXenditGatewayWithdrawals";
import {
  XENDIT_MAIN_GRID,
  XENDIT_TABLE_SECTION,
} from "@/4-1-transaction/xendit/layout/xenditPageLayout";
import { XenditHistoryTabContentSkeleton } from "@/4-1-transaction/xendit/skeletons/IncomeXenditPageSkeleton";
import { useXenditOrgSettings } from "@/xendit/hooks/useXenditOrgSettings";
import { XENDIT_BASE_PATH } from "@/xendit/lib/xenditPaths";
import { XenditSubAccountSelect } from "@/xendit/components/XenditSubAccountSelect";
import { countSelectableSubAccounts } from "@/xendit/lib/xenditSubAccountUtils";

export default function XenditHistoryPage() {
  const { t } = useTranslation();
  const { organizationId } = useCurrentOrg();
  const { orgBootstrapPending } = useOrgBootstrapPending();
  const [subAccountFilter, setSubAccountFilter] = useState<string | null>(null);

  const { data: settings, isLoading: settingsLoading } = useXenditOrgSettings(organizationId);

  const hasSubAccount = countSelectableSubAccounts(settings?.subAccounts) > 0;

  const { data: historyRows, isLoading: historyLoading } = useXenditGatewayWithdrawals(
    organizationId,
    Boolean(organizationId && hasSubAccount),
    { subAccountId: subAccountFilter },
  );

  const dataPending =
    Boolean(organizationId) &&
    (settingsLoading || (hasSubAccount && historyLoading));

  const rawPendingLoad = orgBootstrapPending || dataPending;
  const { showFullPageSkeleton, accessReady } = useModulePageOverlaySkeleton(
    rawPendingLoad,
    XENDIT_BASE_PATH,
  );
  const showContent = useDebouncedReady(accessReady && !showFullPageSkeleton, 150);

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
      <div
        className={cn(!showContent && "pointer-events-none invisible")}
        aria-hidden={!showContent}
      >
        <div className={XENDIT_MAIN_GRID}>
          <div className="col-span-12 flex h-full min-h-0 min-w-0 flex-col self-stretch overflow-hidden">
            <div className={XENDIT_TABLE_SECTION}>
              <XenditContentCard
                fillBody
                header={
                  <div className="space-y-3 p-4 [@media(max-height:900px)]:p-3">
                    <div>
                      <h2 className="text-base font-semibold text-foreground">
                        {t("xendit.tabs.history", "Withdrawal history")}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {t(
                          "xendit.history.subtitle",
                          "Riwayat penarikan dana dari akun Xendit ke rekening payout.",
                        )}
                      </p>
                    </div>
                    {hasSubAccount ? (
                      <XenditSubAccountSelect
                        subAccounts={settings?.subAccounts}
                        value={subAccountFilter}
                        onChange={setSubAccountFilter}
                        includeAll
                      />
                    ) : null}
                  </div>
                }
                footer={
                  !hasSubAccount ? (
                    <XenditPanelFooter
                      left={t("xendit.finance.footerShowing", "Showing {{count}} withdrawals", {
                        count: 0,
                      })}
                      right={t("xendit.finance.footerCount", "Total: {{count}}", { count: 0 })}
                    />
                  ) : undefined
                }
              >
                {hasSubAccount ? (
                  <XenditWithdrawHistoryTable
                    layout="page"
                    organizationId={organizationId}
                    rows={historyRows ?? []}
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
      </div>

      {!showContent ? (
        <div
          className="absolute inset-0 z-10 flex min-h-0 min-w-0 flex-col overflow-hidden bg-gray-100"
          aria-busy="true"
        >
          <XenditHistoryTabContentSkeleton />
        </div>
      ) : null}
    </div>
  );
}

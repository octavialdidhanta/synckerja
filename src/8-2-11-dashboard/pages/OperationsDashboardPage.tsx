import { useDebouncedReady } from "@/shared/hooks/useDebouncedReady";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useSalesSummaryReport } from "@/8-2-10-reports/sales-summary/hooks/useSalesSummaryReport";
import {
  defaultSalesSummaryDateRange,
  salesSummaryRangeToTimestamps,
} from "@/8-2-10-reports/sales-summary/lib/salesSummaryDatePresets";
import { DashboardDailyCollectedChart } from "../components/DashboardDailyCollectedChart";
import { DashboardSummaryCards } from "../components/DashboardSummaryCards";
import { useSalesSummaryDaily } from "../hooks/useSalesSummaryDaily";
import { OperationsDashboardShell } from "../layout/OperationsDashboardShell";
import { OperationsDashboardWorkspace } from "../layout/OperationsDashboardWorkspace";

export default function OperationsDashboardPage() {
  const { t } = useAppTranslation();
  const range = defaultSalesSummaryDateRange();
  const timestamps = salesSummaryRangeToTimestamps({
    fromYmd: range.from,
    toYmd: range.to,
    allDay: true,
    startTime: "00:00",
    endTime: "23:59",
  });
  const summary = useSalesSummaryReport({
    outletId: null,
    fromIso: timestamps.fromIso,
    toIso: timestamps.toIso,
  });
  const daily = useSalesSummaryDaily({
    outletId: null,
    fromIso: timestamps.fromIso,
    toIso: timestamps.toIso,
  });
  const showContent = useDebouncedReady(!summary.isLoading && !daily.isLoading);

  return (
    <OperationsDashboardShell showContent={showContent}>
      <OperationsDashboardWorkspace count={daily.points.length}>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden p-4">
          {summary.isError || daily.isError ? (
            <p className="text-sm text-destructive">
              {(summary.error ?? daily.error) instanceof Error
                ? (summary.error ?? daily.error)?.message
                : t("operationsDashboard.loadError", "Failed to load dashboard metrics.")}
            </p>
          ) : null}

          <DashboardSummaryCards metrics={summary.metrics} />

          <DashboardDailyCollectedChart points={daily.points} />
        </div>
      </OperationsDashboardWorkspace>
    </OperationsDashboardShell>
  );
}

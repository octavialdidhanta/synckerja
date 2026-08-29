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
      <div className="flex min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 flex-col gap-4 px-1 py-3">
        <div>
          <h1 className="mb-0.5 text-xl font-bold text-foreground">
            {t("operationsDashboard.header.title", "Dashboard")}
          </h1>
          <p className="text-xs text-muted-foreground">
            {t(
              "operationsDashboard.header.subtitle",
              "Snapshot of sales performance for this month across all outlets.",
            )}
          </p>
        </div>

        {summary.isError || daily.isError ? (
          <p className="text-sm text-destructive">
            {(summary.error ?? daily.error) instanceof Error
              ? (summary.error ?? daily.error)?.message
              : t("operationsDashboard.loadError", "Failed to load dashboard metrics.")}
          </p>
        ) : null}

        <DashboardSummaryCards metrics={summary.metrics} />

        <DashboardDailyCollectedChart points={daily.points} />

        <div
          className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4"
          aria-hidden
        />
      </div>
    </OperationsDashboardShell>
  );
}

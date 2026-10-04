import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/components/ui/button";
import {
  findMetaAdsSummaryMetricOption,
  formatMetaAdsSummaryMetricValue,
  type MetaAdsSummaryMetricOption,
  type MetaAdsSummaryTotals,
  type MetaAdsTableMetricKey,
} from "@/meta-ads/metrics/metaAdsSummaryMetrics";
import type { DmReportTargetProgress } from "@/6-0-digital-marketing-shared/dmReportTargetTypes";
import { ProgressBar } from "@/shared/components/ProgressBar";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { MobileMetaAdsMetricPickerSheet } from "@/mobile/6-0-meta-ads/components/MobileMetaAdsMetricPickerSheet";
import {
  PeriodCompareDeltaBadge,
  PeriodCompareFooter,
} from "@/6-0-digital-marketing-shared/components/PeriodCompareBits";
import type { KpiCompareDelta } from "@/6-0-digital-marketing-shared/lib/kpiPeriodCompare";

type Props = {
  selectedKey: MetaAdsTableMetricKey;
  onSelectKey: (key: MetaAdsTableMetricKey) => void;
  options: MetaAdsSummaryMetricOption[];
  totals: MetaAdsSummaryTotals | null;
  isLoading?: boolean;
  className?: string;
  targetProgress?: DmReportTargetProgress;
  targetsLoading?: boolean;
  progressRatioText?: string | null;
  fixedLabel?: string;
  fixedValue?: string;
  compareMetricKey?: string;
  compareDelta?: KpiCompareDelta | null;
  compareRangeLabel?: string;
  comparePreviousText?: string;
  compareLoading?: boolean;
  compareVisible?: boolean;
};

export function MobileMetaAdsSummaryMetricCard({
  selectedKey,
  onSelectKey,
  options,
  totals,
  isLoading,
  className,
  targetProgress,
  targetsLoading = false,
  progressRatioText = null,
  fixedLabel,
  fixedValue,
  compareMetricKey,
  compareDelta = null,
  compareRangeLabel = "",
  comparePreviousText = "—",
  compareLoading = false,
  compareVisible = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const isFixed = Boolean(fixedLabel);
  const selected = findMetaAdsSummaryMetricOption(selectedKey, options);
  const label = fixedLabel ?? selected?.label ?? selectedKey;
  const displayValue =
    fixedValue ??
    (isLoading ? null : formatMetaAdsSummaryMetricValue(selectedKey, totals));

  const purchaseValueCard = selectedKey === "purchase_conversion_value";
  const compareBadgeClass = purchaseValueCard ? "rounded bg-white px-1 py-0.5" : undefined;

  return (
    <div
      className={cn(
        "px-4 py-3",
        purchaseValueCard ? "bg-brand-blue" : "bg-card",
        className,
      )}
    >
      {isFixed ? (
        <div className="flex min-w-0 flex-col items-start">
          <div className="flex w-full min-w-0 items-center gap-1">
            <span
              className={cn(
                "min-w-0 truncate text-xs",
                purchaseValueCard ? "text-white" : "text-muted-foreground",
              )}
            >
              {label}
            </span>
            {compareVisible ? (
              <PeriodCompareDeltaBadge
                compact
                delta={compareDelta}
                metricKey={compareMetricKey ?? selectedKey}
                loading={compareLoading}
                className={compareBadgeClass}
              />
            ) : null}
          </div>
          <span
            className={cn(
              "text-lg font-semibold tabular-nums",
              purchaseValueCard ? "text-white" : "text-foreground",
            )}
          >
            {isLoading ? (
              <span className="inline-block h-6 w-24 animate-pulse rounded bg-muted" />
            ) : (
              displayValue
            )}
          </span>
        </div>
      ) : (
        <Button
          type="button"
          variant="ghost"
          className={cn(
            "h-auto w-full justify-start gap-1 px-0 py-0 text-left font-normal hover:bg-transparent",
            purchaseValueCard && "text-white hover:text-white",
          )}
          disabled={isLoading || options.length === 0}
          onClick={() => setOpen(true)}
        >
          <span className="flex w-full min-w-0 flex-col items-start">
            <span className="flex w-full min-w-0 items-center gap-1">
              <span
                className={cn(
                  "inline-flex min-w-0 items-center gap-0.5 text-xs",
                  purchaseValueCard ? "text-white" : "text-muted-foreground",
                )}
              >
                <span className="truncate">{label}</span>
                <ChevronDown className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
              </span>
              {compareVisible ? (
              <PeriodCompareDeltaBadge
                compact
                delta={compareDelta}
                metricKey={compareMetricKey ?? selectedKey}
                loading={compareLoading}
                className={compareBadgeClass}
              />
              ) : null}
            </span>
            <span
              className={cn(
                "text-lg font-semibold tabular-nums",
                purchaseValueCard ? "text-white" : "text-foreground",
              )}
            >
              {isLoading ? (
                <span className="inline-block h-6 w-24 animate-pulse rounded bg-muted" />
              ) : (
                displayValue
              )}
            </span>
          </span>
        </Button>
      )}
      {compareVisible ? (
        <PeriodCompareFooter
          compact
          rangeLabel={compareRangeLabel}
          previousText={comparePreviousText}
          loading={compareLoading}
          className={purchaseValueCard ? "text-white" : undefined}
        />
      ) : null}

      <div className="mt-2 min-h-[1.125rem]">
        {isLoading || targetsLoading ? (
          <Skeleton className="h-1.5 w-full" />
        ) : targetProgress?.showProgress &&
          targetProgress.target != null &&
          targetProgress.target > 0 &&
          targetProgress.actual != null ? (
          <ProgressBar
            current={targetProgress.actual}
            target={targetProgress.target}
            percentage={targetProgress.percentage ?? undefined}
            color="primary"
            className={
              purchaseValueCard
                ? "[&_.bg-gray-200]:bg-white/25 [&_.bg-primary]:bg-white [&_.text-primary]:text-white"
                : undefined
            }
          />
        ) : (
          <div className="flex h-[1.125rem] items-center">
            <span className={cn("text-xs", purchaseValueCard ? "text-white/80" : "text-muted-foreground/60")}>—</span>
          </div>
        )}
      </div>
      {progressRatioText ? (
        <p
          className={cn(
            "mt-0.5 text-[10px] tabular-nums",
            purchaseValueCard ? "text-white" : "text-muted-foreground",
          )}
        >
          {progressRatioText}
        </p>
      ) : null}

      {!isFixed ? (
        <MobileMetaAdsMetricPickerSheet
          open={open}
          onOpenChange={setOpen}
          selectedKey={selectedKey}
          onSelectKey={(key) => onSelectKey(key as MetaAdsTableMetricKey)}
          options={options}
        />
      ) : null}
    </div>
  );
}

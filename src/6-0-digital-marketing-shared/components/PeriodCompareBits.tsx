import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import type { KpiCompareDelta } from "@/6-0-digital-marketing-shared/lib/kpiPeriodCompare";
import { kpiCompareTone, kpiCompareToneClass } from "@/6-0-digital-marketing-shared/lib/kpiPeriodCompare";
import type { DmReportMetricDirectionsMap } from "@/6-0-digital-marketing-shared/dmReportMetricDirections";

type PeriodCompareDeltaBadgeProps = {
  delta: KpiCompareDelta | null;
  metricKey: string;
  loading?: boolean;
  compact?: boolean;
  metricDirections?: DmReportMetricDirectionsMap | null;
};

export function PeriodCompareDeltaBadge({
  delta,
  metricKey,
  loading = false,
  compact = false,
  metricDirections,
}: PeriodCompareDeltaBadgeProps) {
  if (loading) {
    return (
      <div
        className={cn("shrink-0 animate-pulse rounded bg-muted/50", compact ? "h-3 w-10" : "h-3.5 w-12")}
      />
    );
  }
  if (!delta) return null;
  const tone = kpiCompareTone(delta.direction, metricKey, metricDirections);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-0.5 font-medium leading-none",
        compact ? "text-[10px]" : "text-xs",
        kpiCompareToneClass(tone),
      )}
    >
      {delta.direction === "up" ? (
        <ArrowUp className={cn("shrink-0", compact ? "h-3 w-3" : "h-3.5 w-3.5")} aria-hidden />
      ) : null}
      {delta.direction === "down" ? (
        <ArrowDown className={cn("shrink-0", compact ? "h-3 w-3" : "h-3.5 w-3.5")} aria-hidden />
      ) : null}
      <span className="tabular-nums">{delta.formattedPercent}</span>
    </span>
  );
}

type PeriodCompareFooterProps = {
  rangeLabel: string;
  previousText?: string;
  loading?: boolean;
  compact?: boolean;
  visible?: boolean;
  /** Hide the previous-period value so the current number stays the only figure. */
  hidePrevious?: boolean;
};

export function PeriodCompareFooter({
  rangeLabel,
  previousText = "",
  loading = false,
  compact = false,
  visible = true,
  hidePrevious = false,
}: PeriodCompareFooterProps) {
  if (!visible && !loading) return null;
  if (loading) {
    return (
      <div
        className={cn("mt-1 animate-pulse rounded bg-muted/40", compact ? "h-3 w-20" : "h-3.5 w-24")}
      />
    );
  }
  if (!rangeLabel) return null;
  if (hidePrevious || !previousText) {
    return (
      <p
        className={cn(
          "mt-1 min-w-0 truncate leading-tight text-muted-foreground",
          compact ? "text-[10px]" : "text-xs",
        )}
      >
        vs {rangeLabel}
      </p>
    );
  }
  return (
    <div
      className={cn(
        "mt-1 flex items-baseline justify-between gap-1 leading-tight text-muted-foreground",
        compact ? "text-[10px]" : "text-xs",
      )}
    >
      <span className="min-w-0 truncate">{rangeLabel}</span>
      <span className="shrink-0 tabular-nums">{previousText}</span>
    </div>
  );
}

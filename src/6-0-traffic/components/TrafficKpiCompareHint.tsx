import type { ReactNode } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import {
  computeTrafficKpiCompareDelta,
  formatTrafficCompareDateRange,
} from "@/6-0-traffic/lib/trafficKpiCompare";

type TrafficKpiCompareHintProps = {
  title: ReactNode;
  value: ReactNode;
  current: number | null;
  previous: number | null;
  compareFromDate?: string | null;
  compareToDate?: string | null;
  loading?: boolean;
  compact?: boolean;
  titleClassName?: string;
  valueClassName?: string;
};

function formatPreviousValue(n: number | null) {
  if (n == null) return "—";
  const safe = Number(n);
  if (!Number.isFinite(safe)) return "—";
  return safe.toLocaleString();
}

function CompareDeltaBadge({
  direction,
  formattedPercent,
  compact,
  className,
}: {
  direction: "up" | "down" | "flat";
  formattedPercent: string;
  compact: boolean;
  className: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-0.5 font-medium leading-none",
        compact ? "text-[10px]" : "text-xs",
        className,
      )}
    >
      {direction === "up" ? (
        <ArrowUp className={cn("shrink-0", compact ? "h-3 w-3" : "h-3.5 w-3.5")} aria-hidden />
      ) : null}
      {direction === "down" ? (
        <ArrowDown className={cn("shrink-0", compact ? "h-3 w-3" : "h-3.5 w-3.5")} aria-hidden />
      ) : null}
      <span className="tabular-nums">{formattedPercent}</span>
    </span>
  );
}

export function TrafficKpiCompareHint({
  title,
  value,
  current,
  previous,
  compareFromDate = null,
  compareToDate = null,
  loading = false,
  compact = false,
  titleClassName,
  valueClassName,
}: TrafficKpiCompareHintProps) {
  const showCompare = Boolean(compareFromDate && compareToDate);
  const delta = showCompare && !loading ? computeTrafficKpiCompareDelta(current, previous) : null;
  const rangeLabel =
    compareFromDate && compareToDate
      ? formatTrafficCompareDateRange(compareFromDate, compareToDate)
      : "";
  const colorClass =
    delta?.direction === "up"
      ? "text-emerald-600"
      : delta?.direction === "down"
        ? "text-red-600"
        : "text-muted-foreground";

  return (
    <div className="min-w-0">
      <div className="flex items-start justify-between gap-1">
        <div
          className={cn(
            "min-w-0 leading-tight text-muted-foreground",
            compact ? "text-[11px]" : "text-xs",
            titleClassName,
          )}
        >
          {title}
        </div>
        {showCompare && loading ? (
          <div
            className={cn("mt-0.5 shrink-0 animate-pulse rounded bg-muted/50", compact ? "h-3 w-10" : "h-3.5 w-12")}
          />
        ) : null}
        {delta ? (
          <CompareDeltaBadge
            direction={delta.direction}
            formattedPercent={delta.formattedPercent}
            compact={compact}
            className={colorClass}
          />
        ) : null}
      </div>
      <div className={cn("tabular-nums leading-tight", compact ? "mt-0.5" : "mt-1", valueClassName)}>
        {value}
      </div>
      {showCompare && loading ? (
        <div
          className={cn("mt-0.5 animate-pulse rounded bg-muted/40", compact ? "h-3 w-16" : "h-3.5 w-24")}
        />
      ) : null}
      {delta && rangeLabel ? (
        <div
          className={cn(
            "flex items-baseline justify-between gap-1 leading-tight text-muted-foreground",
            compact ? "mt-0.5 text-[10px]" : "mt-0.5 text-xs",
          )}
        >
          <span className="min-w-0 truncate">{rangeLabel}</span>
          <span className="shrink-0 tabular-nums">{formatPreviousValue(previous)}</span>
        </div>
      ) : null}
    </div>
  );
}

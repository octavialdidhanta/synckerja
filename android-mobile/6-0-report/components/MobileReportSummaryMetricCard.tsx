import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/components/ui/button";
import {
  findReportSummaryMetricOption,
  formatReportSummaryMetricValue,
  type ReportSummaryMetricOption,
  type ReportSummaryTotals,
  type ReportTableMetricKey,
} from "@/6-0-digital-marketing-shared/reportSummaryMetrics";
import type { DmReportTargetProgress } from "@/6-0-digital-marketing-shared/dmReportTargetTypes";
import { ProgressBar } from "@/shared/components/ProgressBar";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { MobileReportMetricPickerSheet } from "@/mobile/6-0-report/components/MobileReportMetricPickerSheet";

type Props = {
  selectedKey: ReportTableMetricKey;
  onSelectKey: (key: ReportTableMetricKey) => void;
  options: ReportSummaryMetricOption[];
  totals: ReportSummaryTotals | null;
  isLoading?: boolean;
  mixedCurrencyLabel?: string;
  className?: string;
  targetProgress?: DmReportTargetProgress;
  targetsLoading?: boolean;
  progressRatioText?: string | null;
};

export function MobileReportSummaryMetricCard({
  selectedKey,
  onSelectKey,
  options,
  totals,
  isLoading,
  mixedCurrencyLabel,
  className,
  targetProgress,
  targetsLoading = false,
  progressRatioText = null,
}: Props) {
  const [open, setOpen] = useState(false);
  const selected = findReportSummaryMetricOption(selectedKey, options);
  const label = selected?.label ?? selectedKey;
  const displayValue = isLoading
    ? null
    : formatReportSummaryMetricValue(selectedKey, totals, { mixedCurrencyLabel });

  return (
    <div className={cn("bg-card px-4 py-3", className)}>
      <Button
        type="button"
        variant="ghost"
        className="h-auto w-full justify-between gap-1 px-0 py-0 text-left font-normal hover:bg-transparent"
        disabled={isLoading || options.length === 0}
        onClick={() => setOpen(true)}
      >
        <span className="flex min-w-0 flex-1 flex-col items-start">
          <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
            <span className="truncate">{label}</span>
            <ChevronDown className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
          </span>
          <span className="text-lg font-semibold tabular-nums text-foreground">
            {isLoading ? (
              <span className="inline-block h-6 w-24 animate-pulse rounded bg-muted" />
            ) : (
              displayValue
            )}
          </span>
        </span>
      </Button>

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
          />
        ) : (
          <div className="flex h-[1.125rem] items-center">
            <span className="text-xs text-muted-foreground/60">—</span>
          </div>
        )}
      </div>
      {progressRatioText ? (
        <p className="mt-0.5 text-[10px] tabular-nums text-muted-foreground">{progressRatioText}</p>
      ) : null}

      <MobileReportMetricPickerSheet
        open={open}
        onOpenChange={setOpen}
        selectedKey={selectedKey}
        onSelectKey={(key) => onSelectKey(key as ReportTableMetricKey)}
        options={options}
      />
    </div>
  );
}

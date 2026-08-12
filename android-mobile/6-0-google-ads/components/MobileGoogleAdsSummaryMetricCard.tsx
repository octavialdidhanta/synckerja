import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/components/ui/button";
import { formatMetricValue } from "@/google-ads/metrics/formatMetricValue";
import { findSummaryMetricOption } from "@/google-ads/metrics/googleAdsSummaryMetricOptions";
import { summaryValueForKey } from "@/google-ads/metrics/summaryValueForKey";
import type { GoogleAdsSummaryMetricOption } from "@/google-ads/metrics/types";
import type { GoogleAdsMetricsSummaryTotals } from "@/google-ads/metrics/types";
import type { DmReportTargetProgress } from "@/6-0-digital-marketing-shared/dmReportTargetTypes";
import { ProgressBar } from "@/shared/components/ProgressBar";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { MobileGoogleAdsMetricPickerSheet } from "@/mobile/6-0-google-ads/components/MobileGoogleAdsMetricPickerSheet";

type Props = {
  selectedKey: string;
  onSelectKey: (key: string) => void;
  options: GoogleAdsSummaryMetricOption[];
  totals: GoogleAdsMetricsSummaryTotals | null | undefined;
  currencyCode: string | null;
  isLoading?: boolean;
  className?: string;
  targetProgress?: DmReportTargetProgress;
  targetsLoading?: boolean;
  progressRatioText?: string | null;
  /** Fixed label (e.g. Cost) — no metric picker. */
  fixedLabel?: string;
  fixedValue?: string;
};

/**
 * Full-bleed mobile summary metric cell. Separate from desktop card/picker UI.
 */
export function MobileGoogleAdsSummaryMetricCard({
  selectedKey,
  onSelectKey,
  options,
  totals,
  currencyCode,
  isLoading,
  className,
  targetProgress,
  targetsLoading = false,
  progressRatioText = null,
  fixedLabel,
  fixedValue,
}: Props) {
  const [open, setOpen] = useState(false);
  const isFixed = Boolean(fixedLabel);
  const selected = findSummaryMetricOption(options, selectedKey);
  const label = fixedLabel ?? selected?.label ?? selectedKey;
  const valueKind = selected?.valueKind ?? "micros";
  const value = summaryValueForKey(totals, selectedKey, valueKind);
  const displayValue =
    fixedValue ??
    (isLoading
      ? null
      : formatMetricValue(selectedKey, value, currencyCode, valueKind));

  return (
    <div className={cn("bg-card px-4 py-3", className)}>
      {isFixed ? (
        <div className="flex min-w-0 flex-col items-start">
          <span className="text-xs text-muted-foreground">{label}</span>
          <span className="text-lg font-semibold tabular-nums text-foreground">
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
      )}

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

      {!isFixed ? (
        <MobileGoogleAdsMetricPickerSheet
          open={open}
          onOpenChange={setOpen}
          selectedKey={selectedKey}
          onSelectKey={onSelectKey}
          options={options}
        />
      ) : null}
    </div>
  );
}

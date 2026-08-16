import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/shared/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import type { DmReportTargetProgress } from "@/6-0-digital-marketing-shared/dmReportTargetTypes";
import {
  findReportSummaryMetricOption,
  formatReportSummaryMetricValue,
  reportSummaryMetricGroups,
  type ReportSummaryMetricOption,
  type ReportSummaryTotals,
  type ReportTableMetricKey,
} from "@/6-0-digital-marketing-shared/reportSummaryMetrics";
import { ProgressBar } from "@/shared/components/ProgressBar";
import { Skeleton } from "@/shared/components/ui/skeleton";
import {
  PeriodCompareDeltaBadge,
  PeriodCompareFooter,
} from "@/6-0-digital-marketing-shared/components/PeriodCompareBits";
import type { KpiCompareDelta } from "@/6-0-digital-marketing-shared/lib/kpiPeriodCompare";

type Props = {
  selectedKey: ReportTableMetricKey;
  onSelectKey: (key: ReportTableMetricKey) => void;
  options: ReportSummaryMetricOption[];
  totals: ReportSummaryTotals | null;
  isLoading?: boolean;
  mixedCurrencyLabel?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  className?: string;
  targetProgress?: DmReportTargetProgress;
  targetsLoading?: boolean;
  progressRatioText?: string | null;
  compareMetricKey?: string;
  compareDelta?: KpiCompareDelta | null;
  compareRangeLabel?: string;
  comparePreviousText?: string;
  compareLoading?: boolean;
  compareVisible?: boolean;
};

export function DigitalMarketingReportSummaryMetricPicker({
  selectedKey,
  onSelectKey,
  options,
  totals,
  isLoading,
  mixedCurrencyLabel,
  searchPlaceholder = "Search metrics…",
  emptyLabel = "No metrics found.",
  className,
  targetProgress,
  targetsLoading = false,
  progressRatioText = null,
  compareMetricKey,
  compareDelta = null,
  compareRangeLabel = "",
  comparePreviousText = "—",
  compareLoading = false,
  compareVisible = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const groups = useMemo(() => reportSummaryMetricGroups(options), [options]);
  const selected = findReportSummaryMetricOption(selectedKey, options);
  const label = selected?.label ?? selectedKey;
  const value = formatReportSummaryMetricValue(selectedKey, totals, { mixedCurrencyLabel });

  return (
    <div
      className={cn(
        "rounded-md border border-gray-200 bg-white px-3 py-2",
        className,
      )}
    >
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className="h-auto w-full justify-start gap-1 px-0 py-0 text-left font-normal hover:bg-transparent"
            disabled={isLoading || options.length === 0}
          >
            <span className="flex w-full min-w-0 flex-col items-start">
              <span className="flex w-full min-w-0 items-center gap-1">
                <span className="inline-flex min-w-0 items-center gap-0.5 text-xs text-muted-foreground">
                  <span className="truncate">{label}</span>
                  <ChevronDown className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                </span>
                {compareVisible ? (
                  <PeriodCompareDeltaBadge
                    delta={compareDelta}
                    metricKey={compareMetricKey ?? selectedKey}
                    loading={compareLoading}
                  />
                ) : null}
              </span>
              <span className="text-base font-semibold tabular-nums text-gray-900">
                {isLoading ? (
                  <span className="inline-block h-5 w-20 animate-pulse rounded bg-muted" />
                ) : (
                  <span className="line-clamp-2 break-all">{value}</span>
                )}
              </span>
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(100vw-2rem,22rem)] p-0" align="start">
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList className="max-h-[min(60vh,280px)]">
              <CommandEmpty>{emptyLabel}</CommandEmpty>
              {groups.map((group) => (
                <CommandGroup key={group.id} heading={group.label}>
                  {group.options.map((opt) => (
                    <CommandItem
                      key={opt.key}
                      value={`${opt.label} ${opt.key}`}
                      onSelect={() => {
                        onSelectKey(opt.key);
                        setOpen(false);
                      }}
                    >
                      <span
                        className={cn(
                          "truncate",
                          opt.key === selectedKey && "font-medium text-blue-700",
                        )}
                      >
                        {opt.label}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {compareVisible ? (
        <PeriodCompareFooter
          rangeLabel={compareRangeLabel}
          previousText={comparePreviousText}
          loading={compareLoading}
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
          />
        ) : (
          <div className="flex h-[1.125rem] items-center">
            <span className="text-xs text-gray-400">—</span>
          </div>
        )}
      </div>
      {progressRatioText ? (
        <p className="mt-0.5 text-[10px] tabular-nums text-muted-foreground">{progressRatioText}</p>
      ) : null}
    </div>
  );
}

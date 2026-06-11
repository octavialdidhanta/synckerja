import { Info } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { ProgressBar } from "@/shared/components/ProgressBar";
import { Skeleton } from "@/shared/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import type { DmReportTargetProgress } from "@/6-0-digital-marketing-shared/dmReportTargetTypes";

type Props = {
  label: string;
  value: string;
  hint?: string;
  detailTooltip?: string;
  className?: string;
  targetProgress?: DmReportTargetProgress;
  targetsLoading?: boolean;
  progressRatioText?: string | null;
};

export function GoogleAdsSummaryFixedMetricCard({
  label,
  value,
  hint,
  detailTooltip,
  className,
  targetProgress,
  targetsLoading = false,
  progressRatioText = null,
}: Props) {
  return (
    <div
      className={cn(
        "rounded-md border border-gray-200 bg-white px-3 py-2",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        {detailTooltip ? (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                  aria-label={detailTooltip}
                >
                  <Info className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs">
                {detailTooltip}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : null}
      </div>
      <p className="text-base font-semibold tabular-nums text-gray-900">{value}</p>
      <div className="mt-2 min-h-[1.125rem]">
        {targetsLoading ? (
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
      ) : hint ? (
        <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

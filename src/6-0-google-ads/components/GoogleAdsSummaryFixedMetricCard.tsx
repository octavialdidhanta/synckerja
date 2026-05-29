import { Info } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";

type Props = {
  label: string;
  value: string;
  hint?: string;
  detailTooltip?: string;
  className?: string;
};

export function GoogleAdsSummaryFixedMetricCard({
  label,
  value,
  hint,
  detailTooltip,
  className,
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
      {hint ? (
        <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

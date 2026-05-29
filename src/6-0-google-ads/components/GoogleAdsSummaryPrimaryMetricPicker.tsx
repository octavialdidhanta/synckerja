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
  CommandSeparator,
} from "@/shared/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { formatMetricValue } from "@/google-ads/metrics/formatMetricValue";
import {
  findSummaryMetricOption,
  summaryMetricGroups,
  type GoogleAdsSummaryMetricOption,
} from "@/google-ads/metrics/googleAdsSummaryMetricOptions";
import type { GoogleAdsMetricsSummaryTotals } from "@/google-ads/metrics/types";

type Props = {
  selectedKey: string;
  onSelectKey: (key: string) => void;
  options: GoogleAdsSummaryMetricOption[];
  totals: GoogleAdsMetricsSummaryTotals | null | undefined;
  currencyCode: string | null;
  isLoading?: boolean;
  className?: string;
};

function summaryValueForKey(
  totals: GoogleAdsMetricsSummaryTotals | null | undefined,
  key: string,
  valueKind: GoogleAdsSummaryMetricOption["valueKind"],
): number | null {
  if (!totals) return null;
  if (totals.by_key && key in totals.by_key) {
    return totals.by_key[key] ?? null;
  }
  if (key === "spent") return totals.spent;
  if (key === "impressions") return totals.impressions;
  if (key === "clicks") return totals.clicks;
  if (key === "ctr") return totals.ctr;
  if (key === "conversions") return totals.conversions;
  return null;
}

export function GoogleAdsSummaryPrimaryMetricPicker({
  selectedKey,
  onSelectKey,
  options,
  totals,
  currencyCode,
  isLoading,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const groups = useMemo(() => summaryMetricGroups(options), [options]);
  const selected = findSummaryMetricOption(options, selectedKey);
  const label = selected?.label ?? selectedKey;
  const valueKind = selected?.valueKind ?? "micros";
  const value = summaryValueForKey(totals, selectedKey, valueKind);

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
            className="h-auto w-full justify-between gap-1 px-0 py-0 text-left font-normal hover:bg-transparent"
            disabled={isLoading || options.length === 0}
          >
            <span className="flex min-w-0 flex-1 flex-col items-start">
              <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
                <span className="truncate">{label}</span>
                <ChevronDown className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
              </span>
              <span className="text-base font-semibold tabular-nums text-gray-900">
                {isLoading ? (
                  <span className="inline-block h-5 w-20 animate-pulse rounded bg-muted" />
                ) : (
                  formatMetricValue(selectedKey, value, currencyCode, valueKind)
                )}
              </span>
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(100vw-2rem,22rem)] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search metrics…" />
            <CommandList className="max-h-[min(60vh,320px)]">
              <CommandEmpty>No metrics found.</CommandEmpty>
              {groups.map((group, index) => (
                <div key={group.id}>
                  {index > 0 ? <CommandSeparator /> : null}
                  <CommandGroup heading={group.label}>
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
                </div>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

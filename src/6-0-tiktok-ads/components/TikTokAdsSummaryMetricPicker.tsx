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
import {
  findTikTokAdsSummaryMetricOption,
  formatTikTokAdsSummaryMetricValue,
  tiktokAdsSummaryMetricGroups,
  type TikTokAdsSummaryMetricOption,
  type TikTokAdsSummaryTotals,
  type TikTokAdsTableMetricKey,
} from "@/tiktok-ads/metrics/tiktokAdsSummaryMetrics";

type Props = {
  selectedKey: TikTokAdsTableMetricKey;
  onSelectKey: (key: TikTokAdsTableMetricKey) => void;
  options: TikTokAdsSummaryMetricOption[];
  totals: TikTokAdsSummaryTotals | null;
  isLoading?: boolean;
  searchPlaceholder?: string;
  emptyLabel?: string;
  className?: string;
};

export function TikTokAdsSummaryMetricPicker({
  selectedKey,
  onSelectKey,
  options,
  totals,
  isLoading,
  searchPlaceholder = "Search metrics…",
  emptyLabel = "No metrics found.",
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const groups = useMemo(() => tiktokAdsSummaryMetricGroups(options), [options]);
  const selected = findTikTokAdsSummaryMetricOption(selectedKey, options);
  const label = selected?.label ?? selectedKey;
  const value = formatTikTokAdsSummaryMetricValue(selectedKey, totals);

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
    </div>
  );
}

import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import type { DateRange } from "react-day-picker";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Calendar } from "@/shared/components/ui/calendar";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { Switch } from "@/shared/components/ui/switch";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import {
  computeSalesSummaryPresetRange,
  shiftSalesSummaryRangeByDay,
} from "../lib/salesSummaryDatePresets";
import type {
  SalesSummaryDatePresetId,
  SalesSummaryDateRange,
  SalesSummaryTimeFilter,
} from "../lib/salesSummaryTypes";

const PRESETS: SalesSummaryDatePresetId[] = [
  "today",
  "yesterday",
  "this_week",
  "last_week",
  "this_month",
  "last_month",
  "this_year",
  "last_year",
];

type Props = {
  dateRange: SalesSummaryDateRange;
  onDateRangeChange: (value: SalesSummaryDateRange) => void;
  timeFilter: SalesSummaryTimeFilter;
  onTimeFilterChange: (value: SalesSummaryTimeFilter) => void;
  /** Prefer this for Apply so date + time write URL params atomically. */
  onApplyFilters?: (range: SalesSummaryDateRange, time: SalesSummaryTimeFilter) => void;
  /** Hide Starts/Ends controls (dashboard v1 is all-day only). */
  hideTimeFilter?: boolean;
  className?: string;
};

function presetLabel(
  preset: SalesSummaryDatePresetId,
  t: (key: string, fallback: string) => string,
): string {
  const map: Record<SalesSummaryDatePresetId, string> = {
    today: t("reports.salesSummary.preset.today", "Today"),
    yesterday: t("reports.salesSummary.preset.yesterday", "Yesterday"),
    this_week: t("reports.salesSummary.preset.thisWeek", "This Week"),
    last_week: t("reports.salesSummary.preset.lastWeek", "Last Week"),
    this_month: t("reports.salesSummary.preset.thisMonth", "This Month"),
    last_month: t("reports.salesSummary.preset.lastMonth", "Last Month"),
    this_year: t("reports.salesSummary.preset.thisYear", "This Year"),
    last_year: t("reports.salesSummary.preset.lastYear", "Last Year"),
    custom: t("reports.salesSummary.preset.custom", "Custom"),
  };
  return map[preset];
}

function formatRangeLabel(range: SalesSummaryDateRange): string {
  try {
    if (range.from === range.to) return format(parseISO(range.from), "d/M/yyyy");
    return `${format(parseISO(range.from), "d/M/yyyy")} - ${format(parseISO(range.to), "d/M/yyyy")}`;
  } catch {
    return `${range.from} - ${range.to}`;
  }
}

function toYmd(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

export function SalesSummaryDateRangePicker({
  dateRange,
  onDateRangeChange,
  timeFilter,
  onTimeFilterChange,
  onApplyFilters,
  hideTimeFilter = false,
  className,
}: Props) {
  const { t } = useAppTranslation();
  const [open, setOpen] = useState(false);
  const [draftRange, setDraftRange] = useState<SalesSummaryDateRange>(dateRange);
  const [draftTime, setDraftTime] = useState<SalesSummaryTimeFilter>(timeFilter);

  const calendarSelected: DateRange = useMemo(() => {
    try {
      return {
        from: parseISO(draftRange.from),
        to: parseISO(draftRange.to),
      };
    } catch {
      return { from: undefined, to: undefined };
    }
  }, [draftRange.from, draftRange.to]);

  const openPopover = (next: boolean) => {
    if (next) {
      setDraftRange(dateRange);
      setDraftTime(timeFilter);
    }
    setOpen(next);
  };

  const applyPreset = (preset: SalesSummaryDatePresetId) => {
    const computed = computeSalesSummaryPresetRange(preset);
    setDraftRange({ preset, ...computed });
  };

  const apply = () => {
    const nextTime = hideTimeFilter
      ? { allDay: true, startTime: "00:00", endTime: "23:59" }
      : draftTime;
    if (onApplyFilters) {
      onApplyFilters(draftRange, nextTime);
    } else {
      onDateRangeChange(draftRange);
      onTimeFilterChange(nextTime);
    }
    setOpen(false);
  };

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-9 w-9 shrink-0"
        aria-label={t("reports.salesSummary.prevPeriod", "Previous period")}
        onClick={() => onDateRangeChange(shiftSalesSummaryRangeByDay(dateRange, -1))}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <Popover open={open} onOpenChange={openPopover}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" className="h-9 min-w-[11rem] justify-between gap-2">
            <span className="tabular-nums">{formatRangeLabel(dateRange)}</span>
            <ChevronDown className="h-4 w-4 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="flex flex-col gap-0 sm:flex-row">
            <div className="flex w-full flex-col gap-1 border-b border-border p-3 sm:w-40 sm:border-b-0 sm:border-r">
              {PRESETS.map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  size="sm"
                  variant={draftRange.preset === preset ? "default" : "outline"}
                  className="justify-start"
                  onClick={() => applyPreset(preset)}
                >
                  {presetLabel(preset, t)}
                </Button>
              ))}
            </div>

            <div className="p-3">
              <Calendar
                mode="range"
                numberOfMonths={1}
                selected={calendarSelected}
                onSelect={(range) => {
                  if (!range?.from) return;
                  const from = toYmd(range.from);
                  const to = toYmd(range.to ?? range.from);
                  setDraftRange({ preset: "custom", from, to });
                }}
              />
            </div>

            <div className="flex w-full flex-col gap-3 border-t border-border p-3 sm:w-44 sm:border-l sm:border-t-0">
              {!hideTimeFilter ? (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="sales-summary-all-day" className="text-sm">
                      {t("reports.salesSummary.allDay", "All day")}
                    </Label>
                    <Switch
                      id="sales-summary-all-day"
                      checked={draftTime.allDay}
                      onCheckedChange={(checked) =>
                        setDraftTime((prev) => ({ ...prev, allDay: checked }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        {t("reports.salesSummary.starts", "Starts")}
                      </Label>
                      <Input
                        type="time"
                        className="mt-1 h-9"
                        value={draftTime.startTime}
                        disabled={draftTime.allDay}
                        onChange={(e) =>
                          setDraftTime((prev) => ({ ...prev, startTime: e.target.value || "00:00" }))
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        {t("reports.salesSummary.ends", "Ends")}
                      </Label>
                      <Input
                        type="time"
                        className="mt-1 h-9"
                        value={draftTime.endTime}
                        disabled={draftTime.allDay}
                        onChange={(e) =>
                          setDraftTime((prev) => ({ ...prev, endTime: e.target.value || "23:59" }))
                        }
                      />
                    </div>
                  </div>
                </>
              ) : null}
              <Button type="button" className="mt-auto w-full" onClick={apply}>
                {t("reports.salesSummary.apply", "Apply")}
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-9 w-9 shrink-0"
        aria-label={t("reports.salesSummary.nextPeriod", "Next period")}
        onClick={() => onDateRangeChange(shiftSalesSummaryRangeByDay(dateRange, 1))}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

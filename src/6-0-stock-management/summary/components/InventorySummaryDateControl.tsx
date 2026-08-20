import { addDays, differenceInCalendarDays, endOfDay, endOfMonth, endOfWeek, format, startOfDay, startOfMonth, startOfWeek } from "date-fns";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";
import { Button } from "@/shared/components/ui/button";
import { Calendar } from "@/shared/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

export type InventorySummaryDateControlProps = {
  from: Date;
  to: Date;
  onChange: (from: Date, to: Date) => void;
};

export function InventorySummaryDateControl({ from, to, onChange }: InventorySummaryDateControlProps) {
  const { t } = useAppTranslation();
  const [open, setOpen] = useState(false);
  const spanDays = differenceInCalendarDays(startOfDay(to), startOfDay(from));
  const label =
    startOfDay(from).getTime() === startOfDay(to).getTime()
      ? format(from, "d/M/yyyy")
      : `${format(from, "d/M/yyyy")} – ${format(to, "d/M/yyyy")}`;

  const customRange: DateRange = useMemo(() => ({ from, to }), [from, to]);

  const step = (direction: -1 | 1) => {
    const delta = (spanDays + 1) * direction;
    onChange(addDays(from, delta), addDays(to, delta));
  };

  return (
    <div className="flex items-center gap-1">
      <Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={() => step(-1)}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" className="h-9 min-w-[9.5rem] justify-between gap-2">
            {label}
            <ChevronDown className="h-4 w-4 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3" align="start">
          <div className="mb-2 flex flex-wrap gap-1">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                const now = new Date();
                onChange(startOfDay(now), endOfDay(now));
                setOpen(false);
              }}
            >
              {t("operations.inventory.summary.presetToday", "Today")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                const now = new Date();
                onChange(startOfWeek(now, { weekStartsOn: 1 }), endOfWeek(now, { weekStartsOn: 1 }));
                setOpen(false);
              }}
            >
              {t("operations.inventory.summary.presetWeek", "This week")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                const now = new Date();
                onChange(startOfMonth(now), endOfMonth(now));
                setOpen(false);
              }}
            >
              {t("operations.inventory.summary.presetMonth", "This month")}
            </Button>
            <Button type="button" size="sm" variant="ghost">
              {t("operations.inventory.summary.presetCustom", "Custom")}
            </Button>
          </div>
          <Calendar
            mode="range"
            selected={customRange}
            onSelect={(range) => {
              if (!range?.from) return;
              onChange(startOfDay(range.from), endOfDay(range.to ?? range.from));
            }}
            numberOfMonths={1}
          />
        </PopoverContent>
      </Popover>
      <Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={() => step(1)}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

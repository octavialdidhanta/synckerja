import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  addMonths,
  format,
  setMonth,
  setYear,
  subMonths,
  type Locale,
} from "date-fns";
import { enUS, id as idLocale } from "date-fns/locale";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import { Calendar } from "@/shared/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { cn } from "@/shared/lib/utils";

const YEAR_FROM = 2020;
const YEAR_TO = 2035;

type FlowBuilderDatePickerPanelProps = {
  value: Date | undefined;
  onChange: (value: Date | undefined) => void;
  onConfirm: () => void;
  confirmLabel: string;
  className?: string;
};

export function FlowBuilderDatePickerPanel({
  value,
  onChange,
  onConfirm,
  confirmLabel,
  className,
}: FlowBuilderDatePickerPanelProps) {
  const { i18n } = useTranslation();
  const locale: Locale = i18n.language === "id" ? idLocale : enUS;
  const [visibleMonth, setVisibleMonth] = useState<Date>(() => value ?? new Date());

  useEffect(() => {
    if (value) setVisibleMonth(value);
  }, [value]);

  const years = useMemo(
    () => Array.from({ length: YEAR_TO - YEAR_FROM + 1 }, (_, index) => YEAR_FROM + index),
    [],
  );

  const monthOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, monthIndex) => ({
        value: String(monthIndex),
        label: format(new Date(2024, monthIndex, 1), "MMMM", { locale }),
      })),
    [locale],
  );

  const handleMonthChange = (monthValue: string) => {
    setVisibleMonth((current) => setMonth(current, Number.parseInt(monthValue, 10)));
  };

  const handleYearChange = (yearValue: string) => {
    setVisibleMonth((current) => setYear(current, Number.parseInt(yearValue, 10)));
  };

  return (
    <div className={cn("w-[min(100vw-2rem,20rem)]", className)}>
      <div className="border-b border-border px-3 py-3">
        <div className="flex items-center gap-2">
          <Select value={String(visibleMonth.getMonth())} onValueChange={handleMonthChange}>
            <SelectTrigger
              className="h-9 min-w-0 flex-1 rounded-md border-border bg-background px-3 text-sm font-medium shadow-none"
              aria-label="Month"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {monthOptions.map((month) => (
                <SelectItem key={month.value} value={month.value} className="text-sm">
                  {month.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={String(visibleMonth.getFullYear())} onValueChange={handleYearChange}>
            <SelectTrigger
              className="h-9 w-[5.5rem] shrink-0 rounded-md border-border bg-background px-3 text-sm font-medium shadow-none"
              aria-label="Year"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {years.map((year) => (
                <SelectItem key={year} value={String(year)} className="text-sm tabular-nums">
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex shrink-0 items-center gap-0.5">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-md border-border shadow-none"
              onClick={() => setVisibleMonth((current) => subMonths(current, 1))}
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-md border-border shadow-none"
              onClick={() => setVisibleMonth((current) => addMonths(current, 1))}
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <Calendar
        mode="single"
        month={visibleMonth}
        onMonthChange={setVisibleMonth}
        selected={value}
        onSelect={onChange}
        locale={locale}
        showOutsideDays
        className="p-3 pt-2"
        classNames={{
          caption: "hidden",
          nav: "hidden",
          month: "space-y-2",
          head_cell: "w-9 text-[0.75rem] font-medium text-muted-foreground",
          row: "mt-1 flex w-full",
          day: "h-9 w-9 rounded-md text-sm",
          day_selected:
            "rounded-md border border-primary bg-primary/10 font-medium text-primary hover:bg-primary/10 hover:text-primary focus:bg-primary/10 focus:text-primary",
          day_today: "bg-muted text-foreground",
        }}
      />

      <div className="border-t border-border p-3">
        <Button type="button" className="h-9 w-full rounded-md" onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </div>
  );
}

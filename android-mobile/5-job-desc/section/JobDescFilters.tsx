import { useState } from "react";
import { format, startOfDay } from "date-fns";
import { Calendar as CalendarIcon, ChevronDown } from "lucide-react";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Switch } from "@/shared/components/ui/switch";
import { Button } from "@/shared/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  DrawerClose,
} from "@/mobile-app/components/ui/drawer";
import { Calendar } from "@/mobile-app/components/ui/calendar";
import { cn } from "@/shared/lib/utils";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { DateRangeValue, JobDescEmployeeSummary, JobDescTimeframe } from "./types";

const timeframeOptions: { value: JobDescTimeframe; translationKey: string }[] = [
  { value: "daily", translationKey: "dailyTask.jobDesc.filters.daily" },
  { value: "weekly", translationKey: "dailyTask.jobDesc.filters.weekly" },
  { value: "monthly", translationKey: "dailyTask.jobDesc.filters.monthly" },
  { value: "custom", translationKey: "dailyTask.jobDesc.filters.custom" },
];

interface JobDescFiltersProps {
  timeframe: JobDescTimeframe;
  onTimeframeChange: (next: JobDescTimeframe) => void;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  showIdleOnly: boolean;
  onShowIdleOnlyChange: (value: boolean) => void;
  includeOverdue: boolean;
  onIncludeOverdueChange: (value: boolean) => void;
  customRange: DateRangeValue;
  onCustomRangeChange: (range: DateRangeValue) => void;
  employees: JobDescEmployeeSummary[];
  selectedEmployeeId: string | null;
  onEmployeeChange: (employeeId: string | null) => void;
}

export const JobDescFilters = ({
  timeframe,
  onTimeframeChange,
  searchTerm,
  onSearchTermChange,
  showIdleOnly,
  onShowIdleOnlyChange,
  includeOverdue,
  onIncludeOverdueChange,
  customRange,
  onCustomRangeChange,
  employees,
  selectedEmployeeId,
  onEmployeeChange,
}: JobDescFiltersProps) => {
  const { t, dateFnsLocale } = useAppTranslation();
  const [employeeDrawerOpen, setEmployeeDrawerOpen] = useState(false);
  /** Avoid native `input type="date"` (browser/WebView popover); use in-drawer calendar like other mobile modules. */
  const [customDateField, setCustomDateField] = useState<"start" | "end" | null>(null);

  const selectedEmployee = selectedEmployeeId
    ? employees.find((e) => e.employeeId === selectedEmployeeId)
    : null;
  const employeeLabel = selectedEmployee
    ? selectedEmployee.name
    : t("dailyTask.jobDesc.filters.employeePlaceholder", "All employees");

  return (
    <div className="space-y-3">
      <div>
        <p className="mb-1 text-xs font-semibold text-foreground">
          {t("dailyTask.jobDesc.filters.timeframe", "Timeframe")}
        </p>
        <div className="flex flex-wrap gap-2">
          {timeframeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onTimeframeChange(option.value)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs transition-colors",
                timeframe === option.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:border-muted-foreground/40",
              )}
            >
              {t(option.translationKey, option.value)}
            </button>
          ))}
        </div>
      </div>

      {timeframe === "custom" && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <Label className="text-[11px] text-muted-foreground">
                {t("dailyTask.jobDesc.filters.customStart", "Start date")}
              </Label>
              <Button
                type="button"
                variant="outline"
                className={cn(
                  "h-8 justify-start gap-1.5 px-2 text-left text-xs font-normal",
                  !customRange.start && "text-muted-foreground",
                )}
                onClick={() => setCustomDateField("start")}
              >
                <CalendarIcon className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                <span className="min-w-0 truncate">
                  {customRange.start
                    ? format(startOfDay(customRange.start), "d MMM yyyy", { locale: dateFnsLocale })
                    : t("datePicker.selectDate", "Select date")}
                </span>
              </Button>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-[11px] text-muted-foreground">
                {t("dailyTask.jobDesc.filters.customEnd", "End date")}
              </Label>
              <Button
                type="button"
                variant="outline"
                className={cn(
                  "h-8 justify-start gap-1.5 px-2 text-left text-xs font-normal",
                  !customRange.end && "text-muted-foreground",
                )}
                onClick={() => setCustomDateField("end")}
              >
                <CalendarIcon className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                <span className="min-w-0 truncate">
                  {customRange.end
                    ? format(startOfDay(customRange.end), "d MMM yyyy", { locale: dateFnsLocale })
                    : t("datePicker.selectDate", "Select date")}
                </span>
              </Button>
            </div>
          </div>

          <Drawer open={customDateField !== null} onOpenChange={(open) => !open && setCustomDateField(null)}>
            <DrawerContent
              className="mx-0 flex h-auto max-h-[90dvh] !w-full max-w-none min-w-0 flex-col items-stretch gap-0 rounded-t-2xl border-x-0 p-0 left-0 right-0 translate-x-0"
              style={{
                left: 0,
                right: 0,
                width: "100%",
                maxWidth: "100%",
                marginInline: 0,
              }}
            >
              <DrawerHeader className="safe-area-top border-b border-border/60 px-4 pb-3 pt-4 text-center">
                <DrawerTitle className="w-full text-center text-base font-semibold leading-snug">
                  {customDateField === "start"
                    ? t("dailyTask.jobDesc.filters.customStart", "Start date")
                    : t("dailyTask.jobDesc.filters.customEnd", "End date")}
                </DrawerTitle>
              </DrawerHeader>
              <div
                className={cn(
                  "flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto px-0 pb-1",
                  "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                )}
              >
                <div className="box-border w-full min-w-0 max-w-full self-stretch">
                  <Calendar
                    mode="single"
                    locale={dateFnsLocale}
                    defaultMonth={
                      customDateField === "start"
                        ? customRange.start ?? customRange.end ?? new Date()
                        : customRange.end ?? customRange.start ?? new Date()
                    }
                    selected={
                      customDateField === "start"
                        ? (customRange.start ? startOfDay(customRange.start) : undefined)
                        : (customRange.end ? startOfDay(customRange.end) : undefined)
                    }
                    onSelect={(date) => {
                      if (!date || !customDateField) return;
                      const day = startOfDay(date);
                      if (customDateField === "start") {
                        const end = customRange.end;
                        if (end && day > startOfDay(end)) {
                          onCustomRangeChange({ start: day, end: day });
                        } else {
                          onCustomRangeChange({ ...customRange, start: day });
                        }
                      } else {
                        const start = customRange.start;
                        if (start && day < startOfDay(start)) {
                          onCustomRangeChange({ start: day, end: startOfDay(start) });
                        } else {
                          onCustomRangeChange({ ...customRange, end: day });
                        }
                      }
                      setCustomDateField(null);
                    }}
                    initialFocus
                    className={cn(
                      "box-border !mx-0 w-full min-w-0 max-w-full bg-transparent !p-3 [direction:ltr]",
                    )}
                    classNames={{
                      months: "flex w-full max-w-full flex-col items-stretch",
                      month: "w-full max-w-full min-w-0 self-stretch space-y-3",
                      caption:
                        "relative flex h-11 w-full max-w-full items-center justify-center px-3 pt-1",
                      caption_label: "relative z-0 text-center text-sm font-semibold",
                      table: "w-full max-w-full border-collapse",
                      head_row: "mt-1 flex w-full max-w-full",
                      head_cell:
                        "min-w-0 flex-1 text-center text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground",
                      row: "mt-1.5 flex w-full max-w-full",
                      cell: "relative min-w-0 flex-1 p-0 text-center text-sm focus-within:z-20",
                      day: cn(
                        "mx-auto flex h-9 w-9 items-center justify-center rounded-md font-normal",
                        "aria-selected:opacity-100",
                      ),
                      day_selected:
                        "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                      day_today: "bg-accent text-accent-foreground",
                      day_outside: "text-muted-foreground opacity-40",
                      day_disabled: "text-muted-foreground opacity-30",
                      day_hidden: "invisible",
                    }}
                  />
                </div>
              </div>
              <div className="flex w-full min-w-0 max-w-full flex-shrink-0 flex-col border-t border-border bg-card px-4 pb-4 pt-3 box-border">
                <DrawerClose asChild>
                  <Button className="w-full max-w-full shrink-0" size="default" variant="default">
                    {t("dailyTaskReport.filters.done", "Done")}
                  </Button>
                </DrawerClose>
              </div>
            </DrawerContent>
          </Drawer>
        </>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Input
          value={searchTerm}
          onChange={(event) => onSearchTermChange(event.target.value)}
          placeholder={t(
            "dailyTask.jobDesc.filters.searchPlaceholder",
            "Cari karyawan atau tugas",
          )}
          className="h-8 text-xs"
        />
        <Drawer open={employeeDrawerOpen} onOpenChange={setEmployeeDrawerOpen}>
          <DrawerTrigger asChild>
            <Button
              variant="outline"
              className="h-8 text-xs border-input justify-between gap-1.5 text-left px-2 w-full"
            >
              <span className="truncate min-w-0">{employeeLabel}</span>
              <ChevronDown className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
            </Button>
          </DrawerTrigger>
          <DrawerContent className="max-h-[85dvh] flex flex-col">
            <DrawerHeader className="text-left pb-2 safe-area-top px-4 pt-4">
              <DrawerTitle className="text-lg font-semibold">
                {t("dailyTask.jobDesc.filters.employeePlaceholder", "All employees")}
              </DrawerTitle>
            </DrawerHeader>
            <div className="scrollbar-hide nested-scroll-touch-chain flex min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="scrollbar-hide nested-scroll-touch-chain flex max-h-[50vh] w-full flex-col gap-2 overflow-x-hidden overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <button
                  type="button"
                  onClick={() => {
                    onEmployeeChange(null);
                    setEmployeeDrawerOpen(false);
                  }}
                  className={cn(
                    "w-full px-3 py-2.5 rounded-md text-sm border text-left transition-colors break-words whitespace-normal",
                    !selectedEmployeeId
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-input hover:bg-muted"
                  )}
                >
                  {t("dailyTask.jobDesc.filters.employeePlaceholder", "All employees")}
                </button>
                {employees.map((employee) => (
                  <button
                    key={employee.employeeId}
                    type="button"
                    onClick={() => {
                      onEmployeeChange(employee.employeeId);
                      setEmployeeDrawerOpen(false);
                    }}
                    className={cn(
                      "w-full px-3 py-2.5 rounded-md text-sm border text-left transition-colors break-words whitespace-normal",
                      selectedEmployeeId === employee.employeeId
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background border-input hover:bg-muted"
                    )}
                  >
                    {employee.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-shrink-0 border-t bg-muted/30 px-4 pt-3 pb-3">
              <DrawerClose asChild>
                <Button className="w-full" size="sm">
                  {t("dailyTaskReport.filters.done", "Done")}
                </Button>
              </DrawerClose>
            </div>
          </DrawerContent>
        </Drawer>
      </div>

      <div className="flex items-center justify-between rounded-lg border px-3 py-2">
        <div>
          <p className="text-xs font-medium text-foreground">
            {t("dailyTask.jobDesc.filters.showIdleOnly", "Tampilkan hanya idle")}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {t("dailyTask.jobDesc.filters.showIdleOnlyHint", "Prioritaskan karyawan tanpa tugas aktif")}
          </p>
        </div>
        <Switch
          checked={showIdleOnly}
          onCheckedChange={onShowIdleOnlyChange}
          className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-input"
          aria-label="Toggle idle only"
        />
      </div>

      <div className="flex items-center justify-between rounded-lg border px-3 py-2">
        <div>
          <p className="text-xs font-medium text-foreground">
            {t("dailyTask.jobDesc.filters.includeOverdue", "Tampilkan overdue lintas rentang")}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {t("dailyTask.jobDesc.filters.includeOverdueHint", "Pastikan tugas telat tetap terlihat sampai selesai")}
          </p>
        </div>
        <Switch
          checked={includeOverdue}
          onCheckedChange={onIncludeOverdueChange}
          className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-input"
          aria-label="Toggle include overdue"
        />
      </div>
    </div>
  );
};

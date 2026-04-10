import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Input } from "@/features/ui/input";
import { Label } from "@/features/ui/label";
import { Switch } from "@/features/ui/switch";
import { Button } from "@/features/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  DrawerClose,
} from "@/mobile/components/ui/drawer";
import { cn } from "@/lib/utils";
import { useAppTranslation } from "@/features/share/i18n/useAppTranslation";
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
  const { t } = useAppTranslation();
  const [employeeDrawerOpen, setEmployeeDrawerOpen] = useState(false);

  const selectedEmployee = selectedEmployeeId
    ? employees.find((e) => e.employeeId === selectedEmployeeId)
    : null;
  const employeeLabel = selectedEmployee
    ? selectedEmployee.name
    : t("dailyTask.jobDesc.filters.employeePlaceholder", "All employees");

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-semibold text-gray-600 mb-1">
          {t("dailyTask.jobDesc.filters.timeframe", "Timeframe")}
        </p>
        <div className="flex flex-wrap gap-2">
          {timeframeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onTimeframeChange(option.value)}
              className={cn(
                "px-3 py-1.5 text-xs rounded-full border transition-colors",
                timeframe === option.value
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-300",
              )}
            >
              {t(option.translationKey, option.value)}
            </button>
          ))}
        </div>
      </div>

      {timeframe === "custom" && (
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col">
            <Label className="text-[11px] text-gray-500">
              {t("dailyTask.jobDesc.filters.customStart", "Start date")}
            </Label>
            <Input
              type="date"
              value={
                customRange.start
                  ? `${customRange.start.getFullYear()}-${String(customRange.start.getMonth() + 1).padStart(2, "0")}-${String(customRange.start.getDate()).padStart(2, "0")}`
                  : ""
              }
              onChange={(event) => {
                const value = event.target.value;
                onCustomRangeChange({
                  ...customRange,
                  start: value ? new Date(value + "T00:00:00") : null,
                });
              }}
              className="h-8 text-xs"
            />
          </div>
          <div className="flex flex-col">
            <Label className="text-[11px] text-gray-500">
              {t("dailyTask.jobDesc.filters.customEnd", "End date")}
            </Label>
            <Input
              type="date"
              value={
                customRange.end
                  ? `${customRange.end.getFullYear()}-${String(customRange.end.getMonth() + 1).padStart(2, "0")}-${String(customRange.end.getDate()).padStart(2, "0")}`
                  : ""
              }
              onChange={(event) => {
                const value = event.target.value;
                onCustomRangeChange({
                  ...customRange,
                  end: value ? new Date(value + "T00:00:00") : null,
                });
              }}
              className="h-8 text-xs"
            />
          </div>
        </div>
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
            <div className="overflow-y-auto overflow-x-hidden flex-1 min-h-0 px-4 pb-4">
              <div className="flex flex-col gap-2 w-full max-h-[50vh] overflow-y-auto overflow-x-hidden">
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
          <p className="text-xs font-medium text-gray-700">
            {t("dailyTask.jobDesc.filters.showIdleOnly", "Tampilkan hanya idle")}
          </p>
          <p className="text-[11px] text-gray-500">
            {t("dailyTask.jobDesc.filters.showIdleOnlyHint", "Prioritaskan karyawan tanpa tugas aktif")}
          </p>
        </div>
        <Switch
          checked={showIdleOnly}
          onCheckedChange={onShowIdleOnlyChange}
          className="data-[state=checked]:bg-indigo-600 data-[state=unchecked]:bg-gray-300"
          aria-label="Toggle idle only"
        />
      </div>

      <div className="flex items-center justify-between rounded-lg border px-3 py-2">
        <div>
          <p className="text-xs font-medium text-gray-700">
            {t("dailyTask.jobDesc.filters.includeOverdue", "Tampilkan overdue lintas rentang")}
          </p>
          <p className="text-[11px] text-gray-500">
            {t("dailyTask.jobDesc.filters.includeOverdueHint", "Pastikan tugas telat tetap terlihat sampai selesai")}
          </p>
        </div>
        <Switch
          checked={includeOverdue}
          onCheckedChange={onIncludeOverdueChange}
          className="data-[state=checked]:bg-indigo-600 data-[state=unchecked]:bg-gray-300"
          aria-label="Toggle include overdue"
        />
      </div>
    </div>
  );
};

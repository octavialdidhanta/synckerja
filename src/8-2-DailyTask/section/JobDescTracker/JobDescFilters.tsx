import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Switch } from "@/shared/components/ui/switch";
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
  const { t } = useAppTranslation();

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
                  ? "border-brand-blue bg-brand-blue text-white"
                  : "border-gray-200 bg-white text-gray-600 hover:border-gray-300",
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
              value={customRange.start ? customRange.start.toISOString().slice(0, 10) : ""}
              onChange={(event) =>
                onCustomRangeChange({
                  ...customRange,
                  start: event.target.value ? new Date(event.target.value) : null,
                })
              }
              className="h-8 text-xs"
            />
          </div>
          <div className="flex flex-col">
            <Label className="text-[11px] text-gray-500">
              {t("dailyTask.jobDesc.filters.customEnd", "End date")}
            </Label>
            <Input
              type="date"
              value={customRange.end ? customRange.end.toISOString().slice(0, 10) : ""}
              onChange={(event) =>
                onCustomRangeChange({
                  ...customRange,
                  end: event.target.value ? new Date(event.target.value) : null,
                })
              }
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
        <select
          value={selectedEmployeeId ?? ""}
          onChange={(event) => onEmployeeChange(event.target.value || null)}
          className="h-8 rounded border px-2 text-xs text-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-blue/40"
        >
          <option value="">
            {t("dailyTask.jobDesc.filters.employeePlaceholder", "Semua karyawan")}
          </option>
          {employees.map((employee) => (
            <option key={employee.employeeId} value={employee.employeeId}>
              {employee.name}
            </option>
          ))}
        </select>
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
          aria-label="Toggle include overdue"
        />
      </div>
    </div>
  );
};



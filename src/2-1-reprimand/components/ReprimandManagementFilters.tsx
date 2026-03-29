import { Search, RefreshCw } from "lucide-react";
import { Input } from "@/shared/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { AddReprimandDialog } from "./AddReprimandDialog";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

interface ReprimandFiltersType {
  search: string;
  department: string;
  status: string;
  severity: string;
  type: string;
  timePeriod: string;
}

interface ReprimandManagementFiltersProps {
  filters: ReprimandFiltersType;
  updateFilter: (key: keyof ReprimandFiltersType, value: string) => void;
  getFilterOptions: () => {
    departments: string[];
    statuses: string[];
    severities: string[];
    types: string[];
  };
  clearFilters: () => void;
}

function ReprimandManagementFilters({
  filters,
  updateFilter,
  getFilterOptions,
  clearFilters,
}: ReprimandManagementFiltersProps) {
  const { departments, statuses, severities, types } = getFilterOptions();
  const { t } = useAppTranslation();

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="relative min-w-[150px] flex-1">
          <Search className="absolute right-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
          <Input
            type="text"
            value={filters.search}
            onChange={(e) => updateFilter("search", e.target.value)}
            placeholder={t("reprimands.filters.searchPlaceholder", "Search reprimands...")}
            className="h-9 w-full rounded-md border border-border pl-4 pr-10 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-blue"
          />
        </div>

        <Select value={filters.department} onValueChange={(value) => updateFilter("department", value)}>
          <SelectTrigger className="h-9 w-full text-left text-sm text-foreground sm:w-36 lg:w-40">
            <SelectValue placeholder={t("reprimands.filters.departmentPlaceholder", "Department")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("reprimands.filters.allDepartments", "All Departments")}</SelectItem>
            {departments.map((dept) => (
              <SelectItem key={dept} value={dept}>
                {dept}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.status} onValueChange={(value) => updateFilter("status", value)}>
          <SelectTrigger className="h-9 w-full text-left text-sm text-foreground sm:w-36 lg:w-40">
            <SelectValue placeholder={t("reprimands.filters.statusPlaceholder", "Status")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("reprimands.filters.allStatus", "All Status")}</SelectItem>
            {statuses.map((status) => (
              <SelectItem key={status} value={status}>
                {status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.severity} onValueChange={(value) => updateFilter("severity", value)}>
          <SelectTrigger className="h-9 w-full text-left text-sm text-foreground sm:w-36 lg:w-40">
            <SelectValue placeholder={t("reprimands.filters.severityPlaceholder", "Severity")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("reprimands.filters.allSeverities", "All Severities")}</SelectItem>
            {severities.map((severity) => (
              <SelectItem key={severity} value={severity}>
                {severity}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.type} onValueChange={(value) => updateFilter("type", value)}>
          <SelectTrigger className="h-9 w-full text-left text-sm text-foreground sm:w-36 lg:w-40">
            <SelectValue placeholder={t("reprimands.filters.typePlaceholder", "Type")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("reprimands.filters.allTypes", "All Types")}</SelectItem>
            {types.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.timePeriod} onValueChange={(value) => updateFilter("timePeriod", value)}>
          <SelectTrigger className="h-9 w-full text-left text-sm text-foreground sm:w-36 lg:w-40">
            <SelectValue placeholder={t("reprimands.filters.timePlaceholder", "Time Period")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("reprimands.filters.allTime", "All Time")}</SelectItem>
            <SelectItem value="this_week">{t("reprimands.filters.thisWeek", "This Week")}</SelectItem>
            <SelectItem value="this_month">{t("reprimands.filters.thisMonth", "This Month")}</SelectItem>
            <SelectItem value="last_month">{t("reprimands.filters.lastMonth", "Last Month")}</SelectItem>
            <SelectItem value="last_3_months">{t("reprimands.filters.last3Months", "Last 3 Months")}</SelectItem>
            <SelectItem value="last_6_months">{t("reprimands.filters.last6Months", "Last 6 Months")}</SelectItem>
            <SelectItem value="this_year">{t("reprimands.filters.thisYear", "This Year")}</SelectItem>
            <SelectItem value="last_year">{t("reprimands.filters.lastYear", "Last Year")}</SelectItem>
          </SelectContent>
        </Select>

        <button
          type="button"
          onClick={clearFilters}
          className="flex h-9 items-center justify-center rounded-md border border-border px-3 transition-colors hover:bg-brand-blue/10 hover:text-brand-blue"
          title={t("reprimands.filters.clearFiltersTitle", "Clear all filters")}
        >
          <RefreshCw className="h-4 w-4 text-muted-foreground" />
        </button>

        <div className="flex-shrink-0">
          <AddReprimandDialog />
        </div>
      </div>
    </div>
  );
}

export default ReprimandManagementFilters;

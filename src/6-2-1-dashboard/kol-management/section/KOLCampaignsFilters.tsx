import { Search, RefreshCw, Plus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

export interface KOLCampaignsFiltersType {
  search: string;
  status: string;
  budget: string;
  date: string;
}

interface KOLCampaignsFiltersProps {
  filters: KOLCampaignsFiltersType;
  onFilterChange: (key: keyof KOLCampaignsFiltersType, value: string) => void;
  onClearFilters: () => void;
  onNewCampaign: () => void;
}

export const KOLCampaignsFilters = ({
  filters,
  onFilterChange,
  onClearFilters,
  onNewCampaign,
}: KOLCampaignsFiltersProps) => {
  const { t } = useAppTranslation();

  const hasActiveFilters =
    Boolean(filters.search) ||
    filters.status !== "all" ||
    filters.budget !== "all" ||
    filters.date !== "all";

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Search */}
        <div className="relative min-w-[120px] flex-1">
          <Search className="absolute right-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-brand-blue/45" />
          <Input
            type="text"
            placeholder={t("kolCampaigns.filters.searchPlaceholder", "Search campaigns...")}
            value={filters.search || ""}
            onChange={(e) => onFilterChange("search", e.target.value)}
            className="h-9 w-full rounded-md border border-brand-blue/25 pl-4 pr-10 text-sm text-gray-900 placeholder:text-gray-500 focus:border-brand-blue/40 focus:outline-none focus:ring-2 focus:ring-brand-blue/35"
          />
        </div>

        {/* Status */}
        <Select
          value={filters.status || "all"}
          onValueChange={(value) => onFilterChange("status", value)}
        >
          <SelectTrigger className="h-9 w-full text-left text-sm text-gray-700 placeholder:text-gray-700 sm:w-36 lg:w-40">
            <SelectValue placeholder={t("kolCampaigns.filters.status", "Status")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              {t("kolCampaigns.filters.allStatus", "All Status")}
            </SelectItem>
            <SelectItem value="draft">
              {t("kolCampaigns.filters.statusDraft", "Draft")}
            </SelectItem>
            <SelectItem value="active">
              {t("kolCampaigns.filters.statusActive", "Active")}
            </SelectItem>
            <SelectItem value="completed">
              {t("kolCampaigns.filters.statusCompleted", "Completed")}
            </SelectItem>
            <SelectItem value="cancelled">
              {t("kolCampaigns.filters.statusCancelled", "Cancelled")}
            </SelectItem>
          </SelectContent>
        </Select>

        {/* Budget */}
        <Select
          value={filters.budget || "all"}
          onValueChange={(value) => onFilterChange("budget", value)}
        >
          <SelectTrigger className="h-9 w-full text-left text-sm text-gray-700 placeholder:text-gray-700 sm:w-36 lg:w-40">
            <SelectValue placeholder={t("kolCampaigns.filters.budget", "Budget")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              {t("kolCampaigns.filters.allBudget", "All Budget")}
            </SelectItem>
            <SelectItem value="low">
              {t("kolCampaigns.filters.budgetLow", "< Rp 10jt")}
            </SelectItem>
            <SelectItem value="medium">
              {t("kolCampaigns.filters.budgetMedium", "Rp 10jt - Rp 50jt")}
            </SelectItem>
            <SelectItem value="high">
              {t("kolCampaigns.filters.budgetHigh", "> Rp 50jt")}
            </SelectItem>
          </SelectContent>
        </Select>

        {/* Date */}
        <Select
          value={filters.date || "all"}
          onValueChange={(value) => onFilterChange("date", value)}
        >
          <SelectTrigger className="h-9 w-full text-left text-sm text-gray-700 placeholder:text-gray-700 sm:w-36 lg:w-40">
            <SelectValue placeholder={t("kolCampaigns.filters.date", "Date")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              {t("kolCampaigns.filters.allDates", "All Dates")}
            </SelectItem>
            <SelectItem value="this-month">
              {t("kolCampaigns.filters.dateThisMonth", "This Month")}
            </SelectItem>
            <SelectItem value="last-month">
              {t("kolCampaigns.filters.dateLastMonth", "Last Month")}
            </SelectItem>
            <SelectItem value="this-quarter">
              {t("kolCampaigns.filters.dateThisQuarter", "This Quarter")}
            </SelectItem>
          </SelectContent>
        </Select>

        {/* Clear */}
        <button
          type="button"
          onClick={onClearFilters}
          disabled={!hasActiveFilters}
          className={`flex h-9 items-center justify-center rounded-md border border-gray-300 px-3 text-sm transition-colors ${
            hasActiveFilters ? "cursor-pointer hover:bg-gray-100" : "cursor-not-allowed opacity-50"
          }`}
          title={t("kolCampaigns.filters.clearAll", "Clear all filters")}
        >
          <RefreshCw className="h-4 w-4 text-gray-500" />
        </button>

        {/* New Campaign */}
        <Button
          type="button"
          onClick={onNewCampaign}
          className="flex h-9 flex-shrink-0 items-center gap-1.5 whitespace-nowrap bg-brand-blue px-3 text-sm text-white hover:bg-brand-blue/90"
        >
          <Plus className="h-4 w-4" />
          {t("kolCampaigns.filters.newCampaign", "New Campaign")}
        </Button>
      </div>
    </div>
  );
};


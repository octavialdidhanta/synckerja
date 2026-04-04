import { Search, RefreshCw, Plus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

export type KOLManagementFiltersType = {
  search: string;
  category: string;
  platform: string;
  status: string;
  performance: string;
};

interface KOLManagementFiltersProps {
  filters: KOLManagementFiltersType;
  onFilterChange: (key: keyof KOLManagementFiltersType, value: string) => void;
  onClearFilters: () => void;
  onAddKOL: () => void;
}

export const KOLManagementFilters = ({
  filters,
  onFilterChange,
  onClearFilters,
  onAddKOL,
}: KOLManagementFiltersProps) => {
  const { t } = useAppTranslation();

  const hasActiveFilters =
    Boolean(filters.search) ||
    filters.category !== "all" ||
    filters.platform !== "all" ||
    filters.status !== "all" ||
    filters.performance !== "all";

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Search Input */}
        <div className="relative min-w-[120px] flex-1">
          <Search className="absolute right-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            type="text"
            placeholder={t("kolManagement.filters.searchPlaceholder", "Search KOLs...")}
            value={filters.search || ""}
            onChange={(e) => onFilterChange("search", e.target.value)}
            className="h-9 w-full rounded-md border border-gray-300 pl-4 pr-10 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <Select
          value={filters.category || "all"}
          onValueChange={(value) => onFilterChange("category", value)}
        >
          <SelectTrigger className="h-9 w-full text-left text-sm sm:w-36 lg:w-40">
            <SelectValue placeholder={t("kolManagement.filters.category", "Category")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("kolManagement.filters.allCategories", "All Categories")}</SelectItem>
            <SelectItem value="fashion">{t("kolManagement.filters.categoryFashion", "Fashion")}</SelectItem>
            <SelectItem value="beauty">{t("kolManagement.filters.categoryBeauty", "Beauty")}</SelectItem>
            <SelectItem value="food">{t("kolManagement.filters.categoryFood", "Food & Beverage")}</SelectItem>
            <SelectItem value="lifestyle">{t("kolManagement.filters.categoryLifestyle", "Lifestyle")}</SelectItem>
            <SelectItem value="tech">{t("kolManagement.filters.categoryTech", "Technology")}</SelectItem>
            <SelectItem value="travel">{t("kolManagement.filters.categoryTravel", "Travel")}</SelectItem>
            <SelectItem value="fitness">{t("kolManagement.filters.categoryFitness", "Fitness")}</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.platform || "all"}
          onValueChange={(value) => onFilterChange("platform", value)}
        >
          <SelectTrigger className="h-9 w-full text-left text-sm sm:w-36 lg:w-40">
            <SelectValue placeholder={t("kolManagement.filters.platform", "Platform")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("kolManagement.filters.allPlatforms", "All Platforms")}</SelectItem>
            <SelectItem value="instagram">Instagram</SelectItem>
            <SelectItem value="tiktok">TikTok</SelectItem>
            <SelectItem value="youtube">YouTube</SelectItem>
            <SelectItem value="twitter">Twitter</SelectItem>
            <SelectItem value="facebook">Facebook</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.status || "all"}
          onValueChange={(value) => onFilterChange("status", value)}
        >
          <SelectTrigger className="h-9 w-full text-left text-sm sm:w-36 lg:w-40">
            <SelectValue placeholder={t("kolManagement.filters.status", "Status")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("kolManagement.filters.allStatus", "All Status")}</SelectItem>
            <SelectItem value="active">{t("kolManagement.filters.statusActive", "Active")}</SelectItem>
            <SelectItem value="inactive">{t("kolManagement.filters.statusInactive", "Inactive")}</SelectItem>
            <SelectItem value="blacklisted">{t("kolManagement.filters.statusBlacklisted", "Blacklisted")}</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.performance || "all"}
          onValueChange={(value) => onFilterChange("performance", value)}
        >
          <SelectTrigger className="h-9 w-full text-left text-sm sm:w-36 lg:w-40">
            <SelectValue placeholder={t("kolManagement.filters.performance", "Performance")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("kolManagement.filters.allPerformance", "All Performance")}</SelectItem>
            <SelectItem value="high">{t("kolManagement.filters.performanceHigh", "High (5%+)")}</SelectItem>
            <SelectItem value="medium">{t("kolManagement.filters.performanceMedium", "Medium (2-5%)")}</SelectItem>
            <SelectItem value="low">{t("kolManagement.filters.performanceLow", "Low (<2%)")}</SelectItem>
          </SelectContent>
        </Select>

        <button
          onClick={onClearFilters}
          disabled={!hasActiveFilters}
          className={`flex h-9 items-center justify-center rounded-md border px-3 transition-colors ${
            hasActiveFilters
              ? "cursor-pointer hover:bg-gray-100"
              : "cursor-not-allowed opacity-50"
          } border-gray-300`}
          title={t("kolManagement.filters.clearAll", "Clear all filters")}
          type="button"
        >
          <RefreshCw className="h-4 w-4 text-gray-500" />
        </button>

        <Button
          type="button"
          onClick={onAddKOL}
          className="h-9 flex-shrink-0 bg-brand-blue px-3 text-sm text-white hover:bg-brand-blue/90"
        >
          <Plus className="mr-1 h-4 w-4" />
          {t("kolManagement.filters.addKOL", "Add KOL")}
        </Button>
      </div>
    </div>
  );
};


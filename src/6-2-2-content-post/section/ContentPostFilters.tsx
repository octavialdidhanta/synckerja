import { Search, RefreshCw, Plus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import {
  KOL_CONTENT_PLATFORM_OPTIONS,
  KOL_CONTENT_TYPE_OPTIONS,
} from "@/shared/constants/kolContentPostOptions";

export interface ContentPostFiltersType {
  search: string;
  campaign: string;
  platform: string;
  status: string;
  contentType: string;
}

interface ContentPostFiltersProps {
  filters: ContentPostFiltersType;
  onFilterChange: (key: keyof ContentPostFiltersType, value: string) => void;
  onClearFilters: () => void;
  onCreatePost: () => void;
  campaignOptions: Array<{ id: string; name: string; kolName?: string }>;
  createDisabled?: boolean;
}

export const ContentPostFilters = ({
  filters,
  onFilterChange,
  onClearFilters,
  onCreatePost,
  campaignOptions,
  createDisabled = false,
}: ContentPostFiltersProps) => {
  const hasActiveFilters =
    Boolean(filters.search) ||
    filters.campaign !== "all" ||
    filters.platform !== "all" ||
    filters.status !== "all" ||
    filters.contentType !== "all";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <div className="relative min-w-[120px] flex-1">
        <Search className="absolute right-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-brand-blue/45" />
        <Input
          placeholder="Cari content post..."
          value={filters.search}
          onChange={(e) => onFilterChange("search", e.target.value)}
          className="h-9 border-brand-blue/25 pl-3 pr-10 text-sm focus-visible:border-brand-blue/40 focus-visible:ring-2 focus-visible:ring-brand-blue/35 focus-visible:ring-offset-0"
        />
      </div>

      <Select value={filters.campaign} onValueChange={(val) => onFilterChange("campaign", val)}>
        <SelectTrigger className="h-9 w-full sm:w-52">
          <SelectValue placeholder="Campaign" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Semua Campaign</SelectItem>
          {campaignOptions.map((item) => (
            <SelectItem key={item.id} value={item.id}>
              {item.name} - {item.kolName || "-"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.platform} onValueChange={(val) => onFilterChange("platform", val)}>
        <SelectTrigger className="h-9 w-full sm:w-36">
          <SelectValue placeholder="Platform" />
        </SelectTrigger>
        <SelectContent className="max-h-[min(320px,70vh)]">
          <SelectItem value="all">Semua Platform</SelectItem>
          {KOL_CONTENT_PLATFORM_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.contentType} onValueChange={(val) => onFilterChange("contentType", val)}>
        <SelectTrigger className="h-9 w-full sm:w-36">
          <SelectValue placeholder="Content Type" />
        </SelectTrigger>
        <SelectContent className="max-h-[min(320px,70vh)]">
          <SelectItem value="all">Semua Tipe</SelectItem>
          {KOL_CONTENT_TYPE_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.status} onValueChange={(val) => onFilterChange("status", val)}>
        <SelectTrigger className="h-9 w-full sm:w-36">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Semua Status</SelectItem>
          <SelectItem value="draft">Draft</SelectItem>
          <SelectItem value="posted">Posted</SelectItem>
          <SelectItem value="archived">Archived</SelectItem>
        </SelectContent>
      </Select>

      <button
        type="button"
        onClick={onClearFilters}
        disabled={!hasActiveFilters}
        className={`flex h-9 items-center justify-center rounded-md border border-gray-300 px-3 text-sm ${
          hasActiveFilters ? "hover:bg-gray-100" : "cursor-not-allowed opacity-50"
        }`}
      >
        <RefreshCw className="h-4 w-4 text-gray-500" />
      </button>

      <Button
        type="button"
        onClick={onCreatePost}
        disabled={createDisabled}
        className="flex h-9 items-center gap-1.5 bg-brand-blue text-white hover:bg-brand-blue/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Plus className="h-4 w-4" />
        Create Content Post
      </Button>
    </div>
  );
};

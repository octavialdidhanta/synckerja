import { Search, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { FlowBuilderStatusFilter } from "@/5-3-dashboard/omnichannel-settings/components/flow-builder/listing/filters/FlowBuilderStatusFilter";
import { FlowBuilderUserFilter } from "@/5-3-dashboard/omnichannel-settings/components/flow-builder/listing/filters/FlowBuilderUserFilter";
import { FlowBuilderLastUpdatedFilter } from "@/5-3-dashboard/omnichannel-settings/components/flow-builder/listing/filters/FlowBuilderLastUpdatedFilter";
import type {
  FlowBuilderListingFilters,
  FlowBuilderStatusFilter as FlowBuilderStatusFilterValue,
  FlowBuilderUserOption,
} from "@/5-3-dashboard/omnichannel-settings/types/flowBuilder.types";

type FlowBuilderListingToolbarProps = {
  filters: FlowBuilderListingFilters;
  users: FlowBuilderUserOption[];
  onSearchChange: (value: string) => void;
  onStatusChange: (value: FlowBuilderStatusFilterValue) => void;
  onCreatedByChange: (userId: string | null) => void;
  onUpdatedByChange: (userId: string | null) => void;
  onLastUpdatedDateChange: (value: Date | null) => void;
  onResetFilters: () => void;
  onCreateClick: () => void;
  selectedCount?: number;
  onDeleteClick?: () => void;
  limitBar?: ReactNode;
};

export function FlowBuilderListingToolbar({
  filters,
  users,
  onSearchChange,
  onStatusChange,
  onCreatedByChange,
  onUpdatedByChange,
  onLastUpdatedDateChange,
  onResetFilters,
  onCreateClick,
  selectedCount = 0,
  onDeleteClick,
  limitBar,
}: FlowBuilderListingToolbarProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-3">
      {limitBar}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={t("omnichannel.settings.flowBuilder.listing.searchPlaceholder")}
            className="h-10 pl-9"
            aria-label={t("omnichannel.settings.flowBuilder.listing.searchPlaceholder")}
          />
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {selectedCount > 0 && onDeleteClick ? (
            <Button type="button" variant="destructive" className="h-10 px-4" onClick={onDeleteClick}>
              <Trash2 className="mr-2 h-4 w-4" />
              {t("omnichannel.settings.flowBuilder.listing.deleteSelected", { count: selectedCount })}
            </Button>
          ) : null}
          <Button type="button" className="h-10 px-4" onClick={onCreateClick}>
            {t("omnichannel.settings.flowBuilder.listing.createFlow")}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <FlowBuilderStatusFilter value={filters.status} onChange={onStatusChange} />
        <FlowBuilderUserFilter
          labelKey="omnichannel.settings.flowBuilder.filters.createdBy"
          value={filters.createdById}
          onChange={onCreatedByChange}
          users={users}
        />
        <FlowBuilderUserFilter
          labelKey="omnichannel.settings.flowBuilder.filters.updatedBy"
          value={filters.updatedById}
          onChange={onUpdatedByChange}
          users={users}
        />
        <FlowBuilderLastUpdatedFilter value={filters.lastUpdatedDate} onChange={onLastUpdatedDateChange} />
        <button
          type="button"
          className="ml-auto text-sm text-muted-foreground transition-colors hover:text-primary"
          onClick={onResetFilters}
        >
          {t("omnichannel.settings.flowBuilder.filters.reset")}
        </button>
      </div>
    </div>
  );
}

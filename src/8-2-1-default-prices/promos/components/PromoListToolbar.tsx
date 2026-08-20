import { Search } from "lucide-react";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { PromoListStatusFilter } from "../types";

export type PromoListToolbarProps = {
  status: PromoListStatusFilter;
  onStatusChange: (status: PromoListStatusFilter) => void;
  query: string;
  onQueryChange: (query: string) => void;
};

const STATUS_OPTIONS: PromoListStatusFilter[] = ["all", "scheduled", "ongoing", "inactive"];

export function PromoListToolbar({
  status,
  onStatusChange,
  query,
  onQueryChange,
}: PromoListToolbarProps) {
  const { t } = useAppTranslation();
  const statusLabel = (value: PromoListStatusFilter) => {
    if (value === "scheduled") return t("defaultPrices.promos.filter.scheduled", "Scheduled");
    if (value === "ongoing") return t("defaultPrices.promos.filter.ongoing", "Ongoing");
    if (value === "inactive") return t("defaultPrices.promos.filter.inactive", "Inactive");
    return t("defaultPrices.promos.filter.allStatus", "All Status");
  };

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <Select
        value={status}
        onValueChange={(value) => onStatusChange(value as PromoListStatusFilter)}
      >
        <SelectTrigger
          className="h-9 w-[160px] rounded-full"
          aria-label={t("defaultPrices.promos.filter.allStatus", "All Status")}
        >
          <SelectValue>{statusLabel(status)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((value) => (
            <SelectItem key={value} value={value}>
              {statusLabel(value)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="relative w-[240px] max-w-full">
        <Input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={t("defaultPrices.promos.searchPlaceholder", "Search promo")}
          className="h-9 rounded-full pr-9"
          aria-label={t("defaultPrices.promos.searchPlaceholder", "Search promo")}
        />
        <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      </div>
    </div>
  );
}

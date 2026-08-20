import { Download, RefreshCw, Search } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { OutletFilterSelect } from "@/8-2-2-outlets/components/OutletFilterSelect";
import type { InventorySummaryKindFilter } from "../types";
import { InventorySummaryDateControl } from "./InventorySummaryDateControl";

export type InventorySummaryToolbarProps = {
  outletId: string;
  onOutletChange: (id: string) => void;
  from: Date;
  to: Date;
  onRangeChange: (from: Date, to: Date) => void;
  kind: InventorySummaryKindFilter;
  onKindChange: (kind: InventorySummaryKindFilter) => void;
  search: string;
  onSearchChange: (value: string) => void;
  onExport: () => void;
  canManage?: boolean;
  migrating?: boolean;
  onMigrateSkuStock?: () => void;
};

export function InventorySummaryToolbar({
  outletId,
  onOutletChange,
  from,
  to,
  onRangeChange,
  kind,
  onKindChange,
  search,
  onSearchChange,
  onExport,
  canManage = false,
  migrating = false,
  onMigrateSkuStock,
}: InventorySummaryToolbarProps) {
  const { t } = useAppTranslation();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{t("operations.inventory.summary.heading", "Summary")}</h2>
        <div className="flex flex-wrap items-center gap-2">
          {canManage && onMigrateSkuStock ? (
            <Button
              type="button"
              variant="outline"
              className="h-9"
              disabled={migrating}
              onClick={onMigrateSkuStock}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${migrating ? "animate-spin" : ""}`} />
              {t("operations.inventory.summary.migrateSku", "Migrate SKU stock")}
            </Button>
          ) : null}
          <Button type="button" className="h-9" onClick={onExport}>
            <Download className="mr-2 h-4 w-4" />
            {t("operations.inventory.summary.export", "Export")}
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <OutletFilterSelect value={outletId} onChange={onOutletChange} />
        <InventorySummaryDateControl from={from} to={to} onChange={onRangeChange} />
        <Select value={kind} onValueChange={(value) => onKindChange(value as InventorySummaryKindFilter)}>
          <SelectTrigger className="h-9 w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="item_library">
              {t("operations.inventory.summary.kindProducts", "Item Library")}
            </SelectItem>
            <SelectItem value="ingredients">
              {t("operations.inventory.summary.kindIngredients", "Ingredients")}
            </SelectItem>
          </SelectContent>
        </Select>
        <div className="relative min-w-[180px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t("operations.inventory.summary.search", "Search")}
            className="h-9 pl-8"
          />
        </div>
      </div>
    </div>
  );
}

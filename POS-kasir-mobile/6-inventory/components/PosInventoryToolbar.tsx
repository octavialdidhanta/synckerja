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
import {
  POS_INVENTORY_FILTER_ALL,
  type PosInventoryKindFilter,
  type PosInventoryStatusFilter,
} from "../lib/filterPosInventoryRows";
import { POS_INVENTORY_I18N } from "../lib/posInventoryCopy";

type Props = {
  kind: PosInventoryKindFilter;
  onKindChange: (value: PosInventoryKindFilter) => void;
  inventoryStatus: PosInventoryStatusFilter;
  onInventoryStatusChange: (value: PosInventoryStatusFilter) => void;
  search: string;
  onSearchChange: (value: string) => void;
};

export function PosInventoryToolbar({
  kind,
  onKindChange,
  inventoryStatus,
  onInventoryStatusChange,
  search,
  onSearchChange,
}: Props) {
  const { t } = useAppTranslation();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={kind}
        onValueChange={(v) => onKindChange(v as PosInventoryKindFilter)}
      >
        <SelectTrigger className="h-10 w-[180px] bg-white">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={POS_INVENTORY_FILTER_ALL}>
            {t(POS_INVENTORY_I18N.filterAllKinds, "All Ingredient Types")}
          </SelectItem>
          <SelectItem value="raw">
            {t(POS_INVENTORY_I18N.filterRaw, "Raw Ingredient")}
          </SelectItem>
          <SelectItem value="semi_finished">
            {t(POS_INVENTORY_I18N.filterSemi, "Semi-Finished Ingredient")}
          </SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={inventoryStatus}
        onValueChange={(v) => onInventoryStatusChange(v as PosInventoryStatusFilter)}
      >
        <SelectTrigger className="h-10 w-[160px] bg-white">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={POS_INVENTORY_FILTER_ALL}>
            {t(POS_INVENTORY_I18N.filterAllInventory, "All Inventory")}
          </SelectItem>
          <SelectItem value="low">
            {t("ingredient.library.statusLow", "Low Stock")}
          </SelectItem>
          <SelectItem value="out">
            {t("ingredient.library.statusOut", "Out of Stock")}
          </SelectItem>
        </SelectContent>
      </Select>

      <div className="relative min-w-[160px] flex-1">
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t(POS_INVENTORY_I18N.search, "Search")}
          className="h-10 bg-white pr-9"
        />
        <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </div>
    </div>
  );
}

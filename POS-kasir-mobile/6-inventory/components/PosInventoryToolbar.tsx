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
import { cn } from "@/shared/lib/utils";
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
  /** Phone uses segmented controls; tablet keeps Select dropdowns. */
  isPhoneLayout?: boolean;
};

type SegmentOption<T extends string> = {
  value: T;
  label: string;
};

function SegmentedControl<T extends string>({
  ariaLabel,
  value,
  options,
  onChange,
}: {
  ariaLabel: string;
  value: T;
  options: SegmentOption<T>[];
  onChange: (value: T) => void;
}) {
  const cols =
    options.length === 2
      ? "grid-cols-2"
      : options.length === 3
        ? "grid-cols-3"
        : "grid-cols-4";

  return (
    <div
      className={cn(
        "grid h-9 flex-1 gap-0.5 rounded-lg bg-slate-100 p-0.5 ring-1 ring-slate-200/80",
        cols,
      )}
      role="tablist"
      aria-label={ariaLabel}
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(opt.value)}
            className={cn(
              "h-full rounded-md text-[11px] font-semibold leading-none transition-colors",
              selected
                ? "bg-white text-primary shadow-sm"
                : "text-slate-500 hover:text-slate-800",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/** Phone chrome: search + Menu|Bill-style segmented filters (no floating pill chips). */
export function PosInventoryPhoneToolbar({
  kind,
  onKindChange,
  inventoryStatus,
  onInventoryStatusChange,
  search,
  onSearchChange,
}: Omit<Props, "isPhoneLayout">) {
  const { t } = useAppTranslation();

  const kindOptions: SegmentOption<PosInventoryKindFilter>[] = [
    {
      value: POS_INVENTORY_FILTER_ALL,
      label: t(POS_INVENTORY_I18N.phoneFilterAllKinds, "All"),
    },
    {
      value: "raw",
      label: t(POS_INVENTORY_I18N.phoneFilterRaw, "Raw"),
    },
    {
      value: "semi_finished",
      label: t(POS_INVENTORY_I18N.phoneFilterSemi, "Semi"),
    },
  ];
  const statusOptions: SegmentOption<PosInventoryStatusFilter>[] = [
    {
      value: POS_INVENTORY_FILTER_ALL,
      label: t(POS_INVENTORY_I18N.phoneFilterAllInventory, "All"),
    },
    {
      value: "low",
      label: t(POS_INVENTORY_I18N.phoneFilterLow, "Low"),
    },
    {
      value: "out",
      label: t(POS_INVENTORY_I18N.phoneFilterOut, "Out"),
    },
  ];

  return (
    <div className="flex flex-shrink-0 flex-col gap-2 border-b border-slate-200 bg-white px-2 py-2.5 sm:px-2.5">
      <div className="relative w-full">
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t(POS_INVENTORY_I18N.search, "Search")}
          className="h-10 border-slate-200 bg-slate-50 pr-9"
        />
        <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </div>
      <div className="flex gap-2">
        <SegmentedControl
          ariaLabel={t(POS_INVENTORY_I18N.filterAllKinds, "All Ingredient Types")}
          value={kind}
          options={kindOptions}
          onChange={onKindChange}
        />
        <SegmentedControl
          ariaLabel={t(POS_INVENTORY_I18N.filterAllInventory, "All Inventory")}
          value={inventoryStatus}
          options={statusOptions}
          onChange={onInventoryStatusChange}
        />
      </div>
    </div>
  );
}

export function PosInventoryToolbar({
  kind,
  onKindChange,
  inventoryStatus,
  onInventoryStatusChange,
  search,
  onSearchChange,
  isPhoneLayout,
}: Props) {
  const { t } = useAppTranslation();

  if (isPhoneLayout) {
    return (
      <PosInventoryPhoneToolbar
        kind={kind}
        onKindChange={onKindChange}
        inventoryStatus={inventoryStatus}
        onInventoryStatusChange={onInventoryStatusChange}
        search={search}
        onSearchChange={onSearchChange}
      />
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={kind}
        onValueChange={(v) => onKindChange(v as PosInventoryKindFilter)}
      >
        <SelectTrigger className="h-10 w-[180px] border-slate-200 bg-white shadow-sm">
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
        <SelectTrigger className="h-10 w-[160px] border-slate-200 bg-white shadow-sm">
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
          className="h-10 border-slate-200 bg-white shadow-sm pr-9"
        />
        <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </div>
    </div>
  );
}

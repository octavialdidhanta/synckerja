import { Plus } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { OutletFilterSelect } from "@/8-2-2-outlets/components/OutletFilterSelect";
import { InventorySummaryDateControl } from "@/6-0-stock-management/summary/components/InventorySummaryDateControl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { InventoryAdjustmentKindFilter } from "../types";

export function InventoryAdjustmentToolbar(props: {
  outletId: string;
  onOutletChange: (id: string) => void;
  from: Date;
  to: Date;
  onRangeChange: (from: Date, to: Date) => void;
  kind: InventoryAdjustmentKindFilter;
  onKindChange: (kind: InventoryAdjustmentKindFilter) => void;
  canManage: boolean;
  onCreateClick: () => void;
  creating?: boolean;
}) {
  const { t } = useAppTranslation();

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-base font-semibold">{t("operations.inventory.adjustment.heading", "Adjustment")}</h2>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <OutletFilterSelect value={props.outletId} onChange={props.onOutletChange} />
          <InventorySummaryDateControl
            from={props.from}
            to={props.to}
            onChange={(nextFrom, nextTo) => props.onRangeChange(nextFrom, nextTo)}
          />
          <Select
            value={props.kind}
            onValueChange={(value) => props.onKindChange(value as InventoryAdjustmentKindFilter)}
          >
            <SelectTrigger className="h-9 w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="item_library">{t("operations.inventory.summary.kindProducts", "Item Library")}</SelectItem>
              <SelectItem value="ingredients">{t("operations.inventory.summary.kindIngredients", "Ingredients")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {props.canManage ? (
          <Button type="button" className="h-9" onClick={props.onCreateClick} disabled={props.creating}>
            <Plus className="mr-1 h-4 w-4" />
            {t("operations.inventory.adjustment.create", "Create Adjustment")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}


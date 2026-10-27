import { Download, Plus } from "lucide-react";
import { endOfDay, startOfDay } from "date-fns";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/components/ui/tooltip";
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
import type { PurchaseOrderKindFilter, PurchaseOrderStatusFilter } from "../types";

export function PurchaseOrdersToolbar(props: {
  outletId: string;
  onOutletChange: (id: string) => void;
  kind: PurchaseOrderKindFilter;
  onKindChange: (kind: PurchaseOrderKindFilter) => void;
  status: PurchaseOrderStatusFilter;
  onStatusChange: (status: PurchaseOrderStatusFilter) => void;
  from: Date;
  to: Date;
  onRangeChange: (from: Date, to: Date) => void;
  search: string;
  onSearchChange: (value: string) => void;
  onExport: () => void;
  onCreate: () => void;
  createDisabled?: boolean;
  createDisabledReason?: string;
  workflowMode?: "simple" | "advanced";
}) {
  const { t } = useAppTranslation();
  const modeLabel =
    props.workflowMode === "advanced"
      ? t("operations.inventory.purchaseOrders.advanced", "Advanced")
      : t("operations.inventory.purchaseOrders.simple", "Simple");

  return (
    <div className="flex min-w-0 flex-nowrap items-center gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <h2 className="flex h-10 shrink-0 items-center whitespace-nowrap text-lg font-semibold leading-none text-gray-900">
        {t("operations.inventory.purchaseOrders.heading", "Purchase Order")}
        <span className="ml-1 font-normal text-muted-foreground">({modeLabel})</span>
      </h2>
      <Select value={props.kind} onValueChange={(v) => props.onKindChange(v as PurchaseOrderKindFilter)}>
        <SelectTrigger className="h-10 w-[140px] shrink-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="item_library">
            {t("operations.inventory.purchaseOrders.kindItems", "Items")}
          </SelectItem>
          <SelectItem value="ingredients">
            {t("operations.inventory.purchaseOrders.kindIngredients", "Ingredients")}
          </SelectItem>
        </SelectContent>
      </Select>
      <OutletFilterSelect
        value={props.outletId}
        onChange={props.onOutletChange}
        includeAll
        className="h-10 w-[180px] shrink-0"
      />
      <InventorySummaryDateControl
        from={props.from}
        to={props.to}
        onChange={(nextFrom, nextTo) => {
          props.onRangeChange(startOfDay(nextFrom), endOfDay(nextTo));
        }}
      />
      <Select value={props.status} onValueChange={(v) => props.onStatusChange(v as PurchaseOrderStatusFilter)}>
        <SelectTrigger className="h-10 w-[150px] shrink-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("operations.inventory.purchaseOrders.status.all", "All Status")}</SelectItem>
          <SelectItem value="waiting">
            {t("operations.inventory.purchaseOrders.status.waiting", "Waiting for Fulfillment")}
          </SelectItem>
          <SelectItem value="completed">
            {t("operations.inventory.purchaseOrders.status.completed", "Completed")}
          </SelectItem>
          <SelectItem value="cancelled">
            {t("operations.inventory.purchaseOrders.status.cancelled", "Cancelled")}
          </SelectItem>
        </SelectContent>
      </Select>
      <Input
        value={props.search}
        onChange={(e) => props.onSearchChange(e.target.value)}
        placeholder={t("operations.inventory.purchaseOrders.search", "Search")}
        className="h-10 w-40 shrink-0"
      />
      <Button type="button" variant="outline" className="h-10 shrink-0" onClick={props.onExport}>
        <Download className="mr-2 h-4 w-4" />
        {t("operations.inventory.purchaseOrders.export", "Export")}
      </Button>
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex shrink-0">
              <Button
                type="button"
                className="h-10"
                onClick={props.onCreate}
                disabled={props.createDisabled}
              >
                <Plus className="mr-2 h-4 w-4" />
                {t("operations.inventory.purchaseOrders.create", "Create PO")}
              </Button>
            </span>
          </TooltipTrigger>
          {props.createDisabled && props.createDisabledReason ? (
            <TooltipContent>{props.createDisabledReason}</TooltipContent>
          ) : null}
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

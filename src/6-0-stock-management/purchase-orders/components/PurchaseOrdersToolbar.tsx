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
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold">
          {t("operations.inventory.purchaseOrders.heading", "Purchase Order")}
          <span className="ml-1 font-normal text-muted-foreground">({modeLabel})</span>
        </h2>
        <Select value={props.kind} onValueChange={(v) => props.onKindChange(v as PurchaseOrderKindFilter)}>
          <SelectTrigger className="h-9 w-[140px]">
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
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <OutletFilterSelect value={props.outletId} onChange={props.onOutletChange} includeAll />
        <InventorySummaryDateControl
          from={props.from}
          to={props.to}
          onChange={(nextFrom, nextTo) => {
            props.onRangeChange(startOfDay(nextFrom), endOfDay(nextTo));
          }}
        />
        <Select value={props.status} onValueChange={(v) => props.onStatusChange(v as PurchaseOrderStatusFilter)}>
          <SelectTrigger className="h-9 w-[150px]">
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
          className="h-9 w-40"
        />
        <Button type="button" variant="outline" className="h-9" onClick={props.onExport}>
          <Download className="mr-1 h-4 w-4" />
          {t("operations.inventory.purchaseOrders.export", "Export")}
        </Button>
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <Button
                  type="button"
                  className="h-9"
                  onClick={props.onCreate}
                  disabled={props.createDisabled}
                >
                  <Plus className="mr-1 h-4 w-4" />
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
    </div>
  );
}

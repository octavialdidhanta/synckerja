import { useState } from "react";
import { ChevronDown, Printer } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/shared/components/ui/sheet";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { Textarea } from "@/shared/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { formatToRupiah } from "@/shared/utils/formatCurrency";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useInventoryFeatureAccessCheck } from "@/8-2-5-inventory-settings/hooks/useInventoryFeatureAccess";
import { usePoWorkflowMode } from "@/6-0-stock-management/hooks/useCatalogInventoryWorkflowModes";
import {
  useCancelPurchaseOrder,
  useFulfillPurchaseOrder,
  useResubmitPurchaseOrder,
} from "../hooks/usePurchaseOrderMutations";
import { usePurchaseOrderDetailQuery } from "../hooks/usePurchaseOrderDetailQuery";
import { mapCatalogPoRpcError } from "../finance/mapCatalogPoRpcError";
import { PurchaseOrderFinanceBadge } from "../finance/PurchaseOrderFinanceBadge";
import { usePurchaseOrderFinance } from "../finance/usePurchaseOrderFinance";
import type { PurchaseOrderKindFilter } from "../types";
import { PurchaseOrderStatusBadge } from "./PurchaseOrderStatusBadge";
import { PoHistoryLog } from "./PoHistoryLog";
import { PurchaseOrderPrintView } from "./PurchaseOrderPrintView";
import { CreatePurchaseOrderDialog } from "./CreatePurchaseOrderDialog";

export function PurchaseOrderDetailPanel(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  purchaseOrderId: string | null;
  kind: PurchaseOrderKindFilter;
}) {
  const { t } = useAppTranslation();
  const [editOpen, setEditOpen] = useState(false);

  const { poMode } = usePoWorkflowMode();
  const fulfillAccess = useInventoryFeatureAccessCheck(poMode === "advanced" ? "po_fulfillment" : null);

  const detailQuery = usePurchaseOrderDetailQuery({
    organizationId: props.organizationId,
    purchaseOrderId: props.purchaseOrderId,
    outletId: "",
  });

  const fulfillMutation = useFulfillPurchaseOrder();
  const cancelMutation = useCancelPurchaseOrder();
  const resubmitMutation = useResubmitPurchaseOrder();

  const detail = detailQuery.data;
  const isWaiting = detail?.status === "waiting";
  const finance = usePurchaseOrderFinance({
    poStatus: detail?.status,
    linkedRequest: detail?.finance,
  });
  const busy =
    fulfillMutation.isPending ||
    cancelMutation.isPending ||
    resubmitMutation.isPending ||
    detailQuery.isLoading;

  const handlePrint = () => {
    window.print();
  };

  const canFulfillAction =
    finance.canFulfill && (poMode !== "advanced" || fulfillAccess.data === true);

  const handleFulfill = async () => {
    if (!detail || !canFulfillAction) return;
    try {
      await fulfillMutation.mutateAsync({
        organizationId: props.organizationId,
        purchaseOrderId: detail.id,
      });
      toast.success(t("operations.inventory.purchaseOrders.fulfilled", "Purchase order marked as fulfilled."));
    } catch (err) {
      toast.error(mapCatalogPoRpcError(err, t("common.error", "Something went wrong.")));
    }
  };

  const handleCancel = async () => {
    if (!detail || !finance.canCancel) return;
    try {
      await cancelMutation.mutateAsync({
        organizationId: props.organizationId,
        purchaseOrderId: detail.id,
      });
      toast.success(t("operations.inventory.purchaseOrders.cancelled", "Purchase order cancelled."));
    } catch (err) {
      toast.error(mapCatalogPoRpcError(err, t("common.error", "Something went wrong.")));
    }
  };

  const handleResubmit = async () => {
    if (!detail || !finance.canResubmit) return;
    try {
      await resubmitMutation.mutateAsync({
        organizationId: props.organizationId,
        purchaseOrderId: detail.id,
      });
      toast.success(
        t("operations.inventory.purchaseOrders.resubmitted", "Purchase order resubmitted to Approvals."),
      );
    } catch (err) {
      toast.error(mapCatalogPoRpcError(err, t("common.error", "Something went wrong.")));
    }
  };

  const editLines =
    detail?.lines.map((line) => ({
      productId: line.productId ?? undefined,
      variantId: line.variantId,
      ingredientId: line.ingredientId ?? undefined,
      nameSnapshot: line.name,
      qty: line.qty,
      unitCost: line.unitCost,
      inStock: line.inStock,
    })) ?? [];

  return (
    <>
      <Sheet open={props.open} onOpenChange={props.onOpenChange}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 p-0 print:hidden sm:max-w-xl"
          aria-describedby={undefined}
        >
          <SheetHeader className="shrink-0 border-b px-6 py-4 pr-12 text-left">
            <div className="flex items-start justify-between gap-3">
              <SheetTitle>{t("operations.inventory.purchaseOrders.detailTitle", "Purchase Order Detail")}</SheetTitle>
              {detail ? (
                <div className="flex flex-wrap items-center gap-2">
                  <PurchaseOrderStatusBadge status={detail.status} />
                  <PurchaseOrderFinanceBadge status={finance.financeStatus} />
                </div>
              ) : null}
            </div>
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            {detailQuery.isLoading ? (
              <div className="py-8 text-sm text-muted-foreground">{t("common.loading", "Loading…")}</div>
            ) : !detail ? (
              <div className="py-8 text-sm text-muted-foreground">
                {t("operations.inventory.purchaseOrders.notFound", "Purchase order not found.")}
              </div>
            ) : (
              <div className="space-y-5">
                {detail.supplier ? (
                  <div className="space-y-1 text-sm">
                    <DetailRow label={t("operations.inventory.purchaseOrders.supplierName", "Supplier Name")} value={detail.supplier.name} />
                    <DetailRow label={t("operations.inventory.purchaseOrders.telephone", "Telephone")} value={detail.supplier.phone} />
                    <DetailRow label={t("operations.inventory.purchaseOrders.email", "Email")} value={detail.supplier.email} />
                    <DetailRow label={t("operations.inventory.purchaseOrders.address", "Address")} value={detail.supplier.address} />
                    <DetailRow label={t("operations.inventory.purchaseOrders.city", "City")} value={detail.supplier.city} />
                    <DetailRow label={t("operations.inventory.purchaseOrders.state", "State")} value={detail.supplier.state} />
                    <DetailRow label={t("operations.inventory.purchaseOrders.zip", "Zip")} value={detail.supplier.zip} />
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    {t("operations.inventory.purchaseOrders.noSupplier", "No Supplier (Default)")}
                  </div>
                )}

                <div className="space-y-1 border-t pt-4 text-sm">
                  <DetailRow label={t("operations.inventory.purchaseOrders.outletName", "Outlet Name")} value={detail.outletName} />
                  <DetailRow label={t("operations.inventory.purchaseOrders.poNumber", "PO Number")} value={detail.orderNumber} />
                  <div className="grid grid-cols-[120px_1fr] gap-2 pt-2">
                    <div className="text-muted-foreground">{t("operations.inventory.purchaseOrders.note", "Note")}</div>
                    <Textarea value={detail.note ?? ""} readOnly rows={3} className="min-h-[72px]" />
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">
                    {t("operations.inventory.purchaseOrders.lineItems", "Purchase Order")}
                  </h3>
                  <div className="overflow-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("operations.inventory.purchaseOrders.colName", "Name")}</TableHead>
                          <TableHead className="text-right">{t("operations.inventory.purchaseOrders.inStock", "In Stock")}</TableHead>
                          <TableHead className="text-right">{t("operations.inventory.purchaseOrders.qty", "Qty")}</TableHead>
                          <TableHead className="text-right">{t("operations.inventory.purchaseOrders.unitCost", "Unit Cost")}</TableHead>
                          <TableHead className="text-right">{t("operations.inventory.purchaseOrders.subtotal", "Subtotal Cost")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detail.lines.map((line) => (
                          <TableRow key={line.id}>
                            <TableCell>{line.name}</TableCell>
                            <TableCell className="text-right tabular-nums">{line.inStock}</TableCell>
                            <TableCell className="text-right tabular-nums">{line.qty}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatToRupiah(line.unitCost)}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatToRupiah(line.subtotal)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow>
                          <TableCell colSpan={4} className="font-semibold">
                            {t("operations.inventory.purchaseOrders.total", "Total")}
                          </TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">
                            {formatToRupiah(detail.totalValue)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <PoHistoryLog events={detail.events} />
              </div>
            )}
          </div>

          <SheetFooter className="shrink-0 border-t bg-muted/30 px-4 py-3 sm:justify-between">
            <Button type="button" variant="outline" onClick={handlePrint} disabled={!detail}>
              <Printer className="mr-2 h-4 w-4" />
              {t("operations.inventory.purchaseOrders.print", "Print")}
            </Button>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => props.onOpenChange(false)}>
                {t("common.close", "Close")}
              </Button>
              {isWaiting ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="secondary">
                      {t("operations.inventory.purchaseOrders.more", "More")}
                      <ChevronDown className="ml-1 h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleCancel} disabled={!finance.canCancel}>
                      {t("operations.inventory.purchaseOrders.cancelPo", "Cancel PO")}
                    </DropdownMenuItem>
                    {finance.canEdit ? (
                      <DropdownMenuItem onClick={() => setEditOpen(true)}>
                        {t("operations.inventory.purchaseOrders.editPo", "Edit")}
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
              {finance.canResubmit ? (
                <Button type="button" variant="outline" onClick={handleResubmit} disabled={busy}>
                  {t("operations.inventory.purchaseOrders.resubmit", "Resubmit to Approvals")}
                </Button>
              ) : null}
              {isWaiting ? (
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex">
                        <Button type="button" onClick={handleFulfill} disabled={busy || !canFulfillAction}>
                          {t("operations.inventory.purchaseOrders.markAsFulfilled", "Mark as Fulfilled")}
                        </Button>
                      </span>
                    </TooltipTrigger>
                    {!canFulfillAction ? (
                      <TooltipContent>
                        {poMode === "advanced" && fulfillAccess.data === false
                          ? t(
                              "operations.inventory.purchaseOrders.fulfillRoleLocked",
                              "You do not have PO Fulfillment access.",
                            )
                          : t(
                              "operations.inventory.purchaseOrders.fulfillLocked",
                              "Available after this PO is approved and paid.",
                            )}
                      </TooltipContent>
                    ) : null}
                  </Tooltip>
                </TooltipProvider>
              ) : null}
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {detail ? <PurchaseOrderPrintView detail={detail} /> : null}

      {detail && isWaiting && finance.canEdit ? (
        <CreatePurchaseOrderDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          organizationId={props.organizationId}
          defaultOutletId={detail.outletId}
          kind={props.kind}
          editPurchaseOrderId={detail.id}
          initialOutletId={detail.outletId}
          initialSupplierId={detail.supplierId}
          initialNote={detail.note ?? ""}
          initialLines={editLines}
        />
      ) : null}
    </>
  );
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-2">
      <div className="text-muted-foreground">{label}</div>
      <div>{value?.trim() ? value : "—"}</div>
    </div>
  );
}

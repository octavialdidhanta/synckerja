import { useMemo, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/shared/components/ui/sheet";
import { Button } from "@/shared/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { Textarea } from "@/shared/components/ui/textarea";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useInventoryFeatureAccessCheck } from "@/8-2-5-inventory-settings/hooks/useInventoryFeatureAccess";
import { useTransferWorkflowMode } from "@/6-0-stock-management/hooks/useCatalogInventoryWorkflowModes";
import { useStockTransferDetailQuery } from "../hooks/useStockTransferDetailQuery";
import {
  useApproveStockTransfer,
  useCancelStockTransfer,
  useFulfillStockTransfer,
  useShipStockTransfer,
} from "../hooks/useTransferWorkflowActions";
import { mapCatalogTransferRpcError } from "../lib/transferHelpers";
import { TransferHistoryLog } from "./TransferHistoryLog";
import { TransferStatusBadge } from "./TransferStatusBadge";

export function TransferDetailPanel(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  transferId: string | null;
}) {
  const { t } = useAppTranslation();
  const { transferMode } = useTransferWorkflowMode();
  const detailQuery = useStockTransferDetailQuery({
    organizationId: props.organizationId,
    transferId: props.open ? props.transferId : null,
  });
  const detail = detailQuery.data;

  const approveAccess = useInventoryFeatureAccessCheck(
    transferMode === "advanced" ? "transfer_approval" : null,
  );
  const requestAccess = useInventoryFeatureAccessCheck(
    transferMode === "advanced" ? "transfer_request" : null,
  );
  const shipAccess = useInventoryFeatureAccessCheck(
    transferMode === "advanced" ? "transfer_shipment" : null,
  );
  const fulfillAccess = useInventoryFeatureAccessCheck(
    transferMode === "advanced" ? "transfer_fulfillment" : null,
  );

  const approveMutation = useApproveStockTransfer();
  const shipMutation = useShipStockTransfer();
  const fulfillMutation = useFulfillStockTransfer();
  const cancelMutation = useCancelStockTransfer();

  const busy =
    detailQuery.isLoading ||
    approveMutation.isPending ||
    shipMutation.isPending ||
    fulfillMutation.isPending ||
    cancelMutation.isPending;

  const actions = useMemo(() => {
    if (!detail || transferMode !== "advanced") return null;
    return {
      canApprove: detail.status === "pending_approval" && approveAccess.data === true,
      canShip: detail.status === "approved" && shipAccess.data === true,
      canFulfill: detail.status === "shipped" && fulfillAccess.data === true,
      canCancel:
        (detail.status === "pending_approval" || detail.status === "approved") &&
        (requestAccess.data === true || approveAccess.data === true),
    };
  }, [approveAccess.data, detail, fulfillAccess.data, requestAccess.data, shipAccess.data, transferMode]);

  const runAction = async (
    fn: () => Promise<unknown>,
    successMessage: string,
  ) => {
    try {
      await fn();
      toast.success(successMessage);
    } catch (error) {
      toast.error(mapCatalogTransferRpcError(error, t("common.error", "Something went wrong.")));
    }
  };

  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-xl"
        aria-describedby={undefined}
      >
        <SheetHeader className="shrink-0 border-b px-6 py-4 pr-12 text-left">
          <div className="flex items-start justify-between gap-3">
            <SheetTitle>{t("operations.inventory.transfer.detailTitle", "Transfer Detail")}</SheetTitle>
            {detail ? <TransferStatusBadge status={detail.status} /> : null}
          </div>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {detailQuery.isLoading ? (
            <div className="py-8 text-sm text-muted-foreground">{t("common.loading", "Loading…")}</div>
          ) : !detail ? (
            <div className="py-8 text-sm text-muted-foreground">
              {t("operations.inventory.transfer.notFound", "Transfer not found.")}
            </div>
          ) : (
            <div className="space-y-5">
              <div className="space-y-1 text-sm">
                <DetailRow label={t("operations.inventory.transfer.colFrom", "From")} value={detail.fromOutletName} />
                <DetailRow label={t("operations.inventory.transfer.colTo", "To")} value={detail.toOutletName} />
                <DetailRow
                  label={t("operations.inventory.transfer.colOrderNumber", "Order Number")}
                  value={detail.orderNumber}
                />
                <DetailRow
                  label={t("operations.inventory.transfer.colTime", "Time")}
                  value={format(new Date(detail.occurredAt), "dd MMM yyyy HH:mm")}
                />
                <div className="grid grid-cols-[120px_1fr] gap-2 pt-2">
                  <div className="text-muted-foreground">{t("operations.inventory.transfer.note", "Note")}</div>
                  <Textarea value={detail.note ?? ""} readOnly rows={3} className="min-h-[72px]" />
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold">
                  {t("operations.inventory.transfer.lineItems", "Transfer items")}
                </h3>
                <div className="overflow-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("operations.inventory.transfer.colName", "Name")}</TableHead>
                        <TableHead>{t("operations.inventory.transfer.colUnit", "Unit")}</TableHead>
                        <TableHead className="text-right">
                          {t("operations.inventory.transfer.transferQty", "Qty")}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.lines.map((line) => (
                        <TableRow key={line.id}>
                          <TableCell>{line.name}</TableCell>
                          <TableCell className="text-muted-foreground">{line.unit?.trim() || "—"}</TableCell>
                          <TableCell className="text-right tabular-nums">{line.qty}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <TransferHistoryLog events={detail.events} movements={detail.movements} />
            </div>
          )}
        </div>

        {actions ? (
          <SheetFooter className="shrink-0 border-t px-6 py-4 sm:justify-end">
            <div className="flex flex-wrap justify-end gap-2">
              {actions.canCancel ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    void runAction(
                      () =>
                        cancelMutation.mutateAsync({
                          organizationId: props.organizationId,
                          transferId: detail!.id,
                        }),
                      t("operations.inventory.transfer.cancelled", "Transfer cancelled."),
                    )
                  }
                >
                  {t("operations.inventory.transfer.cancel", "Cancel")}
                </Button>
              ) : null}
              {actions.canApprove ? (
                <Button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void runAction(
                      () =>
                        approveMutation.mutateAsync({
                          organizationId: props.organizationId,
                          transferId: detail!.id,
                        }),
                      t("operations.inventory.transfer.approved", "Transfer approved."),
                    )
                  }
                >
                  {t("operations.inventory.transfer.approve", "Approve")}
                </Button>
              ) : null}
              {actions.canShip ? (
                <Button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void runAction(
                      () =>
                        shipMutation.mutateAsync({
                          organizationId: props.organizationId,
                          transferId: detail!.id,
                        }),
                      t("operations.inventory.transfer.shipped", "Transfer shipped."),
                    )
                  }
                >
                  {t("operations.inventory.transfer.ship", "Ship")}
                </Button>
              ) : null}
              {actions.canFulfill ? (
                <Button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void runAction(
                      () =>
                        fulfillMutation.mutateAsync({
                          organizationId: props.organizationId,
                          transferId: detail!.id,
                        }),
                      t("operations.inventory.transfer.fulfilled", "Transfer fulfilled."),
                    )
                  }
                >
                  {t("operations.inventory.transfer.fulfill", "Fulfill")}
                </Button>
              ) : null}
            </div>
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
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

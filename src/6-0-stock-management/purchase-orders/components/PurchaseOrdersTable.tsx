import { Fragment } from "react";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { formatToRupiah } from "@/shared/utils/formatCurrency";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { groupPurchaseOrdersByDate } from "../lib/poListGrouping";
import { derivePoFinanceStatus } from "../finance/poFinanceStatus";
import { PurchaseOrderFinanceBadge } from "../finance/PurchaseOrderFinanceBadge";
import type { PurchaseOrderListRow } from "../types";
import { PurchaseOrderStatusBadge } from "./PurchaseOrderStatusBadge";

export function PurchaseOrdersTable(props: {
  rows: PurchaseOrderListRow[];
  onRowClick: (row: PurchaseOrderListRow) => void;
}) {
  const { t } = useAppTranslation();
  const groups = groupPurchaseOrdersByDate(props.rows);

  if (props.rows.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center py-16 text-sm text-muted-foreground">
        {t("operations.inventory.purchaseOrders.empty", "No Data To Display")}
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("operations.inventory.purchaseOrders.colDate", "PO Date")}</TableHead>
            <TableHead>{t("operations.inventory.purchaseOrders.colOutlet", "Outlet")}</TableHead>
            <TableHead>{t("operations.inventory.purchaseOrders.colSupplier", "Supplier")}</TableHead>
            <TableHead>{t("operations.inventory.purchaseOrders.colOrderNumber", "Order Number")}</TableHead>
            <TableHead className="text-right">
              {t("operations.inventory.purchaseOrders.colTotal", "Total Value")}
            </TableHead>
            <TableHead>{t("operations.inventory.purchaseOrders.colStatus", "Status")}</TableHead>
            <TableHead>{t("operations.inventory.purchaseOrders.colFinance", "Finance")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map((group) => (
            <Fragment key={group.dateKey}>
              <TableRow key={group.dateKey} className="bg-muted/60 hover:bg-muted/60">
                <TableCell colSpan={7} className="py-2 text-xs font-semibold text-foreground">
                  {group.label}
                </TableCell>
              </TableRow>
              {group.rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer hover:bg-muted/40"
                  onClick={() => props.onRowClick(row)}
                >
                  <TableCell className="tabular-nums">{format(new Date(row.occurredAt), "HH:mm")}</TableCell>
                  <TableCell>{row.outletName}</TableCell>
                  <TableCell>{row.supplierName}</TableCell>
                  <TableCell className="font-medium text-primary">{row.orderNumber}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatToRupiah(row.totalValue)}</TableCell>
                  <TableCell>
                    <PurchaseOrderStatusBadge status={row.status} />
                  </TableCell>
                  <TableCell>
                    <PurchaseOrderFinanceBadge status={derivePoFinanceStatus(row.finance)} />
                  </TableCell>
                </TableRow>
              ))}
            </Fragment>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

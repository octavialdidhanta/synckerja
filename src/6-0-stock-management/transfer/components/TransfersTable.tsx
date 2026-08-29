import { Fragment } from "react";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { TransferStatusBadge } from "./TransferStatusBadge";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { groupTransfersByDate } from "../lib/transferHelpers";
import type { StockTransferListRow } from "../types";

export function TransfersTable(props: {
  rows: StockTransferListRow[];
  onRowClick: (row: StockTransferListRow) => void;
}) {
  const { t } = useAppTranslation();
  const groups = groupTransfersByDate(props.rows);

  if (props.rows.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center py-16 text-sm text-muted-foreground">
        {t("operations.inventory.transfer.empty", "No Data To Display")}
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("operations.inventory.transfer.colTime", "Time")}</TableHead>
            <TableHead>{t("operations.inventory.transfer.colFrom", "From")}</TableHead>
            <TableHead>{t("operations.inventory.transfer.colTo", "To")}</TableHead>
            <TableHead>{t("operations.inventory.transfer.colOrderNumber", "Order Number")}</TableHead>
            <TableHead className="text-right">{t("operations.inventory.transfer.colLines", "Lines")}</TableHead>
            <TableHead className="text-right">{t("operations.inventory.transfer.colQty", "Qty")}</TableHead>
            <TableHead>{t("operations.inventory.transfer.colStatus", "Status")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map((group) => (
            <Fragment key={group.dateKey}>
              <TableRow className="bg-muted/60 hover:bg-muted/60">
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
                  <TableCell>{row.fromOutletName}</TableCell>
                  <TableCell>{row.toOutletName}</TableCell>
                  <TableCell className="font-medium text-primary">{row.orderNumber}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.lineCount}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.totalQty}</TableCell>
                  <TableCell>
                    <TransferStatusBadge status={row.status} />
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

import { format, parseISO } from "date-fns";
import { Button } from "@/shared/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/shared/components/ui/sheet";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { formatReportsMoney } from "../../../shared/lib/formatReportsMoney";
import {
  cartLinePayableTotal,
  computeCartSnapshotTotal,
  parseCartSnapshot,
} from "../lib/computeCartSnapshotTotal";
import type { CancelledOrderRow } from "../lib/transactionsTypes";

type Props = {
  row: CancelledOrderRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function formatTime(iso: string): string {
  try {
    return format(parseISO(iso), "dd MMM yyyy HH:mm");
  } catch {
    return iso;
  }
}

export function CancelledBillDetailDialog({ row, open, onOpenChange }: Props) {
  const { t } = useAppTranslation();
  const lines = row ? parseCartSnapshot(row.cartSnapshot) : [];
  const estimatedTotal = row ? computeCartSnapshotTotal(row.cartSnapshot) : 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-full w-full flex-col gap-0 p-0 sm:max-w-md"
      >
        <SheetHeader className="shrink-0 border-b px-4 py-3 pr-12 text-left">
          <SheetTitle className="text-base">
            {t("reports.transactions.cancelled.detailTitle", "Cancelled Bill")}
          </SheetTitle>
        </SheetHeader>
        <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden px-4 py-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {row ? (
            <div className="space-y-4 text-sm">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                <dt className="text-muted-foreground">
                  {t("reports.transactions.columns.outlet", "Outlet")}
                </dt>
                <dd>{row.outletName}</dd>
                <dt className="text-muted-foreground">
                  {t("reports.transactions.columns.time", "Time")}
                </dt>
                <dd>{formatTime(row.closedAt)}</dd>
                <dt className="text-muted-foreground">
                  {t("reports.transactions.columns.table", "Table")}
                </dt>
                <dd>{row.tableName}</dd>
                <dt className="text-muted-foreground">
                  {t("reports.transactions.columns.staff", "Staff")}
                </dt>
                <dd>{row.staffName}</dd>
                <dt className="text-muted-foreground">
                  {t("reports.transactions.columns.reason", "Reason")}
                </dt>
                <dd>{row.cancelReason}</dd>
                <dt className="text-muted-foreground">
                  {t("reports.transactions.cancelled.estTotal", "Est. Total")}
                </dt>
                <dd className="font-medium tabular-nums">{formatReportsMoney(estimatedTotal)}</dd>
              </dl>
              {lines.length > 0 ? (
                <div>
                  <p className="mb-2 font-medium text-gray-900">
                    {t("reports.transactions.cancelled.items", "Items")}
                  </p>
                  <ul className="divide-y rounded-md border border-border">
                    {lines.map((line, index) => (
                      <li key={line.id ?? index} className="flex justify-between gap-2 px-3 py-2">
                        <span>
                          {line.serviceName}
                          {line.quantity > 1 ? ` × ${line.quantity}` : ""}
                        </span>
                        <span className="tabular-nums text-muted-foreground">
                          {formatReportsMoney(cartLinePayableTotal(line))}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        <SheetFooter className="shrink-0 border-t px-4 py-3 sm:justify-end">
          <Button type="button" onClick={() => onOpenChange(false)}>
            {t("common.done", "Done")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

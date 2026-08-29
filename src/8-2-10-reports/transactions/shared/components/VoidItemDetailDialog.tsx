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
import type { VoidItemRow } from "../lib/transactionsTypes";

type Props = {
  row: VoidItemRow | null;
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

export function VoidItemDetailDialog({ row, open, onOpenChange }: Props) {
  const { t } = useAppTranslation();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-full w-full flex-col gap-0 p-0 sm:max-w-md"
      >
        <SheetHeader className="shrink-0 border-b px-4 py-3 pr-12 text-left">
          <SheetTitle className="text-base">
            {t("reports.transactions.void.detailTitle", "Void Item")}
          </SheetTitle>
        </SheetHeader>
        <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden px-4 py-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {row ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">
                {t("reports.transactions.columns.outlet", "Outlet")}
              </dt>
              <dd>{row.outletName}</dd>
              <dt className="text-muted-foreground">
                {t("reports.transactions.columns.time", "Time")}
              </dt>
              <dd>{formatTime(row.createdAt)}</dd>
              <dt className="text-muted-foreground">
                {t("reports.transactions.columns.table", "Table")}
              </dt>
              <dd>{row.tableName}</dd>
              <dt className="text-muted-foreground">
                {t("reports.transactions.void.product", "Product")}
              </dt>
              <dd>{row.productName}</dd>
              <dt className="text-muted-foreground">
                {t("reports.transactions.void.qty", "Qty")}
              </dt>
              <dd>{row.quantity}</dd>
              <dt className="text-muted-foreground">
                {t("reports.transactions.void.unitPrice", "Unit Price")}
              </dt>
              <dd className="tabular-nums">{formatReportsMoney(row.unitPrice)}</dd>
              <dt className="text-muted-foreground">
                {t("reports.transactions.void.lineTotal", "Line Total")}
              </dt>
              <dd className="font-medium tabular-nums">{formatReportsMoney(row.lineTotal)}</dd>
              <dt className="text-muted-foreground">
                {t("reports.transactions.columns.staff", "Staff")}
              </dt>
              <dd>{row.voidedByName}</dd>
              <dt className="text-muted-foreground">
                {t("reports.transactions.columns.reason", "Reason")}
              </dt>
              <dd>{row.reason}</dd>
            </dl>
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

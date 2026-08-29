import { format, parseISO } from "date-fns";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { formatReportsMoney } from "../../../shared/lib/formatReportsMoney";
import type { InvoiceRow } from "../lib/invoicesTypes";
import { InvoiceStatusBadge } from "./InvoiceStatusBadge";

type Props = {
  rows: InvoiceRow[];
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  onRowClick: (row: InvoiceRow) => void;
};

function formatDate(iso: string): string {
  try {
    return format(parseISO(iso), "dd MMM yyyy");
  } catch {
    return iso.slice(0, 10);
  }
}

export function InvoicesTable({
  rows,
  hasMore,
  isLoadingMore,
  onLoadMore,
  onRowClick,
}: Props) {
  const { t } = useAppTranslation();

  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border px-6 py-12 text-center">
        <p className="text-sm font-medium text-gray-900">
          {t("reports.invoices.empty.title", "No invoices")}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t(
            "reports.invoices.empty.hint",
            "Credit sales and proposals with line items will appear here.",
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="min-w-0 overflow-hidden rounded-md border border-border">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">{t("reports.invoices.columns.date", "Date")}</th>
              <th className="px-4 py-2 font-medium">
                {t("reports.invoices.columns.invoice", "Invoice #")}
              </th>
              <th className="px-4 py-2 font-medium">
                {t("reports.invoices.columns.outlet", "Outlet")}
              </th>
              <th className="px-4 py-2 font-medium">
                {t("reports.invoices.columns.customer", "Customer")}
              </th>
              <th className="px-4 py-2 font-medium">
                {t("reports.invoices.columns.status", "Status")}
              </th>
              <th className="px-4 py-2 text-right font-medium">
                {t("reports.invoices.columns.amount", "Amount")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={row.activityId}
                className={`cursor-pointer border-b border-border transition-colors hover:bg-muted/30 ${
                  index % 2 === 1 ? "bg-muted/10" : ""
                }`}
                onClick={() => onRowClick(row)}
              >
                <td className="whitespace-nowrap px-4 py-3">{formatDate(row.createdAt)}</td>
                <td className="whitespace-nowrap px-4 py-3 font-medium">{row.invoiceNumber}</td>
                <td className="px-4 py-3">{row.outletName}</td>
                <td className="px-4 py-3">{row.clientName}</td>
                <td className="px-4 py-3">
                  <InvoiceStatusBadge status={row.displayStatus} />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-medium">
                  {formatReportsMoney(row.totalAmount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hasMore ? (
        <div className="border-t px-4 py-3 text-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isLoadingMore}
            onClick={onLoadMore}
          >
            {isLoadingMore
              ? t("common.loading", "Loading…")
              : t("reports.invoices.loadMore", "Load more")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { Button } from "@/shared/components/ui/button";
import type { PosTableReportItem, PosTableReportRow } from "../../hooks/usePosTableReport";
import { usePosTableReportOrderItems } from "../../hooks/usePosTableReport";

type Props = {
  row: PosTableReportRow | null;
  onClose: () => void;
};

function formatDuration(mins: number | null): string {
  if (mins == null) return "—";
  if (mins < 60) return `${mins} Min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function itemLabel(item: PosTableReportItem): string {
  if (item.sub_service_name) return `${item.service_name ?? ""} — ${item.sub_service_name}`;
  return item.service_name || "—";
}

export function TableReportOrderDetail({ row, onClose }: Props) {
  const { t } = useAppTranslation();
  const items = usePosTableReportOrderItems(row?.id ?? null);

  if (!row) return null;

  const cancelled =
    (row.status ?? "").toLowerCase().includes("cancel") ||
    (row.status ?? "").toLowerCase().includes("void");

  return (
    <aside className="flex h-full min-h-0 flex-col rounded-lg border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide">
          {t("tableManagement.report.orderDetails", "Order Details")}
        </h3>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          {t("tableManagement.report.done", "Done")}
        </Button>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3 text-sm">
        <Row
          label={t("tableManagement.report.colStatus", "Status")}
          value={
            cancelled
              ? t("tableManagement.report.statusCancelled", "Cancelled")
              : t("tableManagement.report.statusCompleted", "Completed")
          }
        />
        <Row label={t("tableManagement.report.colReceipt", "Receipt Number")} value={row.receipt_code} />
        <Row
          label={t("tableManagement.report.completedTime", "Completed Time")}
          value={row.created_at.replace("T", " ").slice(0, 16)}
        />
        <Row label={t("tableManagement.report.colTable", "Table")} value={row.table_number || "—"} />
        <Row
          label={t("tableManagement.report.colServedBy", "Served By")}
          value={row.client_name || "—"}
        />
        <Row
          label={t("tableManagement.report.colDuration", "Duration")}
          value={formatDuration(row.table_duration_minutes)}
        />

        <div className="pt-2">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("tableManagement.report.orderedItems", "Ordered Items")}
          </p>
          {items.isLoading ? (
            <p className="text-xs text-muted-foreground">…</p>
          ) : (items.data ?? []).length === 0 ? (
            <p className="rounded border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
              {t("tableManagement.report.noItems", "No Item Found")}
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-1 font-medium">{t("tableManagement.report.colItems", "Items")}</th>
                  <th className="py-1 text-right font-medium">
                    {t("tableManagement.report.colQty", "Quantity")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {(items.data ?? []).map((item) => (
                  <tr key={item.id} className="border-b border-border/50">
                    <td className="py-1.5">{itemLabel(item)}</td>
                    <td className="py-1.5 text-right tabular-nums">{item.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="pt-2">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("tableManagement.report.voidItems", "Void Items")}
          </p>
          <p className="rounded border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
            {t("tableManagement.report.noItems", "No Item Found")}
          </p>
        </div>
      </div>
    </aside>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import type { PosTableReportRow } from "../../hooks/usePosTableReport";

type Props = {
  rows: PosTableReportRow[];
  selectedId: string | null;
  onSelect: (row: PosTableReportRow) => void;
};

function formatDuration(mins: number | null): string {
  if (mins == null) return "—";
  if (mins < 60) return `${mins} Min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function TableReportTransactionTable({ rows, selectedId, onSelect }: Props) {
  const { t } = useAppTranslation();

  if (rows.length === 0) {
    return (
      <div className="flex min-h-[240px] items-center justify-center rounded-lg border border-border bg-card text-sm text-muted-foreground">
        {t("tableManagement.report.empty", "No table transactions in this range.")}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">{t("tableManagement.report.colDate", "Date")}</th>
            <th className="px-3 py-2 font-medium">
              {t("tableManagement.report.colReceipt", "Receipt Number")}
            </th>
            <th className="px-3 py-2 font-medium">
              {t("tableManagement.report.colServedBy", "Served By")}
            </th>
            <th className="px-3 py-2 font-medium">{t("tableManagement.report.colTable", "Table")}</th>
            <th className="px-3 py-2 font-medium">{t("tableManagement.report.colDuration", "Duration")}</th>
            <th className="px-3 py-2 font-medium">{t("tableManagement.report.colStatus", "Status")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const cancelled =
              (row.status ?? "").toLowerCase().includes("cancel") ||
              (row.status ?? "").toLowerCase().includes("void");
            return (
              <tr
                key={row.id}
                className={cn(
                  "cursor-pointer border-b border-border/60 transition-colors hover:bg-muted/30",
                  selectedId === row.id && "bg-primary/5",
                )}
                onClick={() => onSelect(row)}
              >
                <td className="px-3 py-2 whitespace-nowrap">{row.date || row.created_at.slice(0, 10)}</td>
                <td className="px-3 py-2 font-mono text-xs">{row.receipt_code}</td>
                <td className="px-3 py-2">{row.client_name || "—"}</td>
                <td className="px-3 py-2">{row.table_number || "—"}</td>
                <td className="px-3 py-2 tabular-nums">
                  {formatDuration(row.table_duration_minutes)}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={cn(
                      "inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium",
                      cancelled
                        ? "border-red-300 text-red-700"
                        : "border-emerald-300 text-emerald-700",
                    )}
                  >
                    {cancelled
                      ? t("tableManagement.report.statusCancelled", "Cancelled")
                      : t("tableManagement.report.statusCompleted", "Completed")}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

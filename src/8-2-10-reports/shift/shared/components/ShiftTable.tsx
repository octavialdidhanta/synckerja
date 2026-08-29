import { format, parseISO } from "date-fns";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { formatReportsMoney } from "../../../shared/lib/formatReportsMoney";
import { formatShiftDifference, isShiftShortage } from "../lib/formatShiftDifference";
import type { ShiftRow } from "../lib/shiftTypes";

type Props = {
  rows: ShiftRow[];
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  onRowClick: (row: ShiftRow) => void;
};

function formatDateTime(iso: string): string {
  try {
    return format(parseISO(iso), "dd/MM/yyyy HH:mm");
  } catch {
    return iso;
  }
}

export function ShiftTable({
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
          {t("reports.shift.empty.title", "No shifts")}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t(
            "reports.shift.empty.hint",
            "Cashier shifts for the selected outlet and period will appear here.",
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="min-w-0 overflow-hidden rounded-md border border-border">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">
                {t("reports.shift.columns.name", "Name")}
              </th>
              <th className="px-4 py-2 font-medium">
                {t("reports.shift.columns.startTime", "Start Time")}
              </th>
              <th className="px-4 py-2 font-medium">
                {t("reports.shift.columns.endTime", "End Time")}
              </th>
              <th className="px-4 py-2 font-medium">
                {t("reports.shift.columns.access", "Access")}
              </th>
              <th className="px-4 py-2 text-right font-medium">
                {t("reports.shift.columns.totalExpected", "Total Expected")}
              </th>
              <th className="px-4 py-2 text-right font-medium">
                {t("reports.shift.columns.totalActual", "Total Actual")}
              </th>
              <th className="px-4 py-2 text-right font-medium">
                {t("reports.shift.columns.difference", "Difference")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.shiftId}
                className="cursor-pointer border-b border-border last:border-b-0 hover:bg-muted/30"
                onClick={() => onRowClick(row)}
              >
                <td className="max-w-[140px] truncate px-4 py-2.5 font-medium text-gray-900">
                  {row.outletName}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-gray-800">
                  {formatDateTime(row.openedAt)}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-gray-800">
                  {row.closedAt ? formatDateTime(row.closedAt) : "—"}
                </td>
                <td className="max-w-[160px] truncate px-4 py-2.5 text-gray-800">
                  {row.openedByName}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">
                  {formatReportsMoney(row.expectedCash)}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">
                  {row.closingCash != null ? formatReportsMoney(row.closingCash) : "—"}
                </td>
                <td
                  className={cn(
                    "whitespace-nowrap px-4 py-2.5 text-right tabular-nums",
                    isShiftShortage(row.cashDifference) && "font-semibold text-rose-600",
                  )}
                >
                  {formatShiftDifference(row.cashDifference)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hasMore ? (
        <div className="border-t border-border px-4 py-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isLoadingMore}
            onClick={onLoadMore}
          >
            {isLoadingMore
              ? t("reports.shift.loadingMore", "Loading…")
              : t("reports.shift.loadMore", "Load more")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

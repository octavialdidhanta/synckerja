import { RotateCcw } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { formatPosTableDuration } from "@/pos-mobile/5-table-map/lib/formatPosTableDuration";
import { POS_BILL_LIST_I18N } from "../../lib/posBillListCopy";
import type { PosBillListRow } from "../../hooks/usePosBillListSessions";

type Props = {
  rows: PosBillListRow[];
  query: string;
  nowMs: number;
  refundBusyId: string | null;
  onRefund: (row: PosBillListRow) => void;
};

function matchesQuery(row: PosBillListRow, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const hay = [
    row.session.table_name,
    row.session.customer_name ?? "",
    row.groupName,
    row.waiterName,
    row.session.sales_activity_id ?? "",
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(needle);
}

export function PosBillListRefundsPanel({
  rows,
  query,
  nowMs,
  refundBusyId,
  onRefund,
}: Props) {
  const { t } = useAppTranslation();
  const filtered = rows.filter((r) => matchesQuery(r, query));

  if (filtered.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-16">
        <p className="text-center text-sm text-slate-400">
          {t(POS_BILL_LIST_I18N.emptyPaid, "No paid bills available for refund.")}
        </p>
      </div>
    );
  }

  return (
    <div className="scrollbar-hide overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wide text-slate-800">
            <th className="px-3 py-2">{t(POS_BILL_LIST_I18N.colTable, "Table")}</th>
            <th className="px-3 py-2">{t(POS_BILL_LIST_I18N.colCustomer, "Customer")}</th>
            <th className="px-3 py-2">{t(POS_BILL_LIST_I18N.colWaiter, "Waiter")}</th>
            <th className="px-3 py-2">{t(POS_BILL_LIST_I18N.colTime, "Time")}</th>
            <th className="px-3 py-2 text-right">{t(POS_BILL_LIST_I18N.refundStock, "Refund")}</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((row) => {
            const endMs = row.session.closed_at
              ? new Date(row.session.closed_at).getTime()
              : nowMs;
            const duration = formatPosTableDuration(row.session.seated_at, endMs);
            const activityId = row.session.sales_activity_id;
            const busy = refundBusyId === row.session.id;
            return (
              <tr key={row.session.id} className="border-b border-slate-100">
                <td className="px-3 py-2.5 font-medium text-slate-900">
                  {row.session.table_name || "—"}
                </td>
                <td className="px-3 py-2.5 text-slate-700">
                  {row.session.customer_name?.trim() || "—"}
                </td>
                <td className="px-3 py-2.5 text-slate-700">{row.waiterName}</td>
                <td className="px-3 py-2.5 text-slate-700">{duration}</td>
                <td className="px-3 py-2.5 text-right">
                  {row.refundStatus === "full" ? (
                    <span className="inline-flex rounded bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
                      {t(POS_BILL_LIST_I18N.refundedBadge, "Refunded")}
                    </span>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!activityId || busy}
                      className="gap-1.5"
                      onClick={() => onRefund(row)}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      {t(POS_BILL_LIST_I18N.refundStock, "Refund stock")}
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

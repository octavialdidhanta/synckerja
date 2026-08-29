import { CheckCircle2, Ban, Truck } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { formatPosTableDuration } from "@/pos-mobile/5-table-map/lib/formatPosTableDuration";
import { POS_BILL_LIST_I18N } from "../../lib/posBillListCopy";
import type { PosBillListRow } from "../../hooks/usePosBillListSessions";
import { cn } from "@/shared/lib/utils";

type Props = {
  rows: PosBillListRow[];
  query: string;
  nowMs: number;
  emptyKey: string;
  emptyFallback: string;
  showReason?: boolean;
  onSelect?: (row: PosBillListRow) => void;
  onCancelBill?: (row: PosBillListRow) => void;
  onFulfillBill?: (row: PosBillListRow) => void;
};

function matchesQuery(row: PosBillListRow, q: string, includeReason?: boolean): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const hay = [
    row.session.table_name,
    row.groupName,
    row.waiterName,
    includeReason ? row.session.cancel_reason ?? "" : "",
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(needle);
}

export function PosBillListSessionTable({
  rows,
  query,
  nowMs,
  emptyKey,
  emptyFallback,
  showReason,
  onSelect,
  onCancelBill,
  onFulfillBill,
}: Props) {
  const { t } = useAppTranslation();
  const filtered = rows.filter((r) => matchesQuery(r, query, showReason));

  if (filtered.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-16">
        <p className="text-center text-sm text-slate-400">
          {t(emptyKey, emptyFallback)}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wide text-slate-800">
            <th className="px-3 py-2">{t(POS_BILL_LIST_I18N.colTable, "Table")}</th>
            <th className="px-3 py-2">{t(POS_BILL_LIST_I18N.colGroup, "Table group")}</th>
            <th className="px-3 py-2">{t(POS_BILL_LIST_I18N.colWaiter, "Waiter")}</th>
            <th className="px-3 py-2">{t(POS_BILL_LIST_I18N.colTime, "Time")}</th>
            {showReason ? (
              <th className="px-3 py-2">{t(POS_BILL_LIST_I18N.colReason, "Reason")}</th>
            ) : null}
            <th className="px-3 py-2 text-center">{t(POS_BILL_LIST_I18N.colSync, "Sync")}</th>
            {onCancelBill || onFulfillBill ? <th className="px-3 py-2" /> : null}
          </tr>
        </thead>
        <tbody>
          {filtered.map((row) => {
            const endMs = row.session.closed_at
              ? new Date(row.session.closed_at).getTime()
              : nowMs;
            const duration = formatPosTableDuration(row.session.seated_at, endMs);
            return (
              <tr
                key={row.session.id}
                className={cn(
                  "border-b border-slate-100",
                  onSelect && "cursor-pointer hover:bg-slate-50",
                )}
                onClick={() => onSelect?.(row)}
              >
                <td className="px-3 py-2.5 font-medium text-slate-900">
                  {row.session.table_name || "—"}
                </td>
                <td className="px-3 py-2.5 text-slate-700">{row.groupName}</td>
                <td className="px-3 py-2.5 text-slate-700">{row.waiterName}</td>
                <td className="px-3 py-2.5 text-slate-700">{duration}</td>
                {showReason ? (
                  <td className="max-w-[180px] truncate px-3 py-2.5 text-slate-600">
                    {row.session.cancel_reason?.trim() || "—"}
                  </td>
                ) : null}
                <td className="px-3 py-2.5 text-center">
                  <CheckCircle2
                    className="mx-auto h-5 w-5 text-emerald-500"
                    aria-label={t(POS_BILL_LIST_I18N.synced, "Synced")}
                  />
                </td>
                {onCancelBill || onFulfillBill ? (
                  <td className="px-2 py-2.5 text-right">
                    <div className="inline-flex items-center gap-1">
                      {onFulfillBill ? (
                        <button
                          type="button"
                          className="inline-flex rounded-md p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"
                          aria-label={t(POS_BILL_LIST_I18N.fulfillBill, "Mark shipped")}
                          onClick={(e) => {
                            e.stopPropagation();
                            onFulfillBill(row);
                          }}
                        >
                          <Truck className="h-4 w-4" />
                        </button>
                      ) : null}
                      {onCancelBill ? (
                        <button
                          type="button"
                          className="inline-flex rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          aria-label={t(POS_BILL_LIST_I18N.cancelBill, "Cancel bill")}
                          onClick={(e) => {
                            e.stopPropagation();
                            onCancelBill(row);
                          }}
                        >
                          <Ban className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

import { ChevronRight } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { formatPosCash } from "../lib/formatPosCash";
import { formatPosShiftDateTime } from "../lib/formatPosShiftDateTime";
import { POS_SHIFT_I18N } from "../lib/posShiftCopy";
import { POS_SHIFT_PANEL } from "../lib/posShiftPanelChrome";
import type { PosCashierShift } from "../lib/posShiftTypes";

type Props = {
  rows: PosCashierShift[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  onSelectShift: (shift: PosCashierShift) => void;
};

export function PosShiftHistoryPanel({
  rows,
  isLoading,
  isError,
  onRetry,
  onSelectShift,
}: Props) {
  const { t, language } = useAppTranslation();
  const lang = String(language ?? "id");

  if (isLoading && rows.length === 0) {
    return (
      <div className={POS_SHIFT_PANEL.body} aria-busy>
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={cn(POS_SHIFT_PANEL.card, "space-y-2 px-3 py-3")}>
              <div className="h-4 w-[85%] animate-pulse rounded bg-slate-100" />
              <div className="h-4 w-[70%] animate-pulse rounded bg-slate-100" />
              <div className="h-3 w-full animate-pulse rounded bg-slate-50" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError && rows.length === 0) {
    return (
      <div className={cn(POS_SHIFT_PANEL.body, "py-10 text-center")}>
        <p className="mb-3 text-sm text-slate-500">
          {t(POS_SHIFT_I18N.historyEmpty, "No shift history yet.")}
        </p>
        {onRetry ? (
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            Retry
          </Button>
        ) : null}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <p className={cn(POS_SHIFT_PANEL.body, "py-10 text-center text-sm text-slate-500")}>
        {t(POS_SHIFT_I18N.historyEmpty, "No shift history yet.")}
      </p>
    );
  }

  return (
    <div className={cn(POS_SHIFT_PANEL.page, "bg-transparent")}>
      <div className={POS_SHIFT_PANEL.body}>
        <div className="space-y-2">
          {rows.map((row) => {
            const opened = formatPosShiftDateTime(row.opened_at, lang, {
              includeWeekday: false,
            });
            const closed = row.closed_at
              ? formatPosShiftDateTime(row.closed_at, lang, { includeWeekday: false })
              : "—";
            const expected = Math.round(row.expected_cash ?? 0);
            const counted = Math.round(row.closing_cash ?? row.expected_cash ?? 0);
            const countedShort = counted < expected;
            return (
              <button
                key={row.id}
                type="button"
                onClick={() => onSelectShift(row)}
                className={cn(
                  POS_SHIFT_PANEL.card,
                  "flex w-full items-start gap-2 px-3 py-3 text-left transition hover:bg-slate-50/80",
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">
                    {t(POS_SHIFT_I18N.historyOpened, "Shift Started")}: {opened}
                  </p>
                  <p className="mt-0.5 text-sm text-slate-700">
                    {t(POS_SHIFT_I18N.historyClosed, "Shift Ended")}: {closed}
                  </p>
                  <div className="mt-2 grid grid-cols-1 gap-x-3 gap-y-1 text-sm text-slate-700 sm:grid-cols-3">
                    <span className="min-w-0 truncate">
                      {t(POS_SHIFT_I18N.historyOpening, "Opening")}:{" "}
                      <span className="font-medium tabular-nums text-slate-900">
                        {formatPosCash(row.opening_cash)}
                      </span>
                    </span>
                    <span className="min-w-0 truncate">
                      {t(POS_SHIFT_I18N.historyExpected, "Expected")}:{" "}
                      <span className="font-medium tabular-nums text-slate-900">
                        {formatPosCash(expected)}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "min-w-0 truncate",
                        countedShort && "font-semibold text-rose-600",
                      )}
                    >
                      {t(POS_SHIFT_I18N.historyClosing, "Counted")}:{" "}
                      <span className="tabular-nums">{formatPosCash(counted)}</span>
                    </span>
                  </div>
                </div>
                <ChevronRight
                  className="mt-0.5 h-5 w-5 flex-shrink-0 text-slate-400"
                  aria-hidden
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

import { ChevronRight } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { formatPosCash } from "../lib/formatPosCash";
import { formatPosShiftDateTime } from "../lib/formatPosShiftDateTime";
import { POS_SHIFT_I18N } from "../lib/posShiftCopy";
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
      <div className="space-y-3 p-4" aria-busy>
        <div className="h-16 animate-pulse rounded-md bg-slate-100" />
        <div className="h-16 animate-pulse rounded-md bg-slate-100" />
      </div>
    );
  }

  if (isError && rows.length === 0) {
    return (
      <div className="px-4 py-10 text-center">
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
      <p className="px-4 py-10 text-center text-sm text-slate-500">
        {t(POS_SHIFT_I18N.historyEmpty, "No shift history yet.")}
      </p>
    );
  }

  return (
    <div className="space-y-2 px-4 py-4 pb-8">
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
            className="w-full rounded-md border border-slate-200 bg-white px-4 py-3 text-left hover:bg-slate-50"
          >
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-2">
                  <p className="text-sm font-medium text-slate-900">
                    {t(POS_SHIFT_I18N.historyOpened, "Shift Started")}: {opened}
                  </p>
                  <p className="text-sm font-medium text-slate-700 sm:text-right">
                    {t(POS_SHIFT_I18N.historyClosed, "Shift Ended")}: {closed}
                  </p>
                </div>
                <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-700">
                  <span>
                    {t(POS_SHIFT_I18N.historyOpening, "Opening")}:{" "}
                    {formatPosCash(row.opening_cash)}
                  </span>
                  <span>
                    {t(POS_SHIFT_I18N.historyExpected, "Expected")}:{" "}
                    {formatPosCash(expected)}
                  </span>
                  <span
                    className={cn(countedShort && "font-semibold text-rose-600")}
                  >
                    {t(POS_SHIFT_I18N.historyClosing, "Counted")}:{" "}
                    {formatPosCash(counted)}
                  </span>
                </div>
              </div>
              <ChevronRight
                className="mt-1 h-5 w-5 flex-shrink-0 text-slate-400"
                aria-hidden
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}

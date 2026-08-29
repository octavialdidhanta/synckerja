import { useMemo } from "react";
import { ArrowLeft } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { aggregatePosShiftProductsSold } from "../lib/aggregatePosShiftProductsSold";
import { POS_SHIFT_I18N } from "../lib/posShiftCopy";
import { usePosShiftSalesSummary } from "../lib/usePosCashierShift";

type Props = {
  shiftId: string;
  onBack: () => void;
};

/**
 * Products Sold detail — nested right pane from Current Shift (reference: Produk Terjual).
 */
export function PosShiftProductsSoldPanel({ shiftId, onBack }: Props) {
  const { t } = useAppTranslation();
  const salesQuery = usePosShiftSalesSummary(shiftId);

  const { totalQty, rows } = useMemo(
    () => aggregatePosShiftProductsSold(salesQuery.data?.lines ?? []),
    [salesQuery.data?.lines],
  );

  const loading = salesQuery.isLoading && !salesQuery.data;

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex h-12 flex-shrink-0 items-center gap-2 border-b border-slate-200 bg-slate-50 px-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md p-1.5 text-primary hover:bg-slate-100"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="flex-1 pr-8 text-center text-base font-semibold text-slate-900">
          {t(POS_SHIFT_I18N.productsSoldTitle, "Products Sold")}
        </h2>
      </div>

      <div className="flex-1 px-4 py-4 pb-8">
        <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3.5">
            <span className="text-sm text-slate-800">
              {t(POS_SHIFT_I18N.productsSoldTotal, "Total Products")}
            </span>
            <span className="text-sm font-medium tabular-nums text-slate-900">
              {loading ? "…" : String(totalQty)}
            </span>
          </div>

          {loading ? (
            <div className="space-y-0" aria-busy>
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3.5 last:border-b-0"
                >
                  <div className="h-4 min-w-0 flex-1 animate-pulse rounded bg-slate-100" />
                  <div className="h-4 w-8 animate-pulse rounded bg-slate-100" />
                </div>
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-400">
              {t(POS_SHIFT_I18N.productsSoldEmpty, "No products sold in this shift.")}
            </p>
          ) : (
            rows.map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3.5 last:border-b-0"
              >
                <span className="min-w-0 flex-1 truncate text-sm text-slate-800">
                  {row.label}
                </span>
                <span className="flex-shrink-0 text-sm font-medium tabular-nums text-slate-900">
                  {row.quantity}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

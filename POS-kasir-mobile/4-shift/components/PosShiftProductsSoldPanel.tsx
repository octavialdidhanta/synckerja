import { useMemo } from "react";
import { ArrowLeft } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { aggregatePosShiftProductsSold } from "../lib/aggregatePosShiftProductsSold";
import { POS_SHIFT_I18N } from "../lib/posShiftCopy";
import { POS_SHIFT_PANEL } from "../lib/posShiftPanelChrome";
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
    <div className={POS_SHIFT_PANEL.page}>
      <div className={POS_SHIFT_PANEL.header}>
        <button
          type="button"
          onClick={onBack}
          onPointerDown={(e) => e.stopPropagation()}
          className={POS_SHIFT_PANEL.headerBack}
          aria-label={t(POS_SHIFT_I18N.back, "Back")}
          data-no-pane-swipe
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className={POS_SHIFT_PANEL.headerTitle}>
          {t(POS_SHIFT_I18N.productsSoldTitle, "Products Sold")}
        </h2>
      </div>

      <div className={POS_SHIFT_PANEL.body}>
        <div className={POS_SHIFT_PANEL.card}>
          <div className={POS_SHIFT_PANEL.row}>
            <span className={POS_SHIFT_PANEL.rowLabel}>
              {t(POS_SHIFT_I18N.productsSoldTotal, "Total Products")}
            </span>
            <span className={POS_SHIFT_PANEL.rowValue}>
              {loading ? "…" : String(totalQty)}
            </span>
          </div>

          {loading ? (
            <div className="space-y-0" aria-busy>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className={POS_SHIFT_PANEL.row}>
                  <div className="h-4 min-w-0 flex-1 animate-pulse rounded bg-slate-100" />
                  <div className="h-4 w-8 animate-pulse rounded bg-slate-100" />
                </div>
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-slate-400">
              {t(POS_SHIFT_I18N.productsSoldEmpty, "No products sold in this shift.")}
            </p>
          ) : (
            rows.map((row) => (
              <div key={row.label} className={POS_SHIFT_PANEL.row}>
                <span className={cn(POS_SHIFT_PANEL.rowLabel, "truncate pr-2")}>
                  {row.label}
                </span>
                <span className={POS_SHIFT_PANEL.rowValue}>{row.quantity}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

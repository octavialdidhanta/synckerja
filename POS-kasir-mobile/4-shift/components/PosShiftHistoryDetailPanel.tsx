import { ArrowLeft } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useToast } from "@/shared/hooks/use-toast";
import { PosPrinterUnavailableError } from "@/pos-mobile/shared/printing/PosPrinterBridge";
import { printPosShiftReport } from "@/pos-mobile/shared/printing/posPrintService";
import { PosShiftActiveSummary } from "./PosShiftActiveSummary";
import { POS_SHIFT_I18N } from "../lib/posShiftCopy";
import type { PosCashierShift } from "../lib/posShiftTypes";
import {
  buildLiveShiftTotals,
  usePosCashMovements,
  usePosShiftSalesSummary,
} from "../lib/usePosCashierShift";

type Props = {
  shift: PosCashierShift;
  outletId: string;
  outletName: string;
  displayName: string;
  onBack: () => void;
  onOpenCashIo: () => void;
  onOpenProductsSold: () => void;
};

/**
 * Closed-shift detail — same layout as Current Shift (read-only, print allowed).
 */
export function PosShiftHistoryDetailPanel({
  shift,
  outletId,
  outletName,
  displayName,
  onBack,
  onOpenCashIo,
  onOpenProductsSold,
}: Props) {
  const { t, language } = useAppTranslation();
  const { toast } = useToast();
  const movementsQuery = usePosCashMovements(shift.id);
  const salesQuery = usePosShiftSalesSummary(shift.id);

  const totals = buildLiveShiftTotals(
    shift,
    movementsQuery.data ?? [],
    salesQuery.data,
  );

  const loading =
    (movementsQuery.isLoading || salesQuery.isLoading) && !totals;

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
          {t(POS_SHIFT_I18N.historyDetailTitle, "Shift Detail")}
        </h2>
      </div>

      {loading || !totals ? (
        <div className="space-y-3 p-4" aria-busy>
          <div className="h-12 animate-pulse rounded-md bg-slate-100" />
          <div className="h-40 animate-pulse rounded-md bg-slate-100" />
        </div>
      ) : (
        <PosShiftActiveSummary
          variant="history"
          shift={shift}
          totals={totals}
          outletName={outletName}
          displayName={displayName}
          onEnd={() => undefined}
          onPrint={() => {
            void (async () => {
              try {
                await printPosShiftReport({
                  outletId,
                  outletName,
                  displayName,
                  shift,
                  totals,
                  countedCash: shift.closing_cash,
                  language: String(language ?? "id"),
                });
                toast({
                  title: t(POS_SHIFT_I18N.printOk, "Shift report sent to printer."),
                });
              } catch (err) {
                const msg = err instanceof Error ? err.message : "";
                if (
                  msg === "no_shift_printer" ||
                  err instanceof PosPrinterUnavailableError
                ) {
                  toast({
                    title: t(
                      POS_SHIFT_I18N.noPrinter,
                      "No shift printer configured.",
                    ),
                    variant: "destructive",
                  });
                  return;
                }
                toast({
                  title: t(
                    POS_SHIFT_I18N.printFailed,
                    "Failed to print shift report.",
                  ),
                  variant: "destructive",
                });
              }
            })();
          }}
          onOpenCashIo={onOpenCashIo}
          onOpenProductsSold={onOpenProductsSold}
          refundedProductsQty={salesQuery.data?.refundedProductsQty ?? 0}
        />
      )}
    </div>
  );
}

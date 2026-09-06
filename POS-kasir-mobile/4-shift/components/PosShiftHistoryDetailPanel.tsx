import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useToast } from "@/shared/hooks/use-toast";
import { cn } from "@/shared/lib/utils";
import { PosPrinterUnavailableError } from "@/pos-mobile/shared/printing/PosPrinterBridge";
import { printPosShiftReport } from "@/pos-mobile/shared/printing/posPrintService";
import { PosShiftActiveSummary } from "./PosShiftActiveSummary";
import { PosShiftFooterActions } from "./PosShiftFooterActions";
import { POS_SHIFT_I18N } from "../lib/posShiftCopy";
import { POS_SHIFT_PANEL } from "../lib/posShiftPanelChrome";
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
  onFooterCenterChange?: (node: ReactNode | null) => void;
};

/**
 * Closed-shift detail — same layout as Current Shift (read-only, print in footer).
 */
export function PosShiftHistoryDetailPanel({
  shift,
  outletId,
  outletName,
  displayName,
  onBack,
  onOpenCashIo,
  onOpenProductsSold,
  onFooterCenterChange,
}: Props) {
  const { t, language } = useAppTranslation();
  const { toast } = useToast();
  const movementsQuery = usePosCashMovements(shift.id);
  const salesQuery = usePosShiftSalesSummary(shift.id);
  const [printing, setPrinting] = useState(false);

  const movements = movementsQuery.data;
  const sales = salesQuery.data;

  const totals = useMemo(
    () => buildLiveShiftTotals(shift, movements ?? [], sales),
    [shift, movements, sales],
  );

  const loading =
    (movementsQuery.isLoading || salesQuery.isLoading) && !totals;
  const showFooterActions = Boolean(totals) && !loading;

  const printReport = useCallback(async () => {
    if (!totals || printing) return;
    setPrinting(true);
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
      if (msg === "no_shift_printer" || err instanceof PosPrinterUnavailableError) {
        toast({
          title: t(POS_SHIFT_I18N.noPrinter, "No shift printer configured."),
          variant: "destructive",
        });
        return;
      }
      toast({
        title: t(POS_SHIFT_I18N.printFailed, "Failed to print shift report."),
        variant: "destructive",
      });
    } finally {
      setPrinting(false);
    }
  }, [displayName, language, outletId, outletName, printing, shift, t, toast, totals]);

  const printRef = useRef(printReport);
  printRef.current = printReport;

  useEffect(() => {
    if (!onFooterCenterChange) return;
    if (!showFooterActions) {
      onFooterCenterChange(null);
      return () => onFooterCenterChange(null);
    }
    onFooterCenterChange(
      <PosShiftFooterActions
        printOnly
        busy={printing}
        onPrint={() => {
          void printRef.current();
        }}
      />,
    );
    return () => onFooterCenterChange(null);
  }, [onFooterCenterChange, printing, showFooterActions]);

  return (
    <div className={cn(POS_SHIFT_PANEL.page, "relative")}>
      <div className={cn(POS_SHIFT_PANEL.header, "sticky top-0 z-20")}>
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
          {t(POS_SHIFT_I18N.historyDetailTitle, "Shift Detail")}
        </h2>
      </div>

      {loading || !totals ? (
        <div className="space-y-3 px-2 py-3 sm:px-2.5" aria-busy>
          <div className="h-12 animate-pulse rounded-lg bg-white shadow-sm" />
          <div className="h-40 animate-pulse rounded-lg bg-white shadow-sm" />
        </div>
      ) : (
        <PosShiftActiveSummary
          variant="history"
          shift={shift}
          totals={totals}
          outletName={outletName}
          displayName={displayName}
          onOpenCashIo={onOpenCashIo}
          onOpenProductsSold={onOpenProductsSold}
          refundedProductsQty={salesQuery.data?.refundedProductsQty ?? 0}
        />
      )}
    </div>
  );
}

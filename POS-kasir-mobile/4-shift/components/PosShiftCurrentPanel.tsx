import { useEffect, useState } from "react";
import { useToast } from "@/shared/hooks/use-toast";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { PosPrinterUnavailableError } from "@/pos-mobile/shared/printing/PosPrinterBridge";
import { printPosShiftReport } from "@/pos-mobile/shared/printing/posPrintService";
import { PosShiftActiveSummary } from "./PosShiftActiveSummary";
import { PosShiftEndDialog } from "./PosShiftEndDialog";
import { PosShiftEndedDialog } from "./PosShiftEndedDialog";
import { PosShiftStartBlock } from "./PosShiftStartBlock";
import { POS_SHIFT_I18N } from "../lib/posShiftCopy";
import type { PosCashierShift, PosShiftTotals } from "../lib/posShiftTypes";
import {
  buildLiveShiftTotals,
  usePosCashierShiftActions,
  usePosCashMovements,
  usePosOpenShift,
  usePosShiftSalesSummary,
} from "../lib/usePosCashierShift";
import { usePosShiftEndSuccess, type ShiftEndSnapshot } from "../lib/usePosShiftEndSuccess";
import { usePosOutletShiftSettings } from "../lib/usePosOutletShiftSettings";

type Props = {
  outletId: string;
  outletName: string;
  displayName: string;
  onOpenCashIo: () => void;
  onOpenProductsSold: () => void;
};

type EndedSnapshot = ShiftEndSnapshot;

/**
 * Shift Saat Ini — start screen or active summary; auto-starts when prefs allow.
 */
export function PosShiftCurrentPanel({
  outletId,
  outletName,
  displayName,
  onOpenCashIo,
  onOpenProductsSold,
}: Props) {
  const { t, language } = useAppTranslation();
  const { toast } = useToast();
  const { settings } = usePosOutletShiftSettings(outletId);
  const openQuery = usePosOpenShift(outletId);
  const shift = openQuery.data ?? null;
  const movementsQuery = usePosCashMovements(shift?.id ?? null);
  const salesQuery = usePosShiftSalesSummary(shift?.id ?? null);
  const actions = usePosCashierShiftActions(outletId);
  const { endAndNotify, isEnding } = usePosShiftEndSuccess(outletId);
  const { ensureOpen, isEnsuring, isStarting, start } = actions;

  const [endOpen, setEndOpen] = useState(false);
  const [endedOpen, setEndedOpen] = useState(false);
  const [endedSnapshot, setEndedSnapshot] = useState<EndedSnapshot | null>(null);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    if (!settings?.auto_start_enabled) return;
    if (openQuery.isLoading || openQuery.isFetching) return;
    if (shift) return;
    if (isEnsuring || isStarting) return;
    void ensureOpen().catch(() => {
      /* toast only on user-driven start */
    });
  }, [
    settings?.auto_start_enabled,
    openQuery.isLoading,
    openQuery.isFetching,
    shift,
    isEnsuring,
    isStarting,
    ensureOpen,
  ]);

  const totals = buildLiveShiftTotals(
    shift,
    movementsQuery.data ?? [],
    salesQuery.data,
  );

  const busy = isStarting || isEnding || isEnsuring || openQuery.isLoading;

  const handlePrintError = (err: unknown) => {
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
  };

  const printReport = async (args: {
    shift: PosCashierShift;
    totals: PosShiftTotals;
    countedCash?: number | null;
  }) => {
    setPrinting(true);
    try {
      await printPosShiftReport({
        outletId,
        outletName,
        displayName,
        shift: args.shift,
        totals: args.totals,
        countedCash: args.countedCash,
        language: String(language ?? "id"),
      });
      toast({ title: t(POS_SHIFT_I18N.printOk, "Shift report sent to printer.") });
    } catch (err) {
      handlePrintError(err);
    } finally {
      setPrinting(false);
    }
  };

  if (openQuery.isLoading && !shift) {
    return (
      <div className="space-y-3 p-4" aria-busy>
        <div className="h-14 animate-pulse rounded-md bg-slate-100" />
        <div className="h-12 animate-pulse rounded-md bg-slate-100" />
      </div>
    );
  }

  if (!shift || !totals) {
    return (
      <PosShiftStartBlock
        defaultOpeningCash={settings?.default_opening_cash ?? 100_000}
        busy={busy}
        onStart={async (openingCash) => {
          await start(openingCash);
          toast({ title: t(POS_SHIFT_I18N.shiftStarted, "Shift started.") });
        }}
      />
    );
  }

  return (
    <>
      <PosShiftActiveSummary
        shift={shift}
        totals={totals}
        outletName={outletName}
        displayName={displayName}
        busy={busy || printing}
        onEnd={() => setEndOpen(true)}
        onPrint={() => {
          void printReport({ shift, totals });
        }}
        onOpenCashIo={onOpenCashIo}
        onOpenProductsSold={onOpenProductsSold}
        refundedProductsQty={salesQuery.data?.refundedProductsQty ?? 0}
      />

      <PosShiftEndDialog
        open={endOpen}
        onOpenChange={setEndOpen}
        outletName={outletName}
        displayName={displayName}
        shift={shift}
        totals={totals}
        busy={isEnding}
        onConfirm={(countedCash) => {
          void (async () => {
            try {
              const snapshot = await endAndNotify({
                shiftId: shift.id,
                countedCash,
                totals,
              });
              setEndOpen(false);
              setEndedSnapshot(snapshot);
              setEndedOpen(true);
            } catch {
              toast({
                title: t(POS_SHIFT_I18N.endFailed, "Failed to end shift."),
                variant: "destructive",
              });
            }
          })();
        }}
      />

      {endedSnapshot ? (
        <PosShiftEndedDialog
          open={endedOpen}
          onOpenChange={(open) => {
            setEndedOpen(open);
            if (!open) setEndedSnapshot(null);
          }}
          outletName={outletName}
          displayName={displayName}
          shift={endedSnapshot.shift}
          printing={printing}
          onPrint={() => {
            void printReport({
              shift: endedSnapshot.shift,
              totals: endedSnapshot.totals,
              countedCash: endedSnapshot.shift.closing_cash,
            });
          }}
        />
      ) : null}
    </>
  );
}

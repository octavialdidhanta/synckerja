import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/shared/auth/contexts/AuthContext";
import { useToast } from "@/shared/hooks/use-toast";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { POS_AUTH_PATHS } from "@/pos-mobile/0-auth/lib/posAuthPaths";
import { clearPosAuthSurface } from "@/pos-mobile/0-auth/lib/posAuthSurface";
import {
  clearPosSelectedOutlet,
  readPosSelectedOutlet,
  readPosSelectedOutletId,
} from "@/pos-mobile/1-outlet-select/lib/posSelectedOutletStorage";
import { usePosAppPermissions } from "@/pos-mobile/shared/hooks/usePosAppPermissions";
import { PosPrinterUnavailableError } from "@/pos-mobile/shared/printing/PosPrinterBridge";
import { printPosShiftReport } from "@/pos-mobile/shared/printing/posPrintService";
import { PosShiftEndDialog } from "@/pos-mobile/4-shift/components/PosShiftEndDialog";
import { PosShiftEndedDialog } from "@/pos-mobile/4-shift/components/PosShiftEndedDialog";
import { POS_SHIFT_I18N } from "@/pos-mobile/4-shift/lib/posShiftCopy";
import type { PosCashierShift, PosShiftTotals } from "@/pos-mobile/4-shift/lib/posShiftTypes";
import {
  buildLiveShiftTotals,
  usePosCashMovements,
  usePosOpenShift,
  usePosShiftSalesSummary,
} from "@/pos-mobile/4-shift/lib/usePosCashierShift";
import { usePosShiftEndSuccess, type ShiftEndSnapshot } from "@/pos-mobile/4-shift/lib/usePosShiftEndSuccess";
import { usePosShiftCashierName } from "@/pos-mobile/4-shift/lib/usePosShiftCashierName";
import {
  canUserEndOpenShift,
  shouldGateLeaveForOpenShift,
} from "@/pos-mobile/4-shift/lib/posShiftLeaveGate";

export type PosLeaveAction = "logout" | "switch-outlet";

type LeaveGateApi = {
  requestLeave: (action: PosLeaveAction) => void;
};

const PosSessionLeaveContext = createContext<LeaveGateApi | null>(null);

export function usePosSessionLeave(): LeaveGateApi {
  const ctx = useContext(PosSessionLeaveContext);
  if (!ctx) {
    throw new Error("usePosSessionLeave must be used within PosSessionLeaveProvider");
  }
  return ctx;
}

/** Safe hook when provider may be absent (returns null). */
export function usePosSessionLeaveOptional(): LeaveGateApi | null {
  return useContext(PosSessionLeaveContext);
}

type EndedSnapshot = ShiftEndSnapshot;

function PosSessionLeaveProviderInner({ children }: { children: ReactNode }) {
  const { t, language } = useAppTranslation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const permissions = usePosAppPermissions();

  const outletId = readPosSelectedOutletId();
  const outletMeta = readPosSelectedOutlet();
  const outletLabel = outletMeta?.name || outletId || "";
  const openShift = usePosOpenShift(outletId);
  const shift = openShift.data ?? null;
  const movementsQuery = usePosCashMovements(shift?.id ?? null);
  const salesQuery = usePosShiftSalesSummary(shift?.id ?? null);
  const { endAndNotify, isEnding } = usePosShiftEndSuccess(outletId);

  const cashierName = usePosShiftCashierName(
    shift?.opened_by ?? user?.id,
    shift?.opened_by && user?.id && shift.opened_by === user.id ? user.email : null,
  );

  const totals = buildLiveShiftTotals(
    shift,
    movementsQuery.data ?? [],
    salesQuery.data,
  );

  const [pending, setPending] = useState<PosLeaveAction | null>(null);
  const [endOpen, setEndOpen] = useState(false);
  const [endedOpen, setEndedOpen] = useState(false);
  const [endedSnapshot, setEndedSnapshot] = useState<EndedSnapshot | null>(null);
  const [printing, setPrinting] = useState(false);

  const canEndOpenShift = useCallback(
    (row: PosCashierShift) =>
      canUserEndOpenShift({
        openedBy: row.opened_by,
        userId: user?.id,
        unrestricted: permissions.unrestricted,
      }),
    [permissions.unrestricted, user?.id],
  );

  const performLeave = useCallback(
    async (action: PosLeaveAction) => {
      if (action === "switch-outlet") {
        navigate(POS_AUTH_PATHS.selectOutlet);
        return;
      }
      clearPosAuthSurface();
      clearPosSelectedOutlet();
      await signOut();
      navigate(POS_AUTH_PATHS.login, { replace: true });
    },
    [navigate, signOut],
  );

  const finishLeave = useCallback(
    (action: PosLeaveAction | null) => {
      setEndedOpen(false);
      setEndedSnapshot(null);
      setEndOpen(false);
      const next = action;
      setPending(null);
      if (next) void performLeave(next);
    },
    [performLeave],
  );

  const requestLeave = useCallback(
    (action: PosLeaveAction) => {
      void (async () => {
        let open = openShift.data ?? null;
        if (outletId) {
          try {
            const fresh = await openShift.refetch();
            open = fresh.data ?? null;
          } catch {
            /* use cached open */
          }
        }
        if (!shouldGateLeaveForOpenShift(open)) {
          void performLeave(action);
          return;
        }
        if (!canEndOpenShift(open)) {
          toast({
            title: t(
              POS_SHIFT_I18N.leaveNotOpener,
              "Only the cashier who opened this shift can end it before leaving.",
            ),
            variant: "destructive",
          });
          return;
        }
        setPending(action);
        setEndOpen(true);
      })();
    },
    [outletId, openShift, canEndOpenShift, performLeave, toast, t],
  );

  const api = useMemo(() => ({ requestLeave }), [requestLeave]);

  return (
    <PosSessionLeaveContext.Provider value={api}>
      {children}

      {shift && totals ? (
        <PosShiftEndDialog
          open={endOpen}
          onOpenChange={(open) => {
            setEndOpen(open);
            if (!open && !endedOpen) setPending(null);
          }}
          outletName={outletLabel}
          displayName={cashierName.name}
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
              } catch (err) {
                const msg = err instanceof Error ? err.message : "";
                toast({
                  title:
                    msg === "not_shift_opener"
                      ? t(
                          POS_SHIFT_I18N.leaveNotOpener,
                          "Only the cashier who opened this shift can end it before leaving.",
                        )
                      : t(POS_SHIFT_I18N.endFailed, "Failed to end shift."),
                  variant: "destructive",
                });
              }
            })();
          }}
        />
      ) : null}

      {endedSnapshot ? (
        <PosShiftEndedDialog
          open={endedOpen}
          onOpenChange={(open) => {
            if (!open) finishLeave(pending);
          }}
          outletName={outletLabel}
          displayName={cashierName.name}
          shift={endedSnapshot.shift}
          printing={printing}
          onPrint={() => {
            void (async () => {
              setPrinting(true);
              try {
                await printPosShiftReport({
                  outletId: outletId ?? endedSnapshot.shift.outlet_id,
                  outletName: outletLabel,
                  displayName: cashierName.name,
                  shift: endedSnapshot.shift,
                  totals: endedSnapshot.totals,
                  countedCash: endedSnapshot.shift.closing_cash,
                  language: String(language ?? "id"),
                });
                toast({
                  title: t(POS_SHIFT_I18N.printOk, "Shift report sent to printer."),
                });
                finishLeave(pending);
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
                } else {
                  toast({
                    title: t(
                      POS_SHIFT_I18N.printFailed,
                      "Failed to print shift report.",
                    ),
                    variant: "destructive",
                  });
                }
              } finally {
                setPrinting(false);
              }
            })();
          }}
        />
      ) : null}
    </PosSessionLeaveContext.Provider>
  );
}

/**
 * Provides leave-gate (logout / switch-outlet must end open shift first).
 * Nesting-safe: reuses parent provider when already present.
 */
export function PosSessionLeaveProvider({ children }: { children: ReactNode }) {
  const existing = useContext(PosSessionLeaveContext);
  if (existing) return <>{children}</>;
  return <PosSessionLeaveProviderInner>{children}</PosSessionLeaveProviderInner>;
}

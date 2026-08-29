import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { PosCashierShift, PosShiftTotals } from "@/shared/pos-shift";
import {
  buildLiveShiftTotals,
  usePosCashierShiftActions,
  type PosShiftSalesSummary,
} from "./usePosCashierShift";
import { sendPosShiftRecapEmailSilent } from "./sendPosShiftRecapEmail";

export type ShiftEndSnapshot = {
  shift: PosCashierShift;
  totals: PosShiftTotals;
};

export type EndShiftAndNotifyArgs = {
  shiftId: string;
  countedCash: number;
  totals: PosShiftTotals;
};

/**
 * Shared post-close handler: end shift RPC + fire-and-forget recap email.
 * Used by PosShiftCurrentPanel and PosSessionLeaveProvider (logout / switch-outlet).
 */
export function usePosShiftEndSuccess(outletId: string | null) {
  const { language } = useAppTranslation();
  const actions = usePosCashierShiftActions(outletId);

  const endAndNotify = async (
    args: EndShiftAndNotifyArgs,
  ): Promise<ShiftEndSnapshot> => {
    const closed = await actions.end(args.shiftId, args.countedCash);
    const snapshotTotals: PosShiftTotals = {
      ...args.totals,
      expectedCash: closed.expected_cash ?? args.totals.expectedCash,
    };

    sendPosShiftRecapEmailSilent({
      shiftId: closed.id,
      language: String(language ?? "id"),
    });

    return { shift: closed, totals: snapshotTotals };
  };

  return {
    endAndNotify,
    isEnding: actions.isEnding,
    buildLiveShiftTotals,
  };
}

export type { PosShiftSalesSummary };

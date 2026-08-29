import {
  encodeEscPosText,
  escPosColumns,
  escPosDivider,
} from "./encodeEscPosText";
import { formatPosCash, formatPosCashOut } from "@/pos-mobile/4-shift/lib/formatPosCash";
import { formatPosShiftDateTime } from "@/pos-mobile/4-shift/lib/formatPosShiftDateTime";
import type { PosCashierShift, PosShiftTotals } from "@/pos-mobile/4-shift/lib/posShiftTypes";
import {
  computePosShiftCashVariance,
  formatPosShiftVariance,
} from "@/pos-mobile/4-shift/lib/posShiftVariance";

export type PosShiftReportPrintInput = {
  outletName: string;
  displayName: string;
  shift: PosCashierShift;
  totals: PosShiftTotals;
  /** Physical count; defaults to shift.closing_cash when closed. */
  countedCash?: number | null;
  language?: string;
};

/** ESC/POS shift recap for Bluetooth printers (role shift_recap). */
export function buildShiftReportEscPos(input: PosShiftReportPrintInput): Uint8Array {
  const width = 32;
  const lang = input.language ?? "id";
  const counted =
    input.countedCash != null && Number.isFinite(input.countedCash)
      ? input.countedCash
      : input.shift.closing_cash;
  const expected =
    input.shift.expected_cash != null && Number.isFinite(input.shift.expected_cash)
      ? input.shift.expected_cash
      : input.totals.expectedCash;

  const rows: string[] = [];
  rows.push(input.outletName.slice(0, width));
  rows.push("SHIFT REPORT");
  rows.push(escPosDivider(width));
  rows.push(`Name: ${input.displayName}`.slice(0, width));
  rows.push(
    `Opened: ${formatPosShiftDateTime(input.shift.opened_at, lang, { includeWeekday: false })}`.slice(
      0,
      width,
    ),
  );
  if (input.shift.closed_at) {
    rows.push(
      `Closed: ${formatPosShiftDateTime(input.shift.closed_at, lang, { includeWeekday: false })}`.slice(
        0,
        width,
      ),
    );
  }
  rows.push(escPosDivider(width));
  rows.push(escPosColumns("Opening", formatPosCash(input.totals.openingCash), width));
  rows.push(escPosColumns("Cash sales", formatPosCash(input.totals.cashSales), width));
  rows.push(
    escPosColumns(
      "Cash in/out",
      input.totals.cashInOutNet < 0
        ? formatPosCashOut(-input.totals.cashInOutNet)
        : formatPosCash(input.totals.cashInOutNet),
      width,
    ),
  );
  rows.push(escPosColumns("Expected", formatPosCash(expected), width));
  if (counted != null && Number.isFinite(counted)) {
    rows.push(escPosColumns("Counted", formatPosCash(counted), width));
    rows.push(
      escPosColumns(
        "Variance",
        formatPosShiftVariance(computePosShiftCashVariance(counted, expected)),
        width,
      ),
    );
  }
  rows.push(escPosColumns("Products sold", String(input.totals.productsSoldQty), width));
  rows.push(escPosDivider(width));
  rows.push("Terima kasih");
  return encodeEscPosText(rows, { width });
}

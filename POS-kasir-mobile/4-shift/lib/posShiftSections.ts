import { POS_SHIFT_I18N } from "./posShiftCopy";

export type PosShiftSectionId =
  | "options"
  | "current"
  | "history"
  | "history-detail"
  | "history-cash-io"
  | "history-products-sold"
  | "cash-io"
  | "products-sold";

export type PosShiftNavItem = {
  id: Exclude<
    PosShiftSectionId,
    | "cash-io"
    | "products-sold"
    | "history-detail"
    | "history-cash-io"
    | "history-products-sold"
  >;
  labelKey: string;
  labelFallback: string;
  panelTitleKey: string;
  panelTitleFallback: string;
  /** Dynamic status shown on Options row (Aktif / Tidak Aktif). */
  showAutoStatus?: boolean;
};

export const POS_SHIFT_NAV: readonly PosShiftNavItem[] = [
  {
    id: "options",
    labelKey: POS_SHIFT_I18N.navOptions,
    labelFallback: "Shift Options",
    panelTitleKey: POS_SHIFT_I18N.optionsTitle,
    panelTitleFallback: "Automatic Shift",
    showAutoStatus: true,
  },
  {
    id: "current",
    labelKey: POS_SHIFT_I18N.navCurrent,
    labelFallback: "Current Shift",
    panelTitleKey: POS_SHIFT_I18N.currentTitle,
    panelTitleFallback: "Current Shift",
  },
  {
    id: "history",
    labelKey: POS_SHIFT_I18N.navHistory,
    labelFallback: "Shift History",
    panelTitleKey: POS_SHIFT_I18N.historyTitle,
    panelTitleFallback: "Shift History",
  },
] as const;

const HISTORY_NESTED = new Set<PosShiftSectionId>([
  "history-detail",
  "history-cash-io",
  "history-products-sold",
]);

export function parsePosShiftSection(raw: string | null): PosShiftSectionId {
  if (
    raw === "current" ||
    raw === "history" ||
    raw === "history-detail" ||
    raw === "history-cash-io" ||
    raw === "history-products-sold" ||
    raw === "cash-io" ||
    raw === "products-sold"
  ) {
    return raw;
  }
  return "options";
}

export function getPosShiftNavItem(id: PosShiftSectionId): PosShiftNavItem {
  const main =
    id === "cash-io" || id === "products-sold"
      ? "current"
      : HISTORY_NESTED.has(id)
        ? "history"
        : id;
  return POS_SHIFT_NAV.find((n) => n.id === main) ?? POS_SHIFT_NAV[0];
}

export function isPosShiftHistoryNested(id: PosShiftSectionId): boolean {
  return HISTORY_NESTED.has(id);
}

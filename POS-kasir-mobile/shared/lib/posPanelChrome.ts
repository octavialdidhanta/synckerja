import { cn } from "@/shared/lib/utils";

/**
 * Shared POS panel chrome — standard from `/pos/shift` Current Shift.
 * Canvas slate-100, compact gutters, white cards, stronger row dividers.
 */
export const POS_PANEL = {
  page: "flex min-h-full min-w-0 flex-col overflow-x-hidden bg-slate-100",
  header:
    "flex h-12 flex-shrink-0 items-center gap-1 border-b border-slate-200 bg-white px-2",
  headerBack:
    "inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-200/80",
  headerTitle:
    "min-w-0 flex-1 truncate text-left text-base font-semibold text-slate-900",
  body: "min-w-0 flex-1 px-2 py-3 pb-8 sm:px-2.5",
  sectionTitle:
    "px-0.5 pb-1.5 pt-3 text-[11px] font-bold uppercase tracking-wide text-slate-600 first:pt-0",
  card: "min-w-0 overflow-hidden rounded-lg border border-slate-200/80 bg-white shadow-sm",
  row: "flex w-full min-w-0 items-center justify-between gap-2 border-b border-slate-200 px-3 py-3 last:border-b-0",
  rowLabel: "min-w-0 flex-1 text-sm text-slate-800",
  rowValue: "flex-shrink-0 text-sm font-medium tabular-nums text-slate-900",
  /** Form rows (create item / variant / modifier) — extra inset so typed text is not flush. */
  formRow:
    "flex w-full min-w-0 items-center justify-between gap-3 border-b border-slate-200 px-4 py-3.5 last:border-b-0",
  formInput:
    "h-10 min-w-0 w-full border-0 bg-transparent px-1 shadow-none focus-visible:ring-0",
  formInputEnd:
    "h-10 min-w-0 max-w-[55%] flex-1 border-0 bg-transparent px-1 text-right shadow-none focus-visible:ring-0",
} as const;

/** Fast ease-in-out enter + exit for POS side sheets (~200ms). */
export const POS_SHEET_MOTION_MS = 200;

export const POS_SHEET_MOTION =
  "ease-in-out data-[state=open]:duration-200 data-[state=closed]:duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out";

export const POS_SHEET_OVERLAY_MOTION =
  "z-[70] ease-in-out data-[state=open]:duration-200 data-[state=closed]:duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0";

/** @deprecated Prefer POS_PANEL — alias for Shift call sites. */
export const POS_SHIFT_PANEL = POS_PANEL;

export function posPanelSectionTitleClass(className?: string) {
  return cn(POS_PANEL.sectionTitle, className);
}

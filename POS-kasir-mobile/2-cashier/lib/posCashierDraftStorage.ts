import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import {
  normalizePosCashierCustomer,
  type PosCashierCustomer,
} from "../lib/posCashierCustomer";

const POS_CASHIER_DRAFT_KEY = "synckerja_pos_cashier_draft";

export type PosCashierDraft = {
  outletId: string;
  lines: CustomerVisitCartLine[];
  salesTypeId?: string;
  activeOpenSessionId?: string | null;
  customer?: PosCashierCustomer | null;
};

function storageKey(outletId: string): string {
  return `${POS_CASHIER_DRAFT_KEY}:${outletId}`;
}

/** Persist in-progress cashier cart across route changes (e.g. start-shift redirect). */
export function stashPosCashierDraft(draft: PosCashierDraft): void {
  if (!draft.outletId) return;
  try {
    if (!draft.lines?.length) {
      sessionStorage.removeItem(storageKey(draft.outletId));
      return;
    }
    sessionStorage.setItem(
      storageKey(draft.outletId),
      JSON.stringify({
        outletId: draft.outletId,
        lines: draft.lines,
        salesTypeId: draft.salesTypeId ?? "",
        activeOpenSessionId: draft.activeOpenSessionId ?? null,
        customer: draft.customer ?? null,
      } satisfies PosCashierDraft),
    );
  } catch {
    /* ignore quota / private mode */
  }
}

export function readPosCashierDraft(outletId: string | null | undefined): PosCashierDraft | null {
  if (!outletId) return null;
  try {
    const raw = sessionStorage.getItem(storageKey(outletId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PosCashierDraft>;
    if (parsed.outletId !== outletId || !Array.isArray(parsed.lines) || parsed.lines.length === 0) {
      return null;
    }
    return {
      outletId,
      lines: parsed.lines,
      salesTypeId: typeof parsed.salesTypeId === "string" ? parsed.salesTypeId : "",
      activeOpenSessionId: parsed.activeOpenSessionId ?? null,
      customer: normalizePosCashierCustomer(parsed.customer ?? null),
    };
  } catch {
    return null;
  }
}

export function clearPosCashierDraft(outletId: string | null | undefined): void {
  if (!outletId) return;
  try {
    sessionStorage.removeItem(storageKey(outletId));
  } catch {
    /* ignore */
  }
}

export function hasPosCashierDraft(outletId: string | null | undefined): boolean {
  return Boolean(readPosCashierDraft(outletId)?.lines?.length);
}

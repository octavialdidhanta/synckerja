import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";

const POS_SELECTED_TABLE_KEY = "synckerja_pos_selected_table";

export type PosSelectedTable = {
  id: string;
  name: string;
  groupId: string;
  pax: number;
  outletId: string;
  /** Open session id when resuming an occupied table. */
  sessionId?: string | null;
  seatedAt?: string | null;
  /** Cart lines to restore when opening occupied table. */
  cartSnapshot?: CustomerVisitCartLine[] | null;
};

export function stashPosSelectedTable(table: PosSelectedTable): void {
  try {
    sessionStorage.setItem(POS_SELECTED_TABLE_KEY, JSON.stringify(table));
  } catch {
    /* ignore quota / private mode */
  }
}

export function readPosSelectedTable(): PosSelectedTable | null {
  try {
    const raw = sessionStorage.getItem(POS_SELECTED_TABLE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PosSelectedTable>;
    if (
      !parsed?.id ||
      !parsed?.name ||
      !parsed?.groupId ||
      !parsed?.outletId ||
      typeof parsed.pax !== "number"
    ) {
      return null;
    }
    return {
      id: parsed.id,
      name: parsed.name,
      groupId: parsed.groupId,
      pax: parsed.pax,
      outletId: parsed.outletId,
      sessionId: parsed.sessionId ?? null,
      seatedAt: parsed.seatedAt ?? null,
      cartSnapshot: Array.isArray(parsed.cartSnapshot) ? parsed.cartSnapshot : null,
    };
  } catch {
    return null;
  }
}

export function clearPosSelectedTable(): void {
  try {
    sessionStorage.removeItem(POS_SELECTED_TABLE_KEY);
  } catch {
    /* ignore */
  }
}

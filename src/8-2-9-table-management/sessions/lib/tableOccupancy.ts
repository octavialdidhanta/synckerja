import type { PosTableSession } from "../../lib/posTableSessionTypes";

export type TableOccupancyState = "empty" | "partial" | "full";

export type TableOccupancy = {
  openSessions: PosTableSession[];
  usedPax: number;
  capacity: number;
  remainingPax: number;
  state: TableOccupancyState;
};

/** Build occupancy for one table from open sessions + table capacity (pax). */
export function computeTableOccupancy(
  openSessions: PosTableSession[],
  capacity: number,
): TableOccupancy {
  const cap = Math.max(1, Math.floor(capacity) || 1);
  const sessions = (Array.isArray(openSessions) ? openSessions : []).filter(
    (s) => s.status === "open",
  );
  const usedPax = sessions.reduce((sum, s) => sum + Math.max(0, s.pax), 0);
  const remainingPax = Math.max(0, cap - usedPax);
  let state: TableOccupancyState = "empty";
  if (sessions.length === 0 || usedPax <= 0) state = "empty";
  else if (remainingPax < 1) state = "full";
  else state = "partial";
  return {
    openSessions: sessions,
    usedPax,
    capacity: cap,
    remainingPax,
    state,
  };
}

export function canAcceptPax(occupancy: TableOccupancy, newPax: number): boolean {
  const n = Math.max(1, Math.floor(newPax) || 1);
  return n <= occupancy.remainingPax;
}

/** Group open sessions by pos_table_id (walk-ins with null table omitted). */
export function groupOpenSessionsByTableId(
  sessions: PosTableSession[],
): Map<string, PosTableSession[]> {
  const map = new Map<string, PosTableSession[]>();
  for (const s of sessions) {
    if (!s.pos_table_id) continue;
    const list = map.get(s.pos_table_id);
    if (list) list.push(s);
    else map.set(s.pos_table_id, [s]);
  }
  return map;
}

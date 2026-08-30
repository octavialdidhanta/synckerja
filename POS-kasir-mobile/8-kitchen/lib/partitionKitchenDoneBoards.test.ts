import { describe, expect, it } from "vitest";
import {
  POS_KITCHEN_RECALL_MAX,
  POS_KITCHEN_RECALL_WINDOW_MS,
  selectKitchenCompletedHistoryTickets,
  selectKitchenRecallTickets,
} from "./partitionKitchenDoneBoards";
import type { PosKitchenTicket } from "./posKitchenTypes";

function ticket(
  partial: Partial<PosKitchenTicket> & Pick<PosKitchenTicket, "id" | "completed_at">,
): PosKitchenTicket {
  return {
    organization_id: "o",
    outlet_id: "out",
    session_id: "s",
    pos_table_id: null,
    table_name: "T1",
    customer_name: null,
    sales_type_id: null,
    sales_type_label: "Dine in",
    status: "done",
    is_held: false,
    held_at: null,
    pause_ms: 0,
    restore_marker: null,
    created_by: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    lines: [],
    ...partial,
  };
}

describe("selectKitchenRecallTickets", () => {
  const now = Date.parse("2026-08-30T12:00:00.000Z");

  it("keeps only done tickets inside the recall window, newest first", () => {
    const within = ticket({
      id: "a",
      completed_at: new Date(now - 5 * 60 * 1000).toISOString(),
    });
    const olderInWindow = ticket({
      id: "b",
      completed_at: new Date(now - 10 * 60 * 1000).toISOString(),
    });
    const outside = ticket({
      id: "c",
      completed_at: new Date(now - POS_KITCHEN_RECALL_WINDOW_MS - 1000).toISOString(),
    });

    expect(
      selectKitchenRecallTickets([outside, within, olderInWindow], now).map((t) => t.id),
    ).toEqual(["a", "b"]);
  });

  it("caps at RECALL_MAX", () => {
    const many = Array.from({ length: POS_KITCHEN_RECALL_MAX + 5 }, (_, i) =>
      ticket({
        id: `t${i}`,
        completed_at: new Date(now - i * 1000).toISOString(),
      }),
    );
    expect(selectKitchenRecallTickets(many, now)).toHaveLength(POS_KITCHEN_RECALL_MAX);
    expect(selectKitchenRecallTickets(many, now)[0]?.id).toBe("t0");
  });
});

describe("selectKitchenCompletedHistoryTickets", () => {
  it("excludes tickets that are on the recall stack", () => {
    const recall = [ticket({ id: "r1", completed_at: "2026-08-30T11:50:00Z" })];
    const doneToday = [
      ticket({ id: "r1", completed_at: "2026-08-30T11:50:00Z" }),
      ticket({ id: "old", completed_at: "2026-08-30T08:00:00Z" }),
    ];
    expect(
      selectKitchenCompletedHistoryTickets(doneToday, recall).map((t) => t.id),
    ).toEqual(["old"]);
  });
});

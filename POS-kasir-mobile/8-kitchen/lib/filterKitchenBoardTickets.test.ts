import { describe, expect, it } from "vitest";
import { filterKitchenBoardTickets } from "./filterKitchenBoardTickets";
import type { PosKitchenTicket } from "./posKitchenTypes";

function ticket(
  partial: Partial<PosKitchenTicket> & Pick<PosKitchenTicket, "id">,
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
    status: "new",
    is_held: false,
    held_at: null,
    pause_ms: 0,
    restore_marker: null,
    created_by: null,
    completed_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    lines: [],
    ...partial,
  };
}

describe("filterKitchenBoardTickets", () => {
  const active = [
    ticket({ id: "1", sales_type_label: "Dine in" }),
    ticket({ id: "2", sales_type_label: "Takeaway", is_held: true }),
    ticket({ id: "3", sales_type_label: "Pickup" }),
  ];
  const recall = [ticket({ id: "r1", status: "done" })];
  const completedToday = [
    ticket({ id: "c1", status: "done" }),
    ticket({ id: "c2", status: "done" }),
  ];

  it("filters active all / bucket / held", () => {
    expect(
      filterKitchenBoardTickets({
        mode: { kind: "active", salesType: "all" },
        active,
        recall,
        completedToday,
      }).map((t) => t.id),
    ).toEqual(["1", "2", "3"]);

    expect(
      filterKitchenBoardTickets({
        mode: { kind: "active", salesType: "takeaway" },
        active,
        recall,
        completedToday,
      }).map((t) => t.id),
    ).toEqual(["2"]);

    expect(
      filterKitchenBoardTickets({
        mode: { kind: "held" },
        active,
        recall,
        completedToday,
      }).map((t) => t.id),
    ).toEqual(["2"]);
  });

  it("returns recall and completed lists", () => {
    expect(
      filterKitchenBoardTickets({
        mode: { kind: "recall" },
        active,
        recall,
        completedToday,
      }),
    ).toBe(recall);
    expect(
      filterKitchenBoardTickets({
        mode: { kind: "completed_today" },
        active,
        recall,
        completedToday,
      }),
    ).toBe(completedToday);
  });
});

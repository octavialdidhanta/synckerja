import { describe, expect, it } from "vitest";
import {
  computeTableOccupancy,
  groupOpenSessionsByTableId,
} from "@/8-2-9-table-management/sessions";
import type { PosTableSession } from "@/8-2-9-table-management/lib/posTableSessionTypes";
import { planAssignPayFirstPatches } from "./assignPayFirstTable";
import { isPaidSeatingSession } from "./isPaidSeatingSession";

function openSession(
  overrides: Partial<PosTableSession> & Pick<PosTableSession, "id">,
): PosTableSession {
  return {
    organization_id: "org",
    outlet_id: "out",
    group_id: overrides.pos_table_id ? "grp" : null,
    pos_table_id: null,
    table_name: "Walk-in",
    pax: 1,
    seated_at: "2026-08-30T12:00:00.000Z",
    closed_at: null,
    status: "open",
    opened_by: null,
    closed_by: null,
    waiter_id: null,
    sales_activity_id: "act-1",
    cart_snapshot: [],
    cancel_reason: null,
    customer_name: "Linda",
    customer_phone: null,
    created_at: "2026-08-30T12:00:00.000Z",
    updated_at: "2026-08-30T12:00:00.000Z",
    ...overrides,
  };
}

describe("pay-first seating occupancy", () => {
  it("omits walk-in seating without a table from the floor plan", () => {
    const walkIn = openSession({ id: "s1", pos_table_id: null });
    expect(isPaidSeatingSession(walkIn)).toBe(true);
    expect(groupOpenSessionsByTableId([walkIn]).size).toBe(0);
  });

  it("marks a table occupied after assign and empty after clear", () => {
    const seated = openSession({
      id: "s1",
      pos_table_id: "t5",
      group_id: "grp",
      table_name: "Meja 5",
    });
    const byTable = groupOpenSessionsByTableId([seated]);
    expect(byTable.get("t5")?.map((s) => s.id)).toEqual(["s1"]);
    expect(computeTableOccupancy(byTable.get("t5") ?? [], 4).state).toBe("partial");

    const cleared = { ...seated, status: "paid" as const, closed_at: "2026-08-30T13:00:00.000Z" };
    const stillOpen = [cleared].filter((s) => s.status === "open");
    const afterClear = groupOpenSessionsByTableId(stillOpen);
    expect(afterClear.size).toBe(0);
    expect(computeTableOccupancy(stillOpen, 4).state).toBe("empty");
  });
});

describe("planAssignPayFirstPatches", () => {
  it("updates the session table fields and patches KDS ticket labels", () => {
    expect(
      planAssignPayFirstPatches({
        posTableId: "t5",
        groupId: "grp",
        tableName: "Meja 5",
      }),
    ).toEqual({
      session: {
        pos_table_id: "t5",
        group_id: "grp",
        table_name: "Meja 5",
      },
      tickets: {
        pos_table_id: "t5",
        table_name: "Meja 5",
      },
    });
  });
});

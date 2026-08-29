import { describe, expect, it } from "vitest";
import { mapShiftRow } from "./mapShiftRow";

describe("mapShiftRow", () => {
  it("maps RPC row fields", () => {
    const row = mapShiftRow({
      shift_id: "abc",
      outlet_id: "out1",
      outlet_name: "Outlet 1",
      opened_at: "2026-03-01T10:00:00Z",
      closed_at: "2026-03-01T18:00:00Z",
      status: "closed",
      opened_by_user_id: "user1",
      opened_by_name: "Kasir A",
      opening_cash: 100000,
      expected_cash: 115000,
      closing_cash: 114000,
      cash_difference: -1000,
    });

    expect(row.shiftId).toBe("abc");
    expect(row.outletName).toBe("Outlet 1");
    expect(row.cashDifference).toBe(-1000);
    expect(row.status).toBe("closed");
  });
});

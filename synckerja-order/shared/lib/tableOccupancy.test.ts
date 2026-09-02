import { describe, expect, it } from "vitest";
import { canJoinOccupiedTable, decideTableJoin, remainingTablePax } from "./tableOccupancy";

describe("tableOccupancy", () => {
  it("computes remaining pax", () => {
    expect(remainingTablePax(4, 3)).toBe(1);
    expect(remainingTablePax(4, 4)).toBe(0);
    expect(remainingTablePax(4, 5)).toBe(0);
  });

  it("allows join when remaining pax is at least 1", () => {
    expect(canJoinOccupiedTable(1)).toBe(true);
    expect(canJoinOccupiedTable(0)).toBe(false);
  });

  it("decides empty / join / full", () => {
    expect(decideTableJoin({ tablePax: 4, occupiedPax: 0, hasOpenSession: false })).toBe("empty");
    expect(decideTableJoin({ tablePax: 4, occupiedPax: 2, hasOpenSession: true })).toBe("join");
    expect(decideTableJoin({ tablePax: 4, occupiedPax: 4, hasOpenSession: true })).toBe("full");
  });
});

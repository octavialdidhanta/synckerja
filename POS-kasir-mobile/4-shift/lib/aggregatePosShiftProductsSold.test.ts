import { describe, expect, it } from "vitest";
import {
  aggregatePosShiftProductsSold,
  formatSoldProductLabel,
} from "./aggregatePosShiftProductsSold";

describe("formatSoldProductLabel", () => {
  it("joins name and sub with hyphen", () => {
    expect(
      formatSoldProductLabel({
        service_name: "Ayam Geprek Pedas",
        sub_service_name: "Level 1",
      }),
    ).toBe("Ayam Geprek Pedas - Level 1");
  });

  it("returns name only when no sub", () => {
    expect(
      formatSoldProductLabel({ service_name: "Es Teh", sub_service_name: null }),
    ).toBe("Es Teh");
  });

  it("returns dash when empty", () => {
    expect(formatSoldProductLabel({ service_name: null, sub_service_name: null })).toBe("—");
  });
});

describe("aggregatePosShiftProductsSold", () => {
  it("groups by label, sorts A-Z, and totals qty", () => {
    const result = aggregatePosShiftProductsSold([
      { service_name: "Nasi", sub_service_name: null, quantity: 2 },
      { service_name: "Ayam", sub_service_name: "Pedas", quantity: 1 },
      { service_name: "Nasi", sub_service_name: null, quantity: 3 },
      { service_name: "Ayam", sub_service_name: "Pedas", quantity: 1 },
    ]);
    expect(result.totalQty).toBe(7);
    expect(result.rows).toEqual([
      { label: "Ayam - Pedas", quantity: 2 },
      { label: "Nasi", quantity: 5 },
    ]);
  });

  it("returns empty for no lines", () => {
    expect(aggregatePosShiftProductsSold([])).toEqual({ totalQty: 0, rows: [] });
  });

  it("skips zero qty lines", () => {
    const result = aggregatePosShiftProductsSold([
      { service_name: "Kopi", sub_service_name: null, quantity: 0 },
      { service_name: "Teh", sub_service_name: null, quantity: 2 },
    ]);
    expect(result.totalQty).toBe(2);
    expect(result.rows).toEqual([{ label: "Teh", quantity: 2 }]);
  });
});

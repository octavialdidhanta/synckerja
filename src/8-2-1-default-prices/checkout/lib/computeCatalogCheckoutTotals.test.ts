import { describe, expect, it } from "vitest";
import {
  computeCatalogCheckoutTotals,
  filterGratuitiesForOutletAndSalesType,
} from "./computeCatalogCheckoutTotals";

describe("computeCatalogCheckoutTotals", () => {
  const baseSettings = {
    tax_enabled: true,
    gratuity_enabled: true,
    application_method: "add" as const,
  };

  it("returns subtotal-only when tax and gratuity disabled", () => {
    const result = computeCatalogCheckoutTotals({
      subtotal: 100_000,
      settings: { ...baseSettings, tax_enabled: false, gratuity_enabled: false },
      taxes: [{ id: "t1", name: "PPN", amount_percent: 11 }],
      gratuities: [{ id: "g1", name: "Service", amount_percent: 5 }],
    });
    expect(result.grandTotal).toBe(100_000);
    expect(result.taxTotal).toBe(0);
    expect(result.gratuityTotal).toBe(0);
  });

  it("add mode: stacks gratuity then tax on subtotal + gratuity", () => {
    const result = computeCatalogCheckoutTotals({
      subtotal: 100_000,
      settings: baseSettings,
      taxes: [{ id: "t1", name: "PPN (11%)", amount_percent: 11 }],
      gratuities: [{ id: "g1", name: "Service (5%)", amount_percent: 5 }],
    });
    expect(result.gratuityTotal).toBe(5_000);
    expect(result.taxBase).toBe(105_000);
    expect(result.taxTotal).toBe(11_550);
    expect(result.grandTotal).toBe(116_550);
    expect(result.gratuityLines[0]?.amount_percent).toBe(5);
    expect(result.taxLines[0]?.amount_percent).toBe(11);
  });

  it("add mode: sums multiple tax and gratuity rates", () => {
    const result = computeCatalogCheckoutTotals({
      subtotal: 200_000,
      settings: baseSettings,
      taxes: [
        { id: "t1", name: "PPN", amount_percent: 11 },
        { id: "t2", name: "Local", amount_percent: 2 },
      ],
      gratuities: [
        { id: "g1", name: "Service", amount_percent: 5 },
        { id: "g2", name: "Music", amount_percent: 1 },
      ],
    });
    expect(result.gratuityTotal).toBe(12_000);
    const taxBase = 200_000 + 12_000;
    expect(result.taxTotal).toBe(Math.round(taxBase * 0.11) + Math.round(taxBase * 0.02));
    expect(result.grandTotal).toBe(200_000 + result.gratuityTotal + result.taxTotal);
  });

  it("include mode: grand total equals subtotal with informational breakdown", () => {
    const result = computeCatalogCheckoutTotals({
      subtotal: 116_550,
      settings: { ...baseSettings, application_method: "include" },
      taxes: [{ id: "t1", name: "PPN (11%)", amount_percent: 11 }],
      gratuities: [{ id: "g1", name: "Service (5%)", amount_percent: 5 }],
    });
    expect(result.grandTotal).toBe(116_550);
    expect(result.gratuityTotal + result.taxTotal).toBeGreaterThan(0);
    expect(result.gratuityLines.length).toBe(1);
    expect(result.taxLines.length).toBe(1);
  });

  it("rounds to integer Rp", () => {
    const result = computeCatalogCheckoutTotals({
      subtotal: 33_333,
      settings: baseSettings,
      taxes: [{ id: "t1", name: "PPN", amount_percent: 11 }],
      gratuities: [{ id: "g1", name: "Service", amount_percent: 5 }],
    });
    expect(Number.isInteger(result.grandTotal)).toBe(true);
    expect(Number.isInteger(result.gratuityTotal)).toBe(true);
    expect(Number.isInteger(result.taxTotal)).toBe(true);
  });

  it("handles zero subtotal", () => {
    const result = computeCatalogCheckoutTotals({
      subtotal: 0,
      settings: baseSettings,
      taxes: [{ id: "t1", name: "PPN", amount_percent: 11 }],
      gratuities: [{ id: "g1", name: "Service", amount_percent: 5 }],
    });
    expect(result.grandTotal).toBe(0);
  });
});

describe("filterGratuitiesForOutletAndSalesType", () => {
  const outlet1 = "outlet-1";
  const serviceFeeId = "c1a7c952-6b96-4fd8-83f4-a4a64b2ce633";
  const dineInGratuityIds = [serviceFeeId];

  const catalogGratuities = [
    {
      id: serviceFeeId,
      name: "Service Fee",
      amount_percent: 10,
      outlet_ids: [outlet1],
    },
    {
      id: "other-gratuity",
      name: "Other Fee",
      amount_percent: 5,
      outlet_ids: ["outlet-2"],
    },
  ];

  it("returns Service Fee for Dine in at Outlet 1 when sales type link exists", () => {
    const filtered = filterGratuitiesForOutletAndSalesType(
      catalogGratuities,
      outlet1,
      dineInGratuityIds,
    );
    expect(filtered).toEqual([
      {
        id: serviceFeeId,
        name: "Service Fee",
        amount_percent: 10,
        outlet_ids: [outlet1],
      },
    ]);
  });

  it("returns empty when sales type has no gratuity links", () => {
    expect(filterGratuitiesForOutletAndSalesType(catalogGratuities, outlet1, [])).toEqual([]);
  });

  it("computes checkout totals for Dine in + Service Fee 10%", () => {
    const filtered = filterGratuitiesForOutletAndSalesType(
      catalogGratuities,
      outlet1,
      dineInGratuityIds,
    );
    const result = computeCatalogCheckoutTotals({
      subtotal: 100_000,
      settings: {
        tax_enabled: false,
        gratuity_enabled: true,
        application_method: "add",
      },
      taxes: [],
      gratuities: filtered,
    });
    expect(result.gratuityLines).toEqual([
      {
        name: "Service Fee",
        amount: 10_000,
        amount_percent: 10,
      },
    ]);
    expect(result.gratuityTotal).toBe(10_000);
    expect(result.grandTotal).toBe(110_000);
  });
});

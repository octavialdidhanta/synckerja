import { describe, expect, it } from "vitest";
import {
  buildGrossProfitWaterfallRows,
  computeWaterfallPercent,
  shouldShowNonProductRow,
} from "./computeGrossProfitWaterfall";
import type { GrossProfitMetrics } from "./grossProfitTypes";

const USER_FIXTURE: GrossProfitMetrics = {
  grossSales: 1420516,
  discounts: 0,
  refunds: 0,
  netSales: 1420516,
  productNetSales: 1020516,
  nonProductNet: 400000,
  gratuity: 25500,
  tax: 93984,
  cogs: 0,
  cogsAdjustment: 0,
  cogsReversed: 0,
  grossProfit: 1420516,
  grossProfitMargin: 100,
  cogsIncomplete: true,
  transactionCount: 28,
};

describe("shouldShowNonProductRow", () => {
  it("shows when non-product net is positive", () => {
    expect(shouldShowNonProductRow(400000)).toBe(true);
    expect(shouldShowNonProductRow(0)).toBe(false);
  });
});

describe("computeWaterfallPercent", () => {
  it("returns 100% for net sales", () => {
    expect(computeWaterfallPercent(USER_FIXTURE, "netSales")).toEqual({
      percent: 100,
      variant: "net",
    });
  });

  it("returns COGS percent relative to net", () => {
    const metrics = { ...USER_FIXTURE, cogs: 142051.6, grossProfitMargin: 90 };
    expect(computeWaterfallPercent(metrics, "cogs").percent).toBe(10);
  });

  it("returns gross profit margin for profit row", () => {
    expect(computeWaterfallPercent(USER_FIXTURE, "grossProfit")).toEqual({
      percent: 100,
      variant: "profit",
    });
  });
});

describe("buildGrossProfitWaterfallRows", () => {
  it("orders rows with non-product after net sales", () => {
    const rows = buildGrossProfitWaterfallRows(USER_FIXTURE);
    const kinds = rows.map((r) => r.kind);
    expect(kinds).toEqual([
      "grossSales",
      "discounts",
      "refunds",
      "netSales",
      "nonProductNet",
      "cogs",
      "grossProfit",
    ]);
    expect(rows.find((r) => r.kind === "nonProductNet")?.amount).toBe(400000);
  });

  it("omits non-product row when zero", () => {
    const rows = buildGrossProfitWaterfallRows({
      ...USER_FIXTURE,
      nonProductNet: 0,
      productNetSales: 1420516,
    });
    expect(rows.some((r) => r.kind === "nonProductNet")).toBe(false);
  });

  it("marks refunds as deduction", () => {
    const rows = buildGrossProfitWaterfallRows({ ...USER_FIXTURE, refunds: 50000 });
    expect(rows.find((r) => r.kind === "refunds")?.asDeduction).toBe(true);
  });

  it("includes COGS adjustment and reversed rows when non-zero", () => {
    const rows = buildGrossProfitWaterfallRows({
      ...USER_FIXTURE,
      cogsAdjustment: 50000,
      cogsReversed: 12000,
      grossProfit: 1370516,
      grossProfitMargin: 96.48,
    });
    const kinds = rows.map((r) => r.kind);
    expect(kinds).toContain("cogsAdjustment");
    expect(kinds).toContain("cogsReversed");
    expect(kinds.indexOf("cogsAdjustment")).toBeLessThan(kinds.indexOf("grossProfit"));
    expect(rows.find((r) => r.kind === "cogsReversed")?.informational).toBe(true);
  });
});

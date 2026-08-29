import { describe, expect, it } from "vitest";
import {
  computeExpectedTotalCollected,
  formatSalesSummaryMoney,
  normalizeSalesSummaryMetrics,
  salesSummaryTotalsMismatch,
} from "./computeSalesSummaryDisplay";

describe("normalizeSalesSummaryMetrics", () => {
  it("maps RPC row and keeps gross = net + discounts when provided", () => {
    const metrics = normalizeSalesSummaryMetrics({
      gross_sales: 11000,
      discounts: 1000,
      refunds: 0,
      net_sales: 10000,
      gratuity: 500,
      tax: 1000,
      rounding: 0,
      total_collected: 11500,
      transaction_count: 3,
    });
    expect(metrics.grossSales).toBe(11000);
    expect(metrics.netSales).toBe(10000);
    expect(metrics.discounts).toBe(1000);
    expect(metrics.transactionCount).toBe(3);
  });

  it("maps Moka-style exclusive net with additive total collected", () => {
    const metrics = normalizeSalesSummaryMetrics({
      net_sales: 1420516,
      gratuity: 25500,
      tax: 93984,
      total_collected: 1540000,
    });
    expect(metrics.netSales).toBe(1420516);
    expect(computeExpectedTotalCollected(metrics)).toBe(1540000);
  });

  it("maps refunds and formats as deduction when non-zero", () => {
    const metrics = normalizeSalesSummaryMetrics({
      gross_sales: 10000,
      discounts: 0,
      refunds: 2500,
      net_sales: 10000,
      total_collected: 10000,
    });
    expect(metrics.refunds).toBe(2500);
    expect(formatSalesSummaryMoney(metrics.refunds, { asDeduction: true })).toMatch(
      /^\(Rp\.\s?2\.500\)$/,
    );
  });
});

describe("computeExpectedTotalCollected", () => {
  it("adds tax and gratuity to net sales (Moka-style)", () => {
    expect(
      computeExpectedTotalCollected({
        netSales: 10000,
        gratuity: 500,
        tax: 1000,
        rounding: 0,
      }),
    ).toBe(11500);
  });

  it("matches total collected for exclusive net dataset", () => {
    expect(
      computeExpectedTotalCollected({
        netSales: 1420516,
        gratuity: 25500,
        tax: 93984,
        rounding: 0,
      }),
    ).toBe(1540000);
  });
});

describe("salesSummaryTotalsMismatch", () => {
  it("returns false when Moka formula matches collected", () => {
    expect(
      salesSummaryTotalsMismatch({
        netSales: 1420516,
        gratuity: 25500,
        tax: 93984,
        rounding: 0,
        totalCollected: 1540000,
      }),
    ).toBe(false);
  });

  it("returns true when additive breakdown does not match collected", () => {
    expect(
      salesSummaryTotalsMismatch({
        netSales: 1540000,
        gratuity: 25500,
        tax: 93984,
        rounding: 0,
        totalCollected: 1540000,
      }),
    ).toBe(true);
  });
});

describe("formatSalesSummaryMoney", () => {
  it("formats positive amounts with Rp. prefix", () => {
    expect(formatSalesSummaryMoney(26978874)).toMatch(/^Rp\.\s?26\.978\.874$/);
  });

  it("wraps deductions in parentheses when amount > 0", () => {
    expect(formatSalesSummaryMoney(554000, { asDeduction: true })).toMatch(/^\(Rp\.\s?554\.000\)$/);
  });

  it("does not wrap zero deductions", () => {
    expect(formatSalesSummaryMoney(0, { asDeduction: true })).toMatch(/^Rp\.\s?0$/);
  });
});

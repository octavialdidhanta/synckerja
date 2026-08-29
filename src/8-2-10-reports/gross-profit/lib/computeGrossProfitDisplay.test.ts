import { describe, expect, it } from "vitest";
import { normalizeGrossProfitMetrics } from "./computeGrossProfitDisplay";

describe("normalizeGrossProfitMetrics", () => {
  it("maps RPC row including COGS and margin", () => {
    const metrics = normalizeGrossProfitMetrics({
      gross_sales: 12000,
      discounts: 2000,
      refunds: 500,
      net_sales: 10000,
      product_net_sales: 8500,
      non_product_net: 1500,
      cogs: 4000,
      cogs_adjustment: 500,
      cogs_reversed: 200,
      gross_profit: 5500,
      gross_profit_margin: 55,
      cogs_incomplete: true,
      transaction_count: 4,
    });
    expect(metrics.netSales).toBe(10000);
    expect(metrics.productNetSales).toBe(8500);
    expect(metrics.nonProductNet).toBe(1500);
    expect(metrics.cogs).toBe(4000);
    expect(metrics.cogsAdjustment).toBe(500);
    expect(metrics.cogsReversed).toBe(200);
    expect(metrics.grossProfit).toBe(5500);
    expect(metrics.grossProfitMargin).toBe(55);
    expect(metrics.cogsIncomplete).toBe(true);
  });

  it("derives margin 0 when net sales is 0", () => {
    const metrics = normalizeGrossProfitMetrics({
      net_sales: 0,
      cogs: 0,
      gross_profit: 0,
    });
    expect(metrics.grossProfitMargin).toBe(0);
  });

  it("computes gross profit from net - cogs - adjustment when missing", () => {
    const metrics = normalizeGrossProfitMetrics({
      net_sales: 8000,
      cogs: 3000,
      cogs_adjustment: 500,
    });
    expect(metrics.grossProfit).toBe(4500);
    expect(metrics.grossProfitMargin).toBe(56.25);
  });
});

import { describe, expect, it } from "vitest";
import {
  normalizeGrossProfitNonProductRows,
  sumNonProductBreakdownNet,
  sumNonProductBreakdownQty,
} from "./computeGrossProfitNonProductDisplay";

describe("normalizeGrossProfitNonProductRows", () => {
  it("maps RPC rows including service vs custom kind", () => {
    const rows = normalizeGrossProfitNonProductRows([
      {
        service_id: "3557bd3f-8223-484f-a36a-8023b9396798",
        line_name: "etix",
        sub_name: "test",
        line_kind: "service",
        qty: 8,
        net_sales: 400000,
      },
      {
        service_id: null,
        line_name: "Custom amount",
        sub_name: null,
        line_kind: "custom",
        qty: 1,
        net_sales: 50000,
      },
    ]);
    expect(rows[0].lineKind).toBe("service");
    expect(rows[0].subName).toBe("test");
    expect(rows[1].lineKind).toBe("custom");
  });
});

describe("sumNonProductBreakdownNet", () => {
  it("sums net sales across breakdown rows", () => {
    const total = sumNonProductBreakdownNet([
      {
        serviceId: null,
        lineName: "A",
        subName: null,
        lineKind: "custom",
        qty: 1,
        netSales: 400000,
      },
      {
        serviceId: "x",
        lineName: "B",
        subName: null,
        lineKind: "service",
        qty: 2,
        netSales: 100000,
      },
    ]);
    expect(total).toBe(500000);
  });
});

describe("sumNonProductBreakdownQty", () => {
  it("sums qty across breakdown rows", () => {
    expect(
      sumNonProductBreakdownQty([
        {
          serviceId: "x",
          lineName: "etix",
          subName: "test",
          lineKind: "service",
          qty: 8,
          netSales: 400000,
        },
        {
          serviceId: null,
          lineName: "Custom",
          subName: null,
          lineKind: "custom",
          qty: 2,
          netSales: 50000,
        },
      ]),
    ).toBe(10);
  });
});

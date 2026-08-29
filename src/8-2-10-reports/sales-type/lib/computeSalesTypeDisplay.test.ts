import { describe, expect, it } from "vitest";
import {
  buildSalesTypeDisplay,
  filterSalesTypesForOutlet,
  mergeSalesTypeReport,
  sortSalesTypeRows,
} from "./computeSalesTypeDisplay";
import type { SalesTypeConfig } from "./salesTypeTypes";

const CONFIG: SalesTypeConfig[] = [
  {
    id: "t1",
    name: "Dine In",
    sortOrder: 10,
    isActive: true,
    outletIds: ["out1"],
  },
  {
    id: "t2",
    name: "Take Away",
    sortOrder: 20,
    isActive: true,
    outletIds: ["out1"],
  },
  {
    id: "t3",
    name: "Inactive",
    sortOrder: 30,
    isActive: false,
    outletIds: ["out1"],
  },
];

describe("filterSalesTypesForOutlet", () => {
  it("returns all configs when outlet is null", () => {
    expect(filterSalesTypesForOutlet(CONFIG, null)).toHaveLength(3);
  });

  it("filters by outlet assignment", () => {
    const filtered = filterSalesTypesForOutlet(
      [
        ...CONFIG,
        { id: "t4", name: "Other Outlet", sortOrder: 40, isActive: true, outletIds: ["out2"] },
      ],
      "out1",
    );
    expect(filtered.map((c) => c.id)).toEqual(["t1", "t2", "t3"]);
  });
});

describe("buildSalesTypeDisplay", () => {
  it("includes zero rows for active types without sales", () => {
    const display = buildSalesTypeDisplay({
      configs: CONFIG,
      reportRows: [
        {
          salesTypeId: "t1",
          salesTypeName: "Dine In",
          sortOrder: 10,
          transactionCount: 5,
          grossSales: 100000,
          netSales: 90000,
          totalCollected: 110000,
          isUnassigned: false,
        },
      ],
      summaryGrossSales: 100000,
      summaryNetSales: 90000,
      summaryTransactionCount: 5,
      summaryTotalCollected: 110000,
      unassignedLabel: "Unassigned",
    });
    expect(display.rows.find((r) => r.salesTypeId === "t2")?.transactionCount).toBe(0);
    expect(display.matchesSummary).toBe(true);
  });

  it("flags mismatch when grand total differs from summary", () => {
    const display = mergeSalesTypeReport(
      CONFIG,
      [
        {
          sales_type_id: "t1",
          sales_type_name: "Dine In",
          sort_order: 10,
          transaction_count: 1,
          gross_sales: 100,
          net_sales: 80,
          total_collected: 100,
          summary_gross_sales: 200,
          summary_net_sales: 160,
          summary_transaction_count: 2,
          summary_total_collected: 200,
        },
      ],
      "Unassigned",
    );
    expect(display.matchesSummary).toBe(false);
  });
});

describe("sortSalesTypeRows", () => {
  it("sorts by net sales descending", () => {
    const rows = sortSalesTypeRows(
      [
        {
          salesTypeId: "a",
          salesTypeName: "A",
          sortOrder: 1,
          transactionCount: 1,
          grossSales: 50,
          netSales: 40,
          totalCollected: 50,
          isUnassigned: false,
        },
        {
          salesTypeId: "b",
          salesTypeName: "B",
          sortOrder: 2,
          transactionCount: 2,
          grossSales: 100,
          netSales: 90,
          totalCollected: 100,
          isUnassigned: false,
        },
      ],
      "netSales",
      "desc",
    );
    expect(rows[0].salesTypeId).toBe("b");
  });
});

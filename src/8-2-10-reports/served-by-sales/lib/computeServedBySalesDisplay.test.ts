import { describe, expect, it } from "vitest";
import {
  buildServedBySalesDisplay,
  serverKey,
  sortServedByServers,
} from "./computeServedBySalesDisplay";

describe("buildServedBySalesDisplay", () => {
  const serverRows = [
    {
      server_user_id: "user-a",
      server_name: "Alice",
      employee_id: "emp-a",
      transaction_count: 3,
      gross_sales: 165_000,
      net_sales: 150_000,
      summary_gross_sales: 220_000,
      summary_net_sales: 200_000,
      summary_transaction_count: 4,
    },
    {
      server_user_id: null,
      server_name: "Unknown Server",
      employee_id: null,
      transaction_count: 1,
      gross_sales: 55_000,
      net_sales: 50_000,
      summary_gross_sales: 220_000,
      summary_net_sales: 200_000,
      summary_transaction_count: 4,
    },
  ];

  const salesTypeRows = [
    {
      server_user_id: "user-a",
      catalog_sales_type_id: "st-dine",
      sales_type_name: "Dine in",
      transaction_count: 2,
      gross_sales: 110_000,
      net_sales: 100_000,
    },
    {
      server_user_id: "user-a",
      catalog_sales_type_id: "st-take",
      sales_type_name: "Takeaway",
      transaction_count: 1,
      gross_sales: 55_000,
      net_sales: 50_000,
    },
    {
      server_user_id: null,
      catalog_sales_type_id: null,
      sales_type_name: "Unknown",
      transaction_count: 1,
      gross_sales: 55_000,
      net_sales: 50_000,
    },
  ];

  it("merges server and sales type rows", () => {
    const display = buildServedBySalesDisplay({
      serverRowsRaw: serverRows,
      salesTypeRowsRaw: salesTypeRows,
      unknownServerLabel: "Unknown Server",
    });
    expect(display.servers).toHaveLength(2);
    expect(display.servers[0]?.serverName).toBe("Alice");
    expect(display.servers[0]?.salesTypes).toHaveLength(2);
    expect(display.grandTotal.netSales).toBe(200_000);
    expect(display.grandTotal.grossSales).toBe(220_000);
    expect(display.matchesSummaryNet).toBe(true);
    expect(display.matchesSummaryGross).toBe(true);
  });

  it("handles unknown server bucket", () => {
    const display = buildServedBySalesDisplay({
      serverRowsRaw: [serverRows[1]!],
      salesTypeRowsRaw: salesTypeRows.filter((r) => r.server_user_id == null),
      unknownServerLabel: "Unknown Server",
    });
    expect(display.servers[0]?.serverUserId).toBeNull();
    expect(display.servers[0]?.serverName).toBe("Unknown Server");
  });

  it("returns empty display when no server rows", () => {
    const display = buildServedBySalesDisplay({
      serverRowsRaw: [],
      salesTypeRowsRaw: [],
      unknownServerLabel: "Unknown Server",
    });
    expect(display.servers).toEqual([]);
    expect(display.grandTotal.netSales).toBe(0);
  });

  it("sales type children sum to parent net for alice", () => {
    const display = buildServedBySalesDisplay({
      serverRowsRaw: [serverRows[0]!],
      salesTypeRowsRaw: salesTypeRows.filter((r) => r.server_user_id === "user-a"),
      unknownServerLabel: "Unknown Server",
    });
    const block = display.servers[0]!;
    const childNet = block.salesTypes.reduce((sum, row) => sum + row.netSales, 0);
    expect(childNet).toBe(block.netSales);
  });
});

describe("sortServedByServers", () => {
  const servers = buildServedBySalesDisplay({
    serverRowsRaw: [
      {
        server_user_id: "user-a",
        server_name: "Alice",
        transaction_count: 1,
        gross_sales: 55_000,
        net_sales: 50_000,
        summary_gross_sales: 150_000,
        summary_net_sales: 150_000,
        summary_transaction_count: 2,
      },
      {
        server_user_id: "user-b",
        server_name: "Bob",
        transaction_count: 1,
        gross_sales: 110_000,
        net_sales: 100_000,
        summary_gross_sales: 150_000,
        summary_net_sales: 150_000,
        summary_transaction_count: 2,
      },
    ],
    salesTypeRowsRaw: [],
    unknownServerLabel: "Unknown Server",
  }).servers;

  it("sorts by net sales descending", () => {
    const sorted = sortServedByServers(servers, "netSales", "desc");
    expect(sorted[0]?.serverName).toBe("Bob");
  });
});

describe("serverKey", () => {
  it("uses sentinel for null user id", () => {
    expect(serverKey(null)).toBe("__unknown__");
  });
});

import { describe, expect, it } from "vitest";
import {
  buildCollectedBySalesDisplay,
  collectorKey,
  sortCollectedByStaff,
} from "./computeCollectedBySalesDisplay";

describe("buildCollectedBySalesDisplay", () => {
  const staffRows = [
    {
      collector_user_id: "user-a",
      collector_name: "Alice",
      employee_id: "emp-a",
      transaction_count: 3,
      total_collected: 150_000,
      summary_total_collected: 200_000,
      summary_transaction_count: 4,
    },
    {
      collector_user_id: "user-b",
      collector_name: "Bob",
      employee_id: null,
      transaction_count: 1,
      total_collected: 50_000,
      summary_total_collected: 200_000,
      summary_transaction_count: 4,
    },
  ];

  const paymentRows = [
    {
      collector_user_id: "user-a",
      payment_kind: "cash",
      transaction_count: 2,
      total_collected: 100_000,
    },
    {
      collector_user_id: "user-a",
      payment_kind: "non_cash",
      transaction_count: 1,
      total_collected: 50_000,
    },
    {
      collector_user_id: "user-b",
      payment_kind: "cash",
      transaction_count: 1,
      total_collected: 50_000,
    },
  ];

  it("merges staff and payment rows", () => {
    const display = buildCollectedBySalesDisplay({
      staffRowsRaw: staffRows,
      paymentRowsRaw: paymentRows,
      unknownStaffLabel: "Unknown Staff",
    });
    expect(display.staff).toHaveLength(2);
    expect(display.staff[0]?.collectorName).toBe("Alice");
    expect(display.staff[0]?.payments).toHaveLength(2);
    expect(display.staff[0]?.payments[0]?.totalCollected).toBe(100_000);
    expect(display.grandTotal.totalCollected).toBe(200_000);
    expect(display.matchesSummary).toBe(true);
  });

  it("fills missing payment kinds with zero rows", () => {
    const display = buildCollectedBySalesDisplay({
      staffRowsRaw: [staffRows[1]!],
      paymentRowsRaw: paymentRows.filter((r) => r.collector_user_id === "user-b"),
      unknownStaffLabel: "Unknown Staff",
    });
    expect(display.staff[0]?.payments.find((p) => p.paymentKind === "non_cash")).toEqual({
      paymentKind: "non_cash",
      transactionCount: 0,
      totalCollected: 0,
    });
  });

  it("returns empty display when no staff rows", () => {
    const display = buildCollectedBySalesDisplay({
      staffRowsRaw: [],
      paymentRowsRaw: [],
      unknownStaffLabel: "Unknown Staff",
    });
    expect(display.staff).toEqual([]);
    expect(display.grandTotal.totalCollected).toBe(0);
  });
});

describe("sortCollectedByStaff", () => {
  const staff = buildCollectedBySalesDisplay({
    staffRowsRaw: [
      {
        collector_user_id: "user-a",
        collector_name: "Alice",
        transaction_count: 1,
        total_collected: 50_000,
        summary_total_collected: 150_000,
        summary_transaction_count: 2,
      },
      {
        collector_user_id: "user-b",
        collector_name: "Bob",
        transaction_count: 1,
        total_collected: 100_000,
        summary_total_collected: 150_000,
        summary_transaction_count: 2,
      },
    ],
    paymentRowsRaw: [],
    unknownStaffLabel: "Unknown Staff",
  }).staff;

  it("sorts by total collected descending", () => {
    const sorted = sortCollectedByStaff(staff, "totalCollected", "desc");
    expect(sorted[0]?.collectorName).toBe("Bob");
  });
});

describe("collectorKey", () => {
  it("uses sentinel for null user id", () => {
    expect(collectorKey(null)).toBe("__unknown__");
  });
});

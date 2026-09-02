import { describe, expect, it } from "vitest";
import {
  isPaySuccessNewTransactionBlocked,
  paySuccessTablePickState,
} from "./paySuccessTablePick";

describe("paySuccessTablePickState", () => {
  it("requires a table pick for dine-in pay-first without a table", () => {
    expect(
      paySuccessTablePickState({
        salesTypeLabel: "Dine in",
        hadOpenSessionBeforePay: false,
        posTableId: null,
        sessionId: "sess-1",
      }),
    ).toEqual({ needsTablePick: true, tableLabel: null });
  });

  it("does not require a pick for Takeaway", () => {
    expect(
      paySuccessTablePickState({
        salesTypeLabel: "Takeaway",
        hadOpenSessionBeforePay: false,
        posTableId: null,
        sessionId: "sess-1",
      }),
    ).toEqual({ needsTablePick: false, tableLabel: null });
  });

  it("does not require a pick when paying an existing open bill", () => {
    expect(
      paySuccessTablePickState({
        salesTypeLabel: "Dine in",
        hadOpenSessionBeforePay: true,
        posTableId: "t5",
        sessionId: "sess-open",
        tableName: "Meja 5",
      }),
    ).toEqual({ needsTablePick: false, tableLabel: "Meja 5" });
  });
});

describe("isPaySuccessNewTransactionBlocked", () => {
  it("blocks Transaksi Baru until a table is assigned", () => {
    expect(
      isPaySuccessNewTransactionBlocked({ needsTablePick: true, tableLabel: null }),
    ).toBe(true);
    expect(
      isPaySuccessNewTransactionBlocked({ needsTablePick: true, tableLabel: "Meja 5" }),
    ).toBe(false);
    expect(
      isPaySuccessNewTransactionBlocked({ needsTablePick: false, tableLabel: null }),
    ).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import {
  CLEAR_SEATED_FORBIDDEN_SIDE_EFFECTS,
  canPickTableForPayFirst,
  isPaidSeatingSession,
  planClearSeatedSessionUpdate,
} from "./isPaidSeatingSession";

describe("isPaidSeatingSession", () => {
  it("is true for an open session with a sales activity (pay-first seating)", () => {
    expect(
      isPaidSeatingSession({
        status: "open",
        sales_activity_id: "act-1",
      }),
    ).toBe(true);
  });

  it("is false for an unpaid open bill", () => {
    expect(
      isPaidSeatingSession({
        status: "open",
        sales_activity_id: null,
      }),
    ).toBe(false);
  });

  it("is false after the session is closed paid", () => {
    expect(
      isPaidSeatingSession({
        status: "paid",
        sales_activity_id: "act-1",
      }),
    ).toBe(false);
  });
});

describe("canPickTableForPayFirst", () => {
  it("allows empty and partial tables and blocks full tables", () => {
    expect(canPickTableForPayFirst({ state: "empty" })).toBe(true);
    expect(canPickTableForPayFirst({ state: "partial" })).toBe(true);
    expect(canPickTableForPayFirst({ state: "full" })).toBe(false);
  });
});

describe("planClearSeatedSessionUpdate", () => {
  it("closes open seating to paid without refund or kitchen/stock side effects", () => {
    expect(
      planClearSeatedSessionUpdate({
        nowIso: "2026-08-30T13:00:00.000Z",
        closedBy: "waiter-1",
      }),
    ).toEqual({
      status: "paid",
      closed_at: "2026-08-30T13:00:00.000Z",
      closed_by: "waiter-1",
    });
    expect(CLEAR_SEATED_FORBIDDEN_SIDE_EFFECTS).toEqual([
      "cancelSessionStockByPolicy",
      "markKitchenTicketsDoneForSession",
      "refundSalesActivity",
    ]);
  });
});

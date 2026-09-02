import { describe, expect, it } from "vitest";
import {
  planPayFirstSessionInsert,
  shouldKeepPayFirstSessionOpen,
} from "./planPayFirstSessionInsert";

describe("shouldKeepPayFirstSessionOpen", () => {
  it("keeps Dine in pay-first open when there is no existing session", () => {
    expect(
      shouldKeepPayFirstSessionOpen({
        existingSessionId: null,
        salesTypeLabel: "Dine in",
      }),
    ).toBe(true);
  });

  it("closes Takeaway pay-first as paid", () => {
    expect(
      shouldKeepPayFirstSessionOpen({
        existingSessionId: null,
        salesTypeLabel: "Takeaway",
      }),
    ).toBe(false);
  });

  it("does not keep open when the bill was already seated (pay later)", () => {
    expect(
      shouldKeepPayFirstSessionOpen({
        existingSessionId: "sess-open",
        salesTypeLabel: "Dine in",
      }),
    ).toBe(false);
  });
});

describe("planPayFirstSessionInsert", () => {
  it("inserts an OPEN empty-cart session when keepOpen", () => {
    expect(
      planPayFirstSessionInsert({
        keepOpen: true,
        nowIso: "2026-08-30T12:00:00.000Z",
        closedBy: "user-1",
      }),
    ).toEqual({
      status: "open",
      closed_at: null,
      closed_by: null,
      cart_snapshot: [],
      pax: 1,
    });
  });

  it("inserts a paid closed session for Takeaway / default", () => {
    expect(
      planPayFirstSessionInsert({
        keepOpen: false,
        nowIso: "2026-08-30T12:00:00.000Z",
        closedBy: "user-1",
      }),
    ).toEqual({
      status: "paid",
      closed_at: "2026-08-30T12:00:00.000Z",
      closed_by: "user-1",
      cart_snapshot: [],
      pax: 1,
    });
  });
});

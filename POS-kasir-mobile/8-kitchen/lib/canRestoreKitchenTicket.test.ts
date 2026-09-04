import { describe, expect, it } from "vitest";
import { POS_KITCHEN_RECALL_WINDOW_MS } from "./partitionKitchenDoneBoards";
import {
  assertKitchenTicketInRecallWindow,
  isKitchenTicketInRecallWindow,
  KITCHEN_RESTORE_WINDOW_EXPIRED,
} from "./canRestoreKitchenTicket";

describe("isKitchenTicketInRecallWindow", () => {
  const now = Date.parse("2026-08-30T12:00:00.000Z");

  it("allows a ticket completed 14 minutes 59 seconds ago", () => {
    expect(
      isKitchenTicketInRecallWindow(
        {
          status: "done",
          completed_at: new Date(now - (15 * 60 * 1000 - 1000)).toISOString(),
        },
        now,
      ),
    ).toBe(true);
  });

  it("rejects a ticket completed 15 minutes 1 second ago", () => {
    expect(
      isKitchenTicketInRecallWindow(
        {
          status: "done",
          completed_at: new Date(now - (POS_KITCHEN_RECALL_WINDOW_MS + 1000)).toISOString(),
        },
        now,
      ),
    ).toBe(false);
  });

  it("allows a ticket completed exactly at the window boundary", () => {
    expect(
      isKitchenTicketInRecallWindow(
        {
          status: "done",
          completed_at: new Date(now - POS_KITCHEN_RECALL_WINDOW_MS).toISOString(),
        },
        now,
      ),
    ).toBe(true);
  });

  it("rejects missing completed_at or non-done status", () => {
    expect(
      isKitchenTicketInRecallWindow({ status: "done", completed_at: null }, now),
    ).toBe(false);
    expect(
      isKitchenTicketInRecallWindow(
        {
          status: "in_progress",
          completed_at: new Date(now - 1000).toISOString(),
        },
        now,
      ),
    ).toBe(false);
  });

  it("assertKitchenTicketInRecallWindow throws the expired code", () => {
    expect(() =>
      assertKitchenTicketInRecallWindow(
        {
          status: "done",
          completed_at: new Date(now - POS_KITCHEN_RECALL_WINDOW_MS - 1).toISOString(),
        },
        now,
      ),
    ).toThrow(KITCHEN_RESTORE_WINDOW_EXPIRED);
  });
});

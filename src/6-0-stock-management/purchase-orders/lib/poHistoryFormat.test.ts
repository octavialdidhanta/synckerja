import { describe, expect, it } from "vitest";
import {
  groupPoHistoryByDate,
  poEventActionKey,
  poEventDefaultAction,
} from "./poHistoryFormat";
import type { PurchaseOrderEvent } from "../types";

describe("poHistoryFormat", () => {
  it("groups events by date descending", () => {
    const events: PurchaseOrderEvent[] = [
      {
        id: "1",
        eventType: "created",
        actorName: "A",
        comment: "note",
        occurredAt: "2026-08-20T08:00:00.000Z",
      },
      {
        id: "2",
        eventType: "fulfilled",
        actorName: "A",
        comment: null,
        occurredAt: "2026-08-19T10:00:00.000Z",
      },
    ];
    const groups = groupPoHistoryByDate(events, { today: "Today", yesterday: "Yesterday" });
    expect(groups.length).toBe(2);
    expect(groups[0].events[0].id).toBe("1");
    expect(groups[1].events[0].id).toBe("2");
  });

  it("maps event action keys", () => {
    expect(poEventActionKey("created")).toContain("created");
    expect(poEventDefaultAction("fulfilled")).toMatch(/fulfilled/i);
  });
});

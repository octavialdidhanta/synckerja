import { describe, expect, it } from "vitest";
import {
  isKitchenChecklistLocked,
  kitchenLinesAllDoneAfterToggle,
} from "./kitchenTicketMeta";
import { canClickKitchenAdvance } from "./kitchenTicketStatus";

describe("kitchenLinesAllDoneAfterToggle", () => {
  const lines = [
    { id: "a", is_done: false },
    { id: "b", is_done: true },
  ];

  it("returns false for empty lines", () => {
    expect(kitchenLinesAllDoneAfterToggle([], "a", true)).toBe(false);
  });

  it("returns true when the only line is checked", () => {
    expect(kitchenLinesAllDoneAfterToggle([{ id: "a", is_done: false }], "a", true)).toBe(true);
  });

  it("returns true when the last unchecked line is checked", () => {
    expect(kitchenLinesAllDoneAfterToggle(lines, "a", true)).toBe(true);
  });

  it("returns false when another line remains unchecked", () => {
    expect(
      kitchenLinesAllDoneAfterToggle(
        [
          { id: "a", is_done: false },
          { id: "b", is_done: false },
        ],
        "a",
        true,
      ),
    ).toBe(false);
  });
});

describe("isKitchenChecklistLocked", () => {
  it("locks new tickets on the active board", () => {
    expect(isKitchenChecklistLocked("new")).toBe(true);
  });

  it("unlocks in_progress and ready on the active board", () => {
    expect(isKitchenChecklistLocked("in_progress")).toBe(false);
    expect(isKitchenChecklistLocked("ready")).toBe(false);
  });

  it("stays unlocked in recall even for done tickets", () => {
    expect(isKitchenChecklistLocked("done", { showRecall: true, readOnly: true })).toBe(false);
  });
});

describe("canClickKitchenAdvance", () => {
  it("allows Start on new", () => {
    expect(canClickKitchenAdvance("new", [{ is_done: false }])).toBe(true);
  });

  it("blocks In-Progress click when lines exist", () => {
    expect(canClickKitchenAdvance("in_progress", [{ is_done: false }])).toBe(false);
  });

  it("allows In-Progress advance when there are no lines", () => {
    expect(canClickKitchenAdvance("in_progress", [])).toBe(true);
  });

  it("allows Done only when all lines are checked", () => {
    expect(canClickKitchenAdvance("ready", [{ is_done: true }])).toBe(true);
    expect(canClickKitchenAdvance("ready", [{ is_done: false }])).toBe(false);
  });
});

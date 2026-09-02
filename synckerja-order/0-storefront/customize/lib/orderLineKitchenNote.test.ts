import { describe, expect, it } from "vitest";
import { sanitizeKitchenNote, kitchenNoteFingerprint, ORDER_KITCHEN_NOTE_MAX } from "./orderLineKitchenNote";

describe("sanitizeKitchenNote", () => {
  it("trims, strips tags, and collapses space", () => {
    expect(sanitizeKitchenNote("  <b>kurang es</b>  please  ")).toBe("kurang es please");
  });

  it("returns null for empty after sanitize", () => {
    expect(sanitizeKitchenNote("   ")).toBeNull();
    expect(sanitizeKitchenNote("<p></p>")).toBeNull();
    expect(sanitizeKitchenNote(null)).toBeNull();
  });

  it("caps at 200 characters", () => {
    const note = sanitizeKitchenNote("a".repeat(250));
    expect(note).toHaveLength(ORDER_KITCHEN_NOTE_MAX);
  });

  it("fingerprints equivalent notes the same", () => {
    expect(kitchenNoteFingerprint("  Kurang   es ")).toBe(kitchenNoteFingerprint("Kurang es"));
  });
});

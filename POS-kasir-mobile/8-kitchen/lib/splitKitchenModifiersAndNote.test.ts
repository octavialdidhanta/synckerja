import { describe, expect, it } from "vitest";
import { splitKitchenModifiersAndNote } from "./splitKitchenModifiersAndNote";

describe("splitKitchenModifiersAndNote", () => {
  it("returns note-only when text is just Catatan", () => {
    expect(
      splitKitchenModifiersAndNote(
        "Catatan: jangan pakai cabe tambahin kuah nya",
      ),
    ).toEqual({
      modifiers: null,
      note: "jangan pakai cabe tambahin kuah nya",
    });
  });

  it("splits mods and note joined with middle dot", () => {
    expect(
      splitKitchenModifiersAndNote("Pedas · Extra telur · Catatan: kurang es"),
    ).toEqual({
      modifiers: "Pedas · Extra telur",
      note: "kurang es",
    });
  });

  it("returns modifiers only when no note marker", () => {
    expect(splitKitchenModifiersAndNote("Pedas · Extra telur")).toEqual({
      modifiers: "Pedas · Extra telur",
      note: null,
    });
  });
});

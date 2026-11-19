import { describe, expect, it } from "vitest";
import { diffHasChanges, diffLines, voiceOverFromConcept } from "./briefVersionDiff";

describe("diffLines", () => {
  it("marks an edited line and keeps the surrounding lines", () => {
    const lines = diffLines("Slide 1\nVO lama\nCTA", "Slide 1\nVO baru\nCTA");
    expect(lines).toEqual([
      { kind: "same", text: "Slide 1" },
      { kind: "remove", text: "VO lama" },
      { kind: "add", text: "VO baru" },
      { kind: "same", text: "CTA" },
    ]);
    expect(diffHasChanges(lines)).toBe(true);
  });

  it("reports no change for the same text", () => {
    const lines = diffLines("sama", "sama");
    expect(diffHasChanges(lines)).toBe(false);
  });
});

describe("voiceOverFromConcept", () => {
  it("reads the voice over field from concept JSON", () => {
    expect(voiceOverFromConcept('{"v":1,"voiceOver":"Dengarkan dulu.","locations":[]}')).toBe("Dengarkan dulu.");
  });

  it("returns empty text when the concept has no voice over", () => {
    expect(voiceOverFromConcept("")).toBe("");
    expect(voiceOverFromConcept("bukan json")).toBe("");
  });
});

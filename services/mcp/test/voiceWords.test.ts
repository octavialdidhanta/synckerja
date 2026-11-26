import { describe, expect, it } from "vitest";
import { parseWordTimings } from "../src/db/briefVoice";

describe("stored VO word timings", () => {
  it("keeps valid words and drops broken entries", () => {
    expect(
      parseWordTimings([
        { text: "Sruput", start: 0.12, end: 0.55 },
        { text: "dulu", start: "0.6", end: 0.8 },
        { text: 5, start: 1, end: 2 },
        { text: "x", start: "a", end: 1 },
      ]),
    ).toEqual([
      { text: "Sruput", start: 0.12, end: 0.55 },
      { text: "dulu", start: 0.6, end: 0.8 },
    ]);
  });

  it("is null for older clips", () => {
    expect(parseWordTimings(null)).toBeNull();
    expect(parseWordTimings([])).toBeNull();
  });
});

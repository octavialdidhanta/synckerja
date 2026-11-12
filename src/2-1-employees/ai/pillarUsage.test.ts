import { describe, expect, it } from "vitest";
import { jakartaMonthRange, summarizePillarUsage } from "./pillarUsage";

describe("jakartaMonthRange", () => {
  it("uses the Jakarta month, not the UTC month", () => {
    // 31 Oct 18:00 UTC is already 1 Nov 01:00 in Jakarta.
    expect(jakartaMonthRange(new Date("2026-10-31T18:00:00Z"))).toEqual({
      start: "2026-10-31T17:00:00.000Z",
      end: "2026-11-30T17:00:00.000Z",
    });
  });

  it("rolls over December", () => {
    expect(jakartaMonthRange(new Date("2026-12-15T05:00:00Z"))).toEqual({
      start: "2026-11-30T17:00:00.000Z",
      end: "2026-12-31T17:00:00.000Z",
    });
  });
});

describe("summarizePillarUsage", () => {
  it("counts plans per pillar and keeps up to 3 titles", () => {
    const usage = summarizePillarUsage([
      { content_pillar_id: "a", title: "Satu" },
      { content_pillar_id: "a", title: "  Dua  " },
      { content_pillar_id: "a", title: "Tiga" },
      { content_pillar_id: "a", title: "Empat" },
      { content_pillar_id: "b", title: null },
      { content_pillar_id: null, title: "Tanpa pilar" },
    ]);
    expect(usage.a).toEqual({ count: 4, titles: ["Satu", "Dua", "Tiga"] });
    expect(usage.b).toEqual({ count: 1, titles: [] });
    expect(Object.keys(usage)).toEqual(["a", "b"]);
  });
});

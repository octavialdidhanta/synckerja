import { describe, expect, it } from "vitest";
import { applyBriefPatch, type StoredBriefText } from "../src/tools/content/briefPatch";

const shotId = "11111111-1111-4111-8111-111111111111";

const stored: StoredBriefText = {
  brief: [
    "| Timing | Visual | VO (Voice Over) | Scene Visual | Element Lainnya | Tagging |",
    "| --- | --- | --- | --- | --- | --- |",
    "| Slide 1 | ![a](storage/x.png) | Halo | meja |  |  |",
    "",
    "<!--synckerja-brief-sequences:[{\"id\":\"abc\",\"name\":\"Hook\",\"rowCount\":1}]-->",
  ].join("\n"),
  concept: JSON.stringify({
    v: 1,
    voiceOver: "Halo",
    locations: [{ handle: "@location_dapur", description: "dapur" }],
  }),
  caption: "caption",
  link: "https://example.com",
  shots: [{ id: shotId, rowIndex: 0 }],
};

describe("applyBriefPatch", () => {
  it("lists one changed storyboard cell and leaves the image and sequence comment", () => {
    const next = applyBriefPatch(stored, { shots: [{ shotId, vo: "Hai" }] });
    expect(next.changes).toEqual([
      { field: "storyboard", shot_id: shotId, column: "vo", before: "Halo", after: "Hai" },
    ]);
    expect(next.brief).toContain("| Hai |");
    expect(next.brief).toContain("![a](storage/x.png)");
    expect(next.brief).toContain("synckerja-brief-sequences");
    expect(next.brief).toContain("| meja |");
    expect(next.link).toBe(stored.link);
  });

  it("lists a voice over change and a caption change", () => {
    const next = applyBriefPatch(stored, { voiceOver: "Hai", caption: "caption baru" });
    expect(next.changes.map((change) => change.field)).toEqual(["concept", "caption"]);
    expect(JSON.parse(next.concept)).toMatchObject({
      voiceOver: "Hai",
      locations: [{ handle: "@location_dapur", description: "dapur" }],
    });
    expect(next.caption).toBe("caption baru");
    expect(next.brief).toBe(stored.brief);
  });

  it("lists nothing when the text is the same", () => {
    const next = applyBriefPatch(stored, {
      shots: [{ shotId, vo: "Halo" }],
      voiceOver: "Halo",
      caption: "caption",
    });
    expect(next.changes).toEqual([]);
    expect(next.brief).toBe(stored.brief);
    expect(next.concept).toBe(stored.concept);
    expect(next.caption).toBe(stored.caption);
  });

  it("ignores spaces at the edges", () => {
    const next = applyBriefPatch(stored, {
      shots: [{ shotId, vo: "  Halo  " }],
      voiceOver: " Halo ",
      caption: " caption ",
    });
    expect(next.changes).toEqual([]);
    expect(next.brief).toBe(stored.brief);
    expect(next.concept).toBe(stored.concept);
    expect(next.caption).toBe(stored.caption);
  });

  it("rejects a shot id that is not on the brief", () => {
    expect(() => applyBriefPatch(stored, {
      shots: [{ shotId: "22222222-2222-4222-8222-222222222222", vo: "Hai" }],
    })).toThrow("invalid_input");
  });
});

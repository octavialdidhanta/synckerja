import { describe, expect, it } from "vitest";
import { isCarouselContentBrief, toCarouselStoryboardTable } from "./briefStoryboardConstants";

describe("carousel storyboard columns", () => {
  it("moves on-slide copy out of the voice-over column", () => {
    const table = toCarouselStoryboardTable([
      ["Timing", "Visual", "VO (Voice Over)", "Scene Visual", "Element Lainnya", "Tagging"],
      [
        "Slide 1",
        "",
        "Sibuk merencanakan masa depan anak.",
        "Ibu dan anak duduk di sofa.",
        "Hook headline: Visi Masa Depan. Visual hook: Buku rencana. Referensi 1",
        "",
      ],
    ]);
    expect(table[0]).toEqual(["Timing", "Visual", "Scene Visual", "Teks", "Element Lainnya", "Tagging"]);
    expect(table[0]).not.toContain("VO (Voice Over)");
    expect(table[1]).toEqual([
      "Slide 1",
      "",
      "Ibu dan anak duduk di sofa.",
      "Sibuk merencanakan masa depan anak.",
      "Hook headline: Visi Masa Depan. Visual hook: Buku rencana. Referensi 1",
      "",
    ]);
  });

  it("keeps a table that is already a carousel board", () => {
    const ready = [
      ["Timing", "Visual", "Scene Visual", "Teks", "Element Lainnya", "Tagging"],
      ["Slide 1", "", "Ibu di sofa.", "Teks di gambar.", "Hook headline: Berhenti.", ""],
    ];
    expect(toCarouselStoryboardTable(ready)).toBe(ready);
  });

  it("recognizes a carousel plan from the content type or the sequence name", () => {
    expect(isCarouselContentBrief("Carousel")).toBe(true);
    expect(isCarouselContentBrief("carousel")).toBe(true);
    expect(isCarouselContentBrief("Reel")).toBe(false);
    expect(isCarouselContentBrief("", '<!--synckerja-brief-sequences:[{"name":"Carousel","rowCount":2}]-->')).toBe(true);
  });
});

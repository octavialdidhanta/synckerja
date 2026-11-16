import { describe, expect, it } from "vitest";
import { carouselSlideBriefFields } from "./carouselSlideBriefFields";

const BRIEF = `| Timing | Visual | Scene Visual | Teks | Element Lainnya | Tagging |
| --- | --- | --- | --- | --- | --- |
| Slide 1 |  | Scene satu | Teks satu | Elem satu |  |
| Slide 2 |  | Scene dua | Teks dua | Elem dua |  |
| Slide 3 |  | Scene tiga | Teks tiga | Elem tiga |  |
`;

describe("carouselSlideBriefFields", () => {
  it("reads slide 3 fields by Timing label", () => {
    expect(carouselSlideBriefFields(BRIEF, 3)).toEqual({
      timing: "Slide 3",
      sceneVisual: "Scene tiga",
      teks: "Teks tiga",
      elementLainnya: "Elem tiga",
    });
  });

  it("falls back to row index when Timing has no slide number", () => {
    const brief = `| Timing | Visual | Scene Visual | Teks | Element Lainnya | Tagging |
| --- | --- | --- | --- | --- | --- |
| Hook |  | A | B | C |  |
| Point |  | D | E | F |  |
`;
    expect(carouselSlideBriefFields(brief, 2)?.sceneVisual).toBe("D");
  });

  it("returns null for missing slide", () => {
    expect(carouselSlideBriefFields(BRIEF, 9)).toBeNull();
    expect(carouselSlideBriefFields("", 1)).toBeNull();
  });
});

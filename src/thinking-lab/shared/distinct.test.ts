import { describe, expect, it } from "vitest";
import { sameWording } from "@/thinking-lab/shared/distinct";

describe("sameWording", () => {
  it("treats the same words and a longer copy as one wording", () => {
    expect(sameWording("Diskusi kuliner", "kuliner diskusi")).toBe(true);
    expect(sameWording("Diskusi kuliner", "Diskusi kuliner malam")).toBe(true);
    expect(
      sameWording(
        "Dalam diskusi kuliner, seringkali keempukan menjadi satu-satunya tolok ukur kualitas, mengabaikan kompleksitas rasa yang sebenarnya.",
        "Dalam diskusi kuliner tentang daging kambing, seringkali keempukan menjadi satu-satunya tolok ukur kualitas, mengabaikan kompleksitas rasa yang sebenarnya.",
      ),
    ).toBe(true);
  });

  it("keeps neighboring names and different observations apart", () => {
    expect(sameWording("Jenis daging", "Potongan daging")).toBe(false);
    expect(sameWording("Pilihan sate", "Jenis daging")).toBe(false);
    expect(sameWording("Keempukan bukan rasa", "Pemula paling vokal")).toBe(false);
    expect(sameWording("A space", "Another space")).toBe(false);
  });
});

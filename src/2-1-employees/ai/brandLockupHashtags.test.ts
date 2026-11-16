import { describe, expect, it } from "vitest";
import { brandHashtagsValid, normalizeBrandHashtags } from "./brandLockupHashtags";

describe("normalizeBrandHashtags", () => {
  it("normalizes any count without requiring 3–5", () => {
    expect(normalizeBrandHashtags("#Satu dua #Tiga")).toEqual([
      "#Satu",
      "#dua",
      "#Tiga",
    ]);
    expect(normalizeBrandHashtags("#Satu #Dua #Tiga #Empat #Lima #Enam")).toEqual([
      "#Satu",
      "#Dua",
      "#Tiga",
      "#Empat",
      "#Lima",
      "#Enam",
    ]);
  });

  it("accepts empty and 1–2 tags; rejects garbage raw text", () => {
    expect(normalizeBrandHashtags("")).toEqual([]);
    expect(brandHashtagsValid([], "")).toBe(true);
    expect(brandHashtagsValid(normalizeBrandHashtags("#Satu #Dua"), "#Satu #Dua")).toBe(true);
    expect(brandHashtagsValid([], "!!!")).toBe(false);
  });
});

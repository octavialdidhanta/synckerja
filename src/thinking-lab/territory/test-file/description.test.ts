import { describe, expect, it } from "vitest";
import { territoryDescriptions } from "@/thinking-lab/territory/description";

describe("territory descriptions", () => {
  it("places the Big Thought reason inside the area where it is lived", () => {
    const copy = territoryDescriptions(
      "belanja bulanan di warung",
      "harga sembako naik dan uang belanja lebih cepat habis",
    );
    expect(copy.areaLead).toBe("Di area ini:");
    expect(copy.area).toBe(
      "di sini pertanyaan yang dijawab harga sembako naik dan uang belanja lebih cepat habis muncul langsung di belanja bulanan di warung.",
    );
    expect(copy.passLead).toBe("Lolos pemeriksaan.");
    expect(copy.pass).toBe(
      "belanja bulanan di warung menunjuk ruang konkret tempat alasan itu bisa dirasakan langsung, cukup luas untuk beberapa Angle.",
    );
  });

  it("uses the English frame when the territory and its reason are English", () => {
    const copy = territoryDescriptions("monthly market run", "prices rise faster than wages");
    expect(copy.areaLead).toBe("In this area:");
    expect(copy.area).toBe("the question answered by prices rise faster than wages shows up directly in monthly market run.");
    expect(copy.passLead).toBe("Passed review.");
    expect(copy.pass).toBe(
      "monthly market run names a concrete space where that reason can be felt directly, wide enough for several Angles.",
    );
  });

  it("does not invent a lived scene when the parent reason is empty", () => {
    const copy = territoryDescriptions("Pensiun Dini", "");
    expect(copy.area).toBe("");
    expect(copy.pass).not.toMatch(/ibu-ibu|hitung-hitungan|sembako/);
  });
});

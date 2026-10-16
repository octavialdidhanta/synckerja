import { describe, expect, it } from "vitest";
import { buildLocationImagePrompt, buildPropertyImagePrompt } from "@/6-1-dashboard/modal/locationImagePrompt";

const storyboard = [
  "| Timing | Visual | VO (Voice Over) | Shot | Angle | Visual function | Veo 3 prompt |",
  "| --- | --- | --- | --- | --- | --- | --- |",
  "|  |  | Dia hitung sisa tabungan. | Shot 1 — Main Shot | Wide | show the unpaid city | wide night view of @location_city_skyline, wet roads, one empty bus |",
  "|  |  |  | Shot 2 — Supporting Shot | Close-up | the bill | close-up of @property_bill on the table |",
].join("\n");

describe("location image prompt", () => {
  it("uses the idea and the shots for that location, not only the place label", () => {
    const prompt = buildLocationImagePrompt({
      handle: "@location_city_skyline",
      description: "A view of a modern city skyline.",
      aspect: "9:16",
      title: "Sisa tabungan",
      caption: "Satu bus kosong.",
      idea: "Menunda bayar membuat kota terasa makin jauh.",
      storyboard,
      concept: {
        locations: [
          { handle: "@location_city_skyline", description: "A view of a modern city skyline." },
          { handle: "@location_office_desk", description: "A home office desk setup." },
        ],
        characters: [{ handle: "@character_budi", description: "A young man, early 20s." }],
        properties: [{ handle: "@property_bill", description: "An unpaid paper bill." }],
      },
    });
    expect(prompt).toContain("Menunda bayar membuat kota terasa makin jauh.");
    expect(prompt).toContain("wet roads, one empty bus");
    expect(prompt).toContain("No split screen");
    expect(prompt).toContain("no people");
    expect(prompt).toContain("No graphic overlays");
    expect(prompt).toContain("@character_budi");
    expect(prompt).toContain("Dia hitung sisa tabungan.");
    expect(prompt).not.toContain("close-up of @property_bill");
  });

  it("builds a property still from the shot that uses it", () => {
    const prompt = buildPropertyImagePrompt({
      handle: "@property_bill",
      description: "An unpaid paper bill.",
      aspect: "4:5",
      title: "Sisa tabungan",
      caption: "Satu bus kosong.",
      idea: "Menunda bayar membuat kota terasa makin jauh.",
      storyboard,
      concept: {
        locations: [{ handle: "@location_city_skyline", description: "A view of a modern city skyline." }],
        characters: [{ handle: "@character_budi", description: "A young man, early 20s." }],
        properties: [{ handle: "@property_bill", description: "An unpaid paper bill." }],
      },
    });
    expect(prompt).toContain("pure white");
    expect(prompt).toContain("close-up of @property_bill");
    expect(prompt).toContain("Menunda bayar membuat kota terasa makin jauh.");
    expect(prompt).toContain("@location_city_skyline");
    expect(prompt).not.toContain("wet roads, one empty bus");
  });
});

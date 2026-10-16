import { describe, expect, it } from "vitest";
import { buildStoryboardShotPrompt, storyboardShotAspect } from "@/6-1-dashboard/lib/generateBriefSceneImage";

const headers = ["Timing", "Visual", "VO (Voice Over)", "Shot", "Angle", "Visual function", "Veo 3 prompt"];
const row = [
  "",
  "",
  "Budi dapat warisan kecil.",
  "Shot 1 — Main Shot",
  "Medium shot",
  "Introduce young Budi",
  "Medium shot of @character_budi_young in @location_apartment_living_room holding @property_bank_statement",
];

describe("storyboard shot prompt", () => {
  it("uses the angle, visual function, veo prompt, and the mentioned character", () => {
    const prompt = buildStoryboardShotPrompt({
      headers,
      row,
      imageColumnIndex: 1,
      hasPortrait: true,
      context: {
        title: "Warisan kecil",
        contentTypeName: "Reel",
        concept: {
          locations: [{ handle: "@location_apartment_living_room", description: "A cozy living room." }],
          characters: [{ handle: "@character_budi_young", description: "A young man, early 20s." }],
          properties: [{ handle: "@property_bank_statement", description: "A paper bank statement." }],
        },
      },
    });
    expect(prompt).toContain("Medium shot");
    expect(prompt).toContain("Introduce young Budi");
    expect(prompt).toContain("@character_budi_young");
    expect(prompt).toContain("A young man, early 20s.");
    expect(prompt).toContain("@location_apartment_living_room");
    expect(prompt).toContain("No split screen");
    expect(prompt).toContain("NO WRITING");
    expect(prompt).toContain("do not render");
    expect(storyboardShotAspect({ contentTypeName: "Reel" })).toBe("9:16");
  });
});

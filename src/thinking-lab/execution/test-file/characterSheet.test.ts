import { describe, expect, it } from "vitest";
import {
  buildCharacterPortraitPrompt,
  buildCharacterSheetPrompt,
  characterDisplayName,
  characterVisualPath,
} from "@/thinking-lab/execution/characterSheet";

describe("character sheet", () => {
  it("names the person from the handle and stores both images beside the execution", () => {
    expect(characterDisplayName("@character_budi_young")).toBe("Budi Young");
    const path = characterVisualPath(
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
      "@character_budi_young",
      "portrait",
      "jpg",
    );
    expect(path).toBe(
      "11111111-1111-4111-8111-111111111111/thinking-lab/22222222-2222-4222-8222-222222222222/character_budi_young-portrait.jpg",
    );
  });

  it("asks for one studio portrait and a sheet with the same views as the reference layout", () => {
    const portrait = buildCharacterPortraitPrompt("Budi Young", "A young man, early 20s, slightly hesitant.");
    expect(portrait).toContain("studio portrait");
    expect(portrait).toContain("Budi Young");
    expect(portrait).toContain("slightly hesitant");
    expect(portrait).toContain("No text");

    const sheet = buildCharacterSheetPrompt("Budi Young", "A young man, early 20s, slightly hesitant.");
    expect(sheet).toContain("KARAKTER UTAMA");
    expect(sheet).toContain("FULL BODY VIEW");
    expect(sheet).toContain("CLOSE UP DETAIL");
    expect(sheet).toContain("COLOR PALETTE");
    expect(sheet).toContain("FACIAL EXPRESSIONS");
    expect(sheet).toContain("FRONT VIEW");
    expect(sheet).toContain("PROFILE");
    expect(sheet).toContain("Do not invent bags");
    expect(sheet).toContain("Copy that exact face");
    expect(sheet).toContain("REAL photographed human");
    expect(sheet).toContain("FORBIDDEN");
    expect(sheet).toContain("cartoon");
    expect(sheet).toContain("Budi Young");
  });
});

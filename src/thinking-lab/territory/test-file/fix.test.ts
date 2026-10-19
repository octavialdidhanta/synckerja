import { describe, expect, it } from "vitest";
import {
  buildTerritoryFixOptionsPrompt,
  parseTerritoryFixOptions,
  parseTerritoryFixReplacements,
  territoryReplacementPasses,
} from "@/thinking-lab/territory/fix";
import type { TerritorySetFacts } from "@/thinking-lab/territory/types";

describe("territory fix", () => {
  it("keeps one replacement for each failed code", () => {
    const rows = parseTerritoryFixReplacements(
      {
        replacements: [
          { code: "tr03", statement: "A separate space" },
          { code: "TR01", statement: " " },
          { code: "TR09", statement: "Outside the failed set" },
        ],
      },
      ["TR01", "TR03", "TR04"],
    );
    expect(rows).toEqual([{ code: "TR03", statement: "A separate space" }]);
  });

  it("keeps up to three distinct repair options", () => {
    expect(parseTerritoryFixOptions({ statements: ["One space", "One space", " ", "Another space"] })).toEqual([
      "One space",
      "Another space",
    ]);
  });

  it("tells the next fix why the failed name already lost", () => {
    const prompt = buildTerritoryFixOptionsPrompt({
      parentStatement: "Produk yang memenuhi kebutuhan menaikkan penjualan, bukan hanya iklan.",
      failed: { code: "TR04", statement: "Kepuasan pelanggan" },
      keepers: [{ code: "TR03", statement: "Umpan balik pelanggan" }],
      conflicts: [],
      lessons: [
        {
          code: "TR04",
          statement: "Kepuasan pelanggan",
          reason: "TR03 · TR04: Kedua wilayah ini mengumpulkan masukan pelanggan.",
        },
      ],
      scope: {
        preserve: ["partOfBigThought", "audienceLanguage", "questionArises", "wideEnough"],
        repair: [{ id: "siblingsDistinct", reason: "TR03 · TR04: Kedua wilayah ini mengumpulkan masukan pelanggan." }],
      },
    });
    expect(prompt).toContain("TR04: Kepuasan pelanggan");
    expect(prompt).toContain("Why it failed: TR03 · TR04: Kedua wilayah ini mengumpulkan masukan pelanggan.");
    expect(prompt).toContain("A new name that fails for the same reason is still that mistake.");
    expect(prompt).toContain("Move only the boundary");
    expect(prompt).toContain("Checks to repair:");
    expect(prompt).toContain("siblingsDistinct: TR03 · TR04: Kedua wilayah ini mengumpulkan masukan pelanggan.");
    expect(prompt).toContain("Propose one replacement Territory");
    expect(prompt).toContain("Do not return a name listed there.");
  });

  it("offers a replacement only when the sibling judgment already passes that code", () => {
    const distinct: TerritorySetFacts = {
      fingerprint: "set",
      coreDistinct: true,
      materialOverlapPairs: [],
      containmentPairs: [],
      coverage: "UNRESOLVED",
      resolution: "RESOLVED",
      unresolvedReasons: [],
    };
    const overlap: TerritorySetFacts = {
      ...distinct,
      coreDistinct: false,
      materialOverlapPairs: [{ territoryCodeA: "TR01", territoryCodeB: "TR04", explanation: "Same space" }],
    };
    expect(territoryReplacementPasses(distinct, "TR04")).toBe(true);
    expect(territoryReplacementPasses(overlap, "TR04")).toBe(false);
    expect(territoryReplacementPasses(null, "TR04")).toBe(false);
  });
});

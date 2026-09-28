import { describe, expect, it } from "vitest";
import { angleReplacementPasses, parseAngleFixOptions, parseAngleFixReplacements } from "@/thinking-lab/angle/fix";
import type { AngleSetFacts } from "@/thinking-lab/angle/types";

describe("angle fix", () => {
  it("keeps one replacement for each failed code", () => {
    const rows = parseAngleFixReplacements(
      {
        replacements: [
          { code: "an02", statement: "A separate point of view" },
          { code: "AN01", statement: " " },
          { code: "AN09", statement: "Outside the failed set" },
        ],
      },
      ["AN01", "AN02", "AN04"],
    );
    expect(rows).toEqual([{ code: "AN02", statement: "A separate point of view" }]);
  });

  it("keeps up to three distinct repair options", () => {
    expect(parseAngleFixOptions({ statements: ["One view", "One view", " ", "Another view"] })).toEqual([
      "One view",
      "Another view",
    ]);
  });

  it("offers a replacement only when the sibling judgment already passes that code", () => {
    const distinct: AngleSetFacts = {
      fingerprint: "set",
      coreDistinct: true,
      materialOverlapPairs: [],
      containmentPairs: [],
      coverage: "UNRESOLVED",
      resolution: "RESOLVED",
      unresolvedReasons: [],
    };
    const overlap: AngleSetFacts = {
      ...distinct,
      coreDistinct: false,
      materialOverlapPairs: [{ angleCodeA: "AN02", angleCodeB: "AN04", explanation: "Same view" }],
    };
    expect(angleReplacementPasses(distinct, "AN04")).toBe(true);
    expect(angleReplacementPasses(overlap, "AN04")).toBe(false);
    expect(angleReplacementPasses(null, "AN04")).toBe(false);
  });
});

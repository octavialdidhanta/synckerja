import { describe, expect, it } from "vitest";
import { buildGenerativityPrompt, sealTerritoryFacts } from "@/thinking-lab/territory/generativity";
import type { TerritorySemanticFacts } from "@/thinking-lab/territory/types";

const BANNED = ["tithing", "tithe", "obc", "charity", "apple", "iphone"];

function facts(overrides: Partial<TerritorySemanticFacts> = {}): TerritorySemanticFacts {
  return {
    code: "TR01",
    whatItSays: "A child exploration space",
    relationToParent: "VALID_TERRITORY",
    parentFit: true,
    conceptualForm: "TERRITORY_SPACE",
    parentScopeDuplication: false,
    generativity: "SUFFICIENT",
    boundedness: "BOUNDED",
    nominalForm: "NOMINAL",
    audienceLanguage: "AUDIENCE",
    livedQuestion: true,
    resolution: "RESOLVED",
    unresolvedReasons: [],
    ...overrides,
  };
}

describe("sealTerritoryFacts", () => {
  it("keeps ANGLE_LIKE when the generativity review is unresolved", () => {
    const sealed = sealTerritoryFacts(facts({ conceptualForm: "ANGLE_LIKE", relationToParent: "ANGLE_LIKE" }), {
      generativity: "UNRESOLVED",
      unresolvedReasons: ["NEED_MORE_CONTEXT"],
    });
    expect(sealed.relationToParent).toBe("ANGLE_LIKE");
    expect(sealed.generativity).toBe("UNRESOLVED");
    expect(sealed.resolution).toBe("RESOLVED");
    expect(sealed.unresolvedReasons).toEqual([]);
  });

  it("replaces a provisional sufficient value when the review finds insufficient generativity", () => {
    const sealed = sealTerritoryFacts(facts(), { generativity: "INSUFFICIENT", unresolvedReasons: [] });
    expect(sealed.generativity).toBe("INSUFFICIENT");
    expect(sealed.relationToParent).toBe("INSUFFICIENT_GENERATIVITY");
    expect(sealed.resolution).toBe("RESOLVED");
  });

  it("stays unresolved when generativity is still required and the review cannot decide", () => {
    const sealed = sealTerritoryFacts(facts(), { generativity: "UNRESOLVED", unresolvedReasons: ["NEED_MORE_CONTEXT"] });
    expect(sealed.relationToParent).toBe("UNRESOLVED");
    expect(sealed.resolution).toBe("UNRESOLVED");
    expect(sealed.unresolvedReasons).toContain("GENERATIVITY_UNRESOLVED");
    expect(sealed.unresolvedReasons).toContain("NEED_MORE_CONTEXT");
  });
});

describe("buildGenerativityPrompt", () => {
  it("does not use banned domain examples", () => {
    const prompt = buildGenerativityPrompt({ parentStatement: "A parent.", statement: "A space." }).toLowerCase();
    for (const word of BANNED) expect(prompt).not.toContain(word);
  });
});

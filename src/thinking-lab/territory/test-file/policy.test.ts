import { describe, expect, it } from "vitest";
import { admitTerritory, visibleTerritories } from "@/thinking-lab/territory/policy";
import type { TerritorySemanticFacts } from "@/thinking-lab/territory/types";

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

describe("admitTerritory", () => {
  it("admits only a resolved valid territory", () => {
    expect(admitTerritory(facts())).toBe("GENERATE_VALID");
  });

  it("fails closed on an unresolved result", () => {
    expect(admitTerritory(facts({ relationToParent: "UNRESOLVED", resolution: "UNRESOLVED" }))).toBe("UNRESOLVED");
    expect(admitTerritory(null)).toBe("UNRESOLVED");
  });

  it("rejects an angle", () => {
    expect(admitTerritory(facts({ relationToParent: "ANGLE_LIKE" }))).toBe("GENERATE_REJECT");
  });

  it("rejects parent scope duplication", () => {
    expect(admitTerritory(facts({ relationToParent: "PARENT_SCOPE_DUPLICATION" }))).toBe("GENERATE_REJECT");
  });
});

describe("visibleTerritories", () => {
  it("shows admitted rows only under their own Big Thought", () => {
    const rows = [
      { bigThoughtId: "bt-1", admission: "GENERATE_VALID" as const, code: "TR01" },
      { bigThoughtId: "bt-1", admission: "GENERATE_REJECT" as const, code: "TR02" },
      { bigThoughtId: "bt-2", admission: "GENERATE_VALID" as const, code: "TR03" },
    ];
    expect(visibleTerritories(rows, "bt-1").map((row) => row.code)).toEqual(["TR01"]);
    expect(visibleTerritories(rows, "bt-2").map((row) => row.code)).toEqual(["TR03"]);
  });
});

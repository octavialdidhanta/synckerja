import { describe, expect, it } from "vitest";
import { admitAngle, visibleAngles } from "@/thinking-lab/angle/policy";
import type { AngleSemanticFacts } from "@/thinking-lab/angle/types";

function facts(overrides: Partial<AngleSemanticFacts> = {}): AngleSemanticFacts {
  return {
    code: "AN01",
    whatItSays: "One specific point of view",
    relationToParent: "VALID_ANGLE",
    parentFit: true,
    conceptualForm: "ANGLE_PROPOSITION",
    ideaGenerativity: "SUFFICIENT",
    boundedness: "BOUNDED",
    jobForm: "OBSERVATION",
    resolution: "RESOLVED",
    unresolvedReasons: [],
    ...overrides,
  };
}

describe("admitAngle", () => {
  it("admits only a resolved valid angle", () => {
    expect(admitAngle(facts())).toBe("GENERATE_VALID");
  });

  it("fails closed on an unresolved result", () => {
    expect(admitAngle(facts({ relationToParent: "UNRESOLVED", resolution: "UNRESOLVED" }))).toBe("UNRESOLVED");
    expect(admitAngle(null)).toBe("UNRESOLVED");
    expect(admitAngle(facts({ unresolvedReasons: ["BOUNDEDNESS_UNRESOLVED"] }))).toBe("UNRESOLVED");
  });

  it("rejects each canonical rejection", () => {
    for (const relation of [
      "OUT_OF_PARENT_SCOPE",
      "TERRITORY_LIKE",
      "BIG_THOUGHT_LIKE",
      "IDEA_LIKE",
      "EXECUTION_LIKE",
      "INSUFFICIENT_IDEA_GENERATIVITY",
      "UNBOUNDED_ANGLE",
    ] as const) {
      expect(admitAngle(facts({ relationToParent: relation }))).toBe("GENERATE_REJECT");
    }
  });
});

describe("visibleAngles", () => {
  it("shows admitted rows only under their own Territory", () => {
    const rows = [
      { territoryId: "tr-1", admission: "GENERATE_VALID" as const, code: "AN01" },
      { territoryId: "tr-1", admission: "GENERATE_REJECT" as const, code: "AN02" },
      { territoryId: "tr-1", admission: "UNRESOLVED" as const, code: "AN03" },
      { territoryId: "tr-2", admission: "GENERATE_VALID" as const, code: "AN04" },
    ];
    expect(visibleAngles(rows, "tr-1").map((row) => row.code)).toEqual(["AN01"]);
    expect(visibleAngles(rows, "tr-2").map((row) => row.code)).toEqual(["AN04"]);
  });
});

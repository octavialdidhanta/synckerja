import { describe, expect, it } from "vitest";
import { individualAdmission } from "@/thinking-lab/big-thought/policy";
import type { BigThoughtFacts, ParentRelation } from "@/thinking-lab/big-thought/types";

const PARENTS = [
  "Giving resources away can be a duty of a household.",
  "A personal computer should stay simple enough for a first-time owner.",
  "A student learns a subject by using it on a real problem.",
  "A company stays coherent when decisions share one operating belief.",
  "A coastline changes because water, wind, and rock interact.",
];

function facts(overrides: Partial<BigThoughtFacts> = {}): BigThoughtFacts {
  return {
    code: "BT01",
    whatItSays: "A distinct foundational reason",
    relationToParent: "DISTINCT_MATERIAL_SUPPORT",
    explainsWhyParentIsTrue: true,
    introducesUnsupportedPremise: false,
    duplicateOfCode: null,
    resolution: "RESOLVED",
    unresolvedReasons: [],
    ...overrides,
  };
}

describe("big thought individual policy", () => {
  it("accepts the same resolved facts for unrelated parent domains", () => {
    for (const parent of PARENTS) {
      expect(parent.length).toBeGreaterThan(10);
      expect(individualAdmission({ facts: facts(), factsCurrent: true })).toBe("GENERATE_VALID");
    }
  });

  it("rejects restatement, outcome, method, duplicate, and unsupported premise", () => {
    const relations: ParentRelation[] = ["RESTATEMENT", "OUTCOME", "METHOD", "DUPLICATE", "UNSUPPORTED_PREMISE"];
    for (const relationToParent of relations) {
      expect(individualAdmission({ facts: facts({ relationToParent }), factsCurrent: true })).toBe("GENERATE_REJECT");
    }
  });

  it("keeps an unfinished judgment unresolved", () => {
    expect(
      individualAdmission({
        facts: facts({ resolution: "UNRESOLVED", unresolvedReasons: ["INCOMPLETE"] }),
        factsCurrent: true,
      }),
    ).toBe("UNRESOLVED");
  });

  it("treats a stale fingerprint as stale rather than a reject", () => {
    expect(individualAdmission({ facts: facts(), factsCurrent: false })).toBe("STALE");
  });

  it("trusts a resolved canonical reject even when auxiliary fields are unresolved", () => {
    expect(
      individualAdmission({
        facts: facts({
          relationToParent: "ELABORATION",
          explainsWhyParentIsTrue: false,
          introducesUnsupportedPremise: false,
        }),
        factsCurrent: true,
      }),
    ).toBe("GENERATE_REJECT");
    expect(
      individualAdmission({
        facts: facts({
          relationToParent: "ELABORATION",
          explainsWhyParentIsTrue: "unresolved",
          introducesUnsupportedPremise: "unresolved",
        }),
        factsCurrent: true,
      }),
    ).toBe("GENERATE_REJECT");
    expect(
      individualAdmission({
        facts: facts({
          relationToParent: "RESTATEMENT",
          explainsWhyParentIsTrue: "unresolved",
        }),
        factsCurrent: true,
      }),
    ).toBe("GENERATE_REJECT");
    expect(
      individualAdmission({
        facts: facts({ relationToParent: "UNRESOLVED" }),
        factsCurrent: true,
      }),
    ).toBe("UNRESOLVED");
    expect(
      individualAdmission({
        facts: facts({
          relationToParent: "DISTINCT_MATERIAL_SUPPORT",
          explainsWhyParentIsTrue: "unresolved",
        }),
        factsCurrent: true,
      }),
    ).toBe("UNRESOLVED");
    expect(
      individualAdmission({
        facts: facts({
          relationToParent: "DISTINCT_MATERIAL_SUPPORT",
          explainsWhyParentIsTrue: true,
          introducesUnsupportedPremise: false,
          duplicateOfCode: null,
        }),
        factsCurrent: true,
      }),
    ).toBe("GENERATE_VALID");
  });
});

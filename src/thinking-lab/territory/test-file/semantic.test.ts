import { describe, expect, it } from "vitest";
import { deriveTerritoryRelation, normalizeTerritoryFacts } from "@/thinking-lab/territory/semantic";
import type { TerritorySemanticFacts } from "@/thinking-lab/territory/types";

function positive(overrides: Partial<TerritorySemanticFacts> = {}): TerritorySemanticFacts {
  return {
    code: "TR01",
    whatItSays: "A child exploration space",
    relationToParent: "UNRESOLVED",
    parentFit: true,
    conceptualForm: "TERRITORY_SPACE",
    parentScopeDuplication: false,
    generativity: "SUFFICIENT",
    boundedness: "BOUNDED",
    nominalForm: "NOMINAL",
    audienceLanguage: "AUDIENCE",
    livedQuestion: true,
    resolution: "UNRESOLVED",
    unresolvedReasons: [],
    ...overrides,
  };
}

describe("deriveTerritoryRelation", () => {
  it("maps parentFit false to OUT_OF_PARENT_SCOPE", () => {
    expect(
      deriveTerritoryRelation(
        positive({
          parentFit: false,
          conceptualForm: "BIG_THOUGHT_LIKE",
          parentScopeDuplication: true,
          generativity: "INSUFFICIENT",
          boundedness: "UNBOUNDED",
        }),
      ),
    ).toBe("OUT_OF_PARENT_SCOPE");
  });

  it("gives BIG_THOUGHT_LIKE precedence over later facts", () => {
    expect(
      deriveTerritoryRelation(
        positive({
          conceptualForm: "BIG_THOUGHT_LIKE",
          parentScopeDuplication: true,
          generativity: "INSUFFICIENT",
          boundedness: "UNBOUNDED",
        }),
      ),
    ).toBe("BIG_THOUGHT_LIKE");
  });

  it("gives ANGLE_LIKE precedence over later facts", () => {
    expect(
      deriveTerritoryRelation(
        positive({
          conceptualForm: "ANGLE_LIKE",
          parentScopeDuplication: true,
          generativity: "INSUFFICIENT",
          boundedness: "UNBOUNDED",
        }),
      ),
    ).toBe("ANGLE_LIKE");
  });

  it("gives DOWNSTREAM_EXECUTION_LIKE precedence over later facts", () => {
    expect(
      deriveTerritoryRelation(
        positive({
          conceptualForm: "DOWNSTREAM_EXECUTION_LIKE",
          parentScopeDuplication: true,
          generativity: "INSUFFICIENT",
          boundedness: "UNBOUNDED",
        }),
      ),
    ).toBe("DOWNSTREAM_EXECUTION_LIKE");
  });

  it("maps a duplicated parent scope after the candidate is space-like", () => {
    expect(
      deriveTerritoryRelation(
        positive({
          parentScopeDuplication: true,
          generativity: "INSUFFICIENT",
          boundedness: "UNBOUNDED",
        }),
      ),
    ).toBe("PARENT_SCOPE_DUPLICATION");
  });

  it("maps insufficient generativity after scope duplication is false", () => {
    expect(
      deriveTerritoryRelation(positive({ generativity: "INSUFFICIENT", boundedness: "UNBOUNDED" })),
    ).toBe("INSUFFICIENT_GENERATIVITY");
  });

  it("maps an unbounded space last among resolved rejections", () => {
    expect(deriveTerritoryRelation(positive({ boundedness: "UNBOUNDED" }))).toBe("UNBOUNDED_SPACE");
  });

  it("stays unresolved when a required positive fact is unresolved", () => {
    expect(deriveTerritoryRelation(positive({ generativity: "UNRESOLVED" }))).toBe("UNRESOLVED");
    expect(deriveTerritoryRelation(positive({ boundedness: "UNRESOLVED" }))).toBe("UNRESOLVED");
    expect(deriveTerritoryRelation(positive({ parentFit: "unresolved" }))).toBe("UNRESOLVED");
  });

  it("accepts a territory only when every positive fact is resolved", () => {
    expect(deriveTerritoryRelation(positive())).toBe("VALID_TERRITORY");
  });

  it("accepts a noun phrase and rejects a claim, internal language, and a question that is not lived", () => {
    expect(deriveTerritoryRelation(positive({ whatItSays: "Kurir paket." }))).toBe("VALID_TERRITORY");
    expect(deriveTerritoryRelation(positive({ nominalForm: "CLAIM" }))).toBe("CLAIM_BEARING");
    expect(deriveTerritoryRelation(positive({ audienceLanguage: "INTERNAL" }))).toBe("INTERNAL_LANGUAGE");
    expect(deriveTerritoryRelation(positive({ livedQuestion: false }))).toBe("QUESTION_NOT_LIVED");
    expect(deriveTerritoryRelation(positive({ nominalForm: "UNRESOLVED" }))).toBe("UNRESOLVED");
  });

  it("does not skip an unresolved parentFit for a lower rejection", () => {
    expect(deriveTerritoryRelation(positive({ parentFit: "unresolved", conceptualForm: "ANGLE_LIKE" }))).toBe(
      "UNRESOLVED",
    );
  });

  it("keeps a resolved rejection when lower-priority facts are unresolved", () => {
    expect(
      deriveTerritoryRelation(
        positive({
          conceptualForm: "ANGLE_LIKE",
          generativity: "UNRESOLVED",
          boundedness: "UNRESOLVED",
        }),
      ),
    ).toBe("ANGLE_LIKE");
  });
});

describe("normalizeTerritoryFacts", () => {
  it("derives the relation and does not let a model relation override it", () => {
    const facts = normalizeTerritoryFacts({
      code: "TR01",
      whatItSays: "One closed point of view",
      relationToParent: "VALID_TERRITORY",
      parentFit: true,
      conceptualForm: "ANGLE_LIKE",
      parentScopeDuplication: false,
      generativity: "UNRESOLVED",
      boundedness: "UNRESOLVED",
      unresolvedReasons: ["ANGLE_LIKE"],
      confidence: 0.99,
    });
    expect(facts.relationToParent).toBe("ANGLE_LIKE");
    expect(facts.resolution).toBe("RESOLVED");
    expect(facts.unresolvedReasons).toEqual([]);
    expect(facts.confidence).toBe(0.99);
  });

  it("records unresolved required facts without granting validity", () => {
    const facts = normalizeTerritoryFacts({
      parentFit: true,
      conceptualForm: "TERRITORY_SPACE",
      parentScopeDuplication: false,
      generativity: "SUFFICIENT",
      boundedness: "UNRESOLVED",
      unresolvedReasons: ["BOUNDARY_UNCLEAR"],
    });
    expect(facts.relationToParent).toBe("UNRESOLVED");
    expect(facts.resolution).toBe("UNRESOLVED");
    expect(facts.unresolvedReasons).toContain("BOUNDEDNESS_UNRESOLVED");
    expect(facts.unresolvedReasons).toContain("BOUNDARY_UNCLEAR");
  });

  it("fails closed on malformed and contradictory canonical facts", () => {
    expect(normalizeTerritoryFacts(null, "TR09").relationToParent).toBe("UNRESOLVED");
    expect(normalizeTerritoryFacts(null, "TR09").resolution).toBe("UNRESOLVED");
    const contradictory = normalizeTerritoryFacts({
      conceptualForm: ["ANGLE_LIKE", "BIG_THOUGHT_LIKE"],
      parentFit: [true, false],
    });
    expect(contradictory.relationToParent).toBe("UNRESOLVED");
    expect(contradictory.resolution).toBe("UNRESOLVED");
    expect(contradictory.conceptualForm).toBe("UNRESOLVED");
    expect(contradictory.parentFit).toBe("unresolved");
    expect(contradictory.unresolvedReasons).toEqual(["CONTRADICTORY_CANONICAL_FACTS"]);
    const unknown = normalizeTerritoryFacts({
      parentFit: "partial",
      conceptualForm: "TOO_BROAD",
      parentScopeDuplication: false,
      generativity: "SUFFICIENT",
      boundedness: "BOUNDED",
    });
    expect(unknown.relationToParent).toBe("UNRESOLVED");
    expect(unknown.parentFit).toBe("unresolved");
    expect(unknown.conceptualForm).toBe("UNRESOLVED");
    expect(unknown.resolution).toBe("UNRESOLVED");
  });

  it("keeps OUT_OF_PARENT_SCOPE when a lower generativity fact contradicts", () => {
    const facts = normalizeTerritoryFacts({
      parentFit: false,
      conceptualForm: "TERRITORY_SPACE",
      parentScopeDuplication: false,
      generativity: ["SUFFICIENT", "INSUFFICIENT"],
      boundedness: "BOUNDED",
    });
    expect(facts.relationToParent).toBe("OUT_OF_PARENT_SCOPE");
    expect(facts.resolution).toBe("RESOLVED");
    expect(facts.unresolvedReasons).toEqual([]);
    expect(facts.parentFit).toBe(false);
  });

  it("keeps ANGLE_LIKE when a lower boundedness fact contradicts", () => {
    const facts = normalizeTerritoryFacts({
      parentFit: true,
      conceptualForm: "ANGLE_LIKE",
      parentScopeDuplication: false,
      generativity: "SUFFICIENT",
      boundedness: ["BOUNDED", "UNBOUNDED"],
    });
    expect(facts.relationToParent).toBe("ANGLE_LIKE");
    expect(facts.resolution).toBe("RESOLVED");
    expect(facts.unresolvedReasons).toEqual([]);
  });

  it("keeps DOWNSTREAM_EXECUTION_LIKE when lower-priority facts contradict", () => {
    const facts = normalizeTerritoryFacts({
      parentFit: true,
      conceptualForm: "DOWNSTREAM_EXECUTION_LIKE",
      parentScopeDuplication: [true, false],
      generativity: ["SUFFICIENT", "INSUFFICIENT"],
      boundedness: "BOUNDED",
    });
    expect(facts.relationToParent).toBe("DOWNSTREAM_EXECUTION_LIKE");
    expect(facts.resolution).toBe("RESOLVED");
    expect(facts.unresolvedReasons).toEqual([]);
  });

  it("stays unresolved when generativity contradicts after the earlier gates pass", () => {
    const facts = normalizeTerritoryFacts({
      parentFit: true,
      conceptualForm: "TERRITORY_SPACE",
      parentScopeDuplication: false,
      generativity: ["SUFFICIENT", "INSUFFICIENT"],
      boundedness: "BOUNDED",
    });
    expect(facts.relationToParent).toBe("UNRESOLVED");
    expect(facts.resolution).toBe("UNRESOLVED");
    expect(facts.unresolvedReasons).toEqual(["CONTRADICTORY_CANONICAL_FACTS"]);
  });

  it("stays unresolved when conceptualForm itself contradicts", () => {
    const facts = normalizeTerritoryFacts({
      parentFit: true,
      conceptualForm: ["ANGLE_LIKE", "BIG_THOUGHT_LIKE"],
      parentScopeDuplication: false,
      generativity: "SUFFICIENT",
      boundedness: "BOUNDED",
    });
    expect(facts.relationToParent).toBe("UNRESOLVED");
    expect(facts.resolution).toBe("UNRESOLVED");
    expect(facts.conceptualForm).toBe("UNRESOLVED");
    expect(facts.unresolvedReasons).toEqual(["CONTRADICTORY_CANONICAL_FACTS"]);
  });

  it("does not skip a contradictory or unresolved parentFit for a lower rejection", () => {
    const contradictory = normalizeTerritoryFacts({
      parentFit: [true, false],
      conceptualForm: "ANGLE_LIKE",
      parentScopeDuplication: false,
      generativity: "SUFFICIENT",
      boundedness: "BOUNDED",
    });
    expect(contradictory.relationToParent).toBe("UNRESOLVED");
    expect(contradictory.resolution).toBe("UNRESOLVED");
    expect(contradictory.conceptualForm).toBe("ANGLE_LIKE");
    expect(contradictory.unresolvedReasons).toEqual(["CONTRADICTORY_CANONICAL_FACTS"]);
    const unresolved = normalizeTerritoryFacts({
      parentFit: "unresolved",
      conceptualForm: "ANGLE_LIKE",
      parentScopeDuplication: false,
      generativity: "SUFFICIENT",
      boundedness: "BOUNDED",
    });
    expect(unresolved.relationToParent).toBe("UNRESOLVED");
    expect(unresolved.resolution).toBe("UNRESOLVED");
    expect(unresolved.unresolvedReasons).toContain("PARENT_FIT_UNRESOLVED");
  });
});

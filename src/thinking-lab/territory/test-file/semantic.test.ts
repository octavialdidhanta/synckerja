import { describe, expect, it } from "vitest";
import {
  buildTerritoryJudgePrompt,
  deriveTerritoryRelation,
  judgeTerritory,
  normalizeTerritoryFacts,
  parseTerritoryJudge,
} from "@/thinking-lab/territory/semantic";
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
    expect(parseTerritoryJudge(null, "TR09").unresolvedReasons).toEqual(["JUDGE_UNAVAILABLE"]);
    expect(parseTerritoryJudge("not json", "TR09").relationToParent).toBe("UNRESOLVED");
    expect(parseTerritoryJudge("not json", "TR09").resolution).toBe("UNRESOLVED");
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

  it("keeps the framework shape, the four pass conditions, and the Master Thought stake test", () => {
    const prompt = buildTerritoryJudgePrompt({
      parentStatement: "Waktu untuk pertumbuhan investasi lebih panjang.",
      ancestors: [{ label: "Master Thought", statement: "Uang di usia muda lebih berharga ditabung." }],
      candidate: { code: "TR01", statement: "Pensiun Dini" },
    });
    expect(prompt).toContain("a phenomenon, habit, life moment, culture, or everyday problem");
    expect(prompt).toContain("It is a noun or a noun phrase. It does not yet contain a claim.");
    expect(prompt).toContain("It is part of the Big Thought, not a keyword of the Big Thought.");
    expect(prompt).toContain("how the audience would name that area");
    expect(prompt).toContain("the question answered by the Big Thought actually shows up");
    expect(prompt).toContain("wide enough for several different Angles");
    expect(prompt).toContain("its main job is an impact, a requirement, or an evaluation");
    expect(prompt).toContain("after the distinctive stake of the direct Big Thought or an ancestor is removed, including the Master Thought");
    expect(prompt).toContain("the part of that belief that is not in the subject");
    expect(prompt).toContain("not rejected only because that name can still be said");
    expect(prompt).not.toContain("Audience:");
    expect(prompt).not.toContain("orang");
  });

  it("judges lived life and words for the named audience", () => {
    const prompt = buildTerritoryJudgePrompt({
      parentStatement: "Nilai barang konsumtif cepat tergerus.",
      ancestors: [
        {
          label: "Master Thought",
          statement: "Uang di usia muda lebih berharga ditabung daripada dihabiskan untuk mengejar motor paling kencang.",
        },
      ],
      audience: "anak muda hobi motor",
      candidate: { code: "TR01", statement: "Pakaian tren musiman" },
    });
    expect(prompt).toContain("It is part of the Big Thought, not a keyword of the Big Thought.");
    expect(prompt).toContain("This is a test of words, not of topic.");
    expect(prompt).toContain("how the audience would name that area");
    expect(prompt).toContain("this audience's real life");
    expect(prompt).toContain("only fits a different audience");
    expect(prompt).toContain("wide enough for several different Angles");
    expect(prompt).toContain("Audience: anak muda hobi motor");
    expect(prompt).toContain("including the Master Thought and the part of that belief that is not in the subject");
  });

  it("does not special-case a candidate string", async () => {
    const parent = "Innovation should challenge the way things are normally done.";
    const duplicated = await judgeTerritory(
      { parentStatement: parent, candidate: { code: "TR01", statement: "Innovation" } },
      async () =>
        JSON.stringify({
          whatItSays: "The same scope as the parent",
          parentFit: true,
          conceptualForm: "TERRITORY_SPACE",
          parentScopeDuplication: true,
          generativity: "SUFFICIENT",
          boundedness: "BOUNDED",
        }),
    );
    expect(duplicated.relationToParent).toBe("PARENT_SCOPE_DUPLICATION");
    const valid = await judgeTerritory(
      { parentStatement: parent, candidate: { code: "TR01", statement: "Innovation" } },
      async () =>
        JSON.stringify({
          whatItSays: "A bounded child space",
          parentFit: true,
          conceptualForm: "TERRITORY_SPACE",
          parentScopeDuplication: false,
          generativity: "SUFFICIENT",
          boundedness: "BOUNDED",
          nominalForm: "NOMINAL",
          audienceLanguage: "AUDIENCE",
          livedQuestion: true,
        }),
    );
    expect(valid.relationToParent).toBe("VALID_TERRITORY");
    expect(valid.resolution).toBe("RESOLVED");
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

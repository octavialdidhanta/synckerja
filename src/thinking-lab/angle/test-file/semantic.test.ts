import { describe, expect, it } from "vitest";
import { admitAngle } from "@/thinking-lab/angle/policy";
import { deriveAngleRelation, judgeAngle, normalizeAngleFacts, parseAngleJudge } from "@/thinking-lab/angle/semantic";
import type { AngleSemanticFacts } from "@/thinking-lab/angle/types";

const APPLE_ANGLE =
  "Innovation does not always mean adding something; sometimes innovation means removing what is unnecessary.";

function positive(overrides: Partial<AngleSemanticFacts> = {}): AngleSemanticFacts {
  return {
    code: "AN01",
    whatItSays: "One specific point of view",
    relationToParent: "UNRESOLVED",
    parentFit: true,
    conceptualForm: "ANGLE_PROPOSITION",
    ideaGenerativity: "SUFFICIENT",
    boundedness: "BOUNDED",
    jobForm: "OBSERVATION",
    resolution: "UNRESOLVED",
    unresolvedReasons: [],
    ...overrides,
  };
}

describe("deriveAngleRelation", () => {
  it("accepts a valid angle", () => {
    expect(deriveAngleRelation(positive())).toBe("VALID_ANGLE");
  });

  it("keeps the Apple innovation sentence valid only when the facts are an observation", () => {
    const facts = normalizeAngleFacts({
      code: "AN01",
      whatItSays: "Innovation can mean removal rather than addition",
      parentFit: true,
      conceptualForm: "ANGLE_PROPOSITION",
      ideaGenerativity: "SUFFICIENT",
      boundedness: "BOUNDED",
      jobForm: "OBSERVATION",
    });
    expect(facts.relationToParent).toBe("VALID_ANGLE");
    expect(facts.resolution).toBe("RESOLVED");
    expect(admitAngle(facts)).toBe("GENERATE_VALID");
    const missingJob = normalizeAngleFacts({
      parentFit: true,
      conceptualForm: "ANGLE_PROPOSITION",
      ideaGenerativity: "SUFFICIENT",
      boundedness: "BOUNDED",
    });
    expect(missingJob.relationToParent).toBe("UNRESOLVED");
  });

  it("maps parentFit false to OUT_OF_PARENT_SCOPE", () => {
    expect(
      deriveAngleRelation(
        positive({
          parentFit: false,
          conceptualForm: "BIG_THOUGHT_LIKE",
          ideaGenerativity: "INSUFFICIENT",
          boundedness: "UNBOUNDED",
        }),
      ),
    ).toBe("OUT_OF_PARENT_SCOPE");
  });

  it("maps a territory-like candidate", () => {
    expect(deriveAngleRelation(positive({ conceptualForm: "TERRITORY_LIKE", boundedness: "UNBOUNDED" }))).toBe(
      "TERRITORY_LIKE",
    );
  });

  it("maps a big-thought-like candidate ahead of later facts", () => {
    expect(
      deriveAngleRelation(
        positive({
          conceptualForm: "BIG_THOUGHT_LIKE",
          ideaGenerativity: "INSUFFICIENT",
          boundedness: "UNBOUNDED",
        }),
      ),
    ).toBe("BIG_THOUGHT_LIKE");
  });

  it("maps an idea-like candidate", () => {
    expect(deriveAngleRelation(positive({ conceptualForm: "IDEA_LIKE", ideaGenerativity: "INSUFFICIENT" }))).toBe(
      "IDEA_LIKE",
    );
  });

  it("maps an execution-like candidate", () => {
    expect(deriveAngleRelation(positive({ conceptualForm: "EXECUTION_LIKE", boundedness: "UNBOUNDED" }))).toBe(
      "EXECUTION_LIKE",
    );
  });

  it("rejects a because-clause as a Big Thought job and a territory summary as territory-like", () => {
    expect(deriveAngleRelation(positive({ jobForm: "REASON" }))).toBe("BIG_THOUGHT_LIKE");
    expect(deriveAngleRelation(positive({ jobForm: "TERRITORY_SUMMARY" }))).toBe("TERRITORY_LIKE");
    expect(deriveAngleRelation(positive({ jobForm: "UNRESOLVED" }))).toBe("UNRESOLVED");
  });

  it("maps insufficient idea generativity after the form is a proposition", () => {
    expect(deriveAngleRelation(positive({ ideaGenerativity: "INSUFFICIENT", boundedness: "UNBOUNDED" }))).toBe(
      "INSUFFICIENT_IDEA_GENERATIVITY",
    );
  });

  it("maps an unbounded angle last among resolved rejections", () => {
    expect(deriveAngleRelation(positive({ boundedness: "UNBOUNDED" }))).toBe("UNBOUNDED_ANGLE");
  });

  it("stays unresolved when a required fact is unresolved", () => {
    expect(deriveAngleRelation(positive({ ideaGenerativity: "UNRESOLVED" }))).toBe("UNRESOLVED");
    expect(deriveAngleRelation(positive({ boundedness: "UNRESOLVED" }))).toBe("UNRESOLVED");
    expect(deriveAngleRelation(positive({ parentFit: "unresolved" }))).toBe("UNRESOLVED");
    expect(deriveAngleRelation(positive({ conceptualForm: "UNRESOLVED" }))).toBe("UNRESOLVED");
  });

  it("does not let an unresolved parent fit fall through to a lower rejection", () => {
    expect(deriveAngleRelation(positive({ parentFit: "unresolved", conceptualForm: "IDEA_LIKE" }))).toBe("UNRESOLVED");
  });

  it("keeps a resolved higher rejection when lower facts are unresolved", () => {
    expect(
      deriveAngleRelation(
        positive({
          conceptualForm: "IDEA_LIKE",
          ideaGenerativity: "UNRESOLVED",
          boundedness: "UNRESOLVED",
        }),
      ),
    ).toBe("IDEA_LIKE");
    expect(
      deriveAngleRelation(
        positive({
          parentFit: false,
          conceptualForm: "UNRESOLVED",
          ideaGenerativity: "UNRESOLVED",
          boundedness: "UNRESOLVED",
        }),
      ),
    ).toBe("OUT_OF_PARENT_SCOPE");
    expect(
      deriveAngleRelation(positive({ ideaGenerativity: "INSUFFICIENT", boundedness: "UNRESOLVED" })),
    ).toBe("INSUFFICIENT_IDEA_GENERATIVITY");
  });
});

describe("normalizeAngleFacts", () => {
  it("derives the relation and ignores a model relation", () => {
    const facts = normalizeAngleFacts({
      code: "AN01",
      whatItSays: "Already a scene",
      relationToParent: "VALID_ANGLE",
      parentFit: true,
      conceptualForm: "EXECUTION_LIKE",
      ideaGenerativity: "UNRESOLVED",
      boundedness: "UNRESOLVED",
      unresolvedReasons: ["EXECUTION_LIKE"],
      confidence: 0.2,
    });
    expect(facts.relationToParent).toBe("EXECUTION_LIKE");
    expect(facts.resolution).toBe("RESOLVED");
    expect(facts.unresolvedReasons).toEqual([]);
    expect(facts.confidence).toBe(0.2);
  });

  it("does not let a lower contradiction overwrite a resolved higher rejection", () => {
    const facts = normalizeAngleFacts({
      parentFit: false,
      conceptualForm: ["IDEA_LIKE", "EXECUTION_LIKE"],
      ideaGenerativity: ["SUFFICIENT", "INSUFFICIENT"],
      boundedness: "UNRESOLVED",
    });
    expect(facts.relationToParent).toBe("OUT_OF_PARENT_SCOPE");
    expect(facts.resolution).toBe("RESOLVED");
    expect(facts.unresolvedReasons).toEqual([]);
  });

  it("fails closed on malformed and contradictory canonical facts", () => {
    expect(parseAngleJudge(null, "AN09").unresolvedReasons).toEqual(["JUDGE_UNAVAILABLE"]);
    expect(parseAngleJudge("not json", "AN09").relationToParent).toBe("UNRESOLVED");
    const contradictory = normalizeAngleFacts({
      parentFit: [true, false],
      conceptualForm: "ANGLE_PROPOSITION",
      ideaGenerativity: "SUFFICIENT",
      boundedness: "BOUNDED",
    });
    expect(contradictory.relationToParent).toBe("UNRESOLVED");
    expect(contradictory.unresolvedReasons).toEqual(["CONTRADICTORY_CANONICAL_FACTS"]);
  });

  it("does not special-case the Apple anchor string", async () => {
    const idea = await judgeAngle(
      { parentStatement: "Innovation", candidate: { code: "AN01", statement: APPLE_ANGLE } },
      async () =>
        JSON.stringify({
          whatItSays: "A concrete concept",
          parentFit: true,
          conceptualForm: "IDEA_LIKE",
          ideaGenerativity: "SUFFICIENT",
          boundedness: "BOUNDED",
        }),
    );
    expect(idea.relationToParent).toBe("IDEA_LIKE");
    const narrow = await judgeAngle(
      { parentStatement: "Innovation", candidate: { code: "AN01", statement: APPLE_ANGLE } },
      async () =>
        JSON.stringify({
          whatItSays: "Removal can be the innovation",
          parentFit: true,
          conceptualForm: "ANGLE_PROPOSITION",
          ideaGenerativity: "INSUFFICIENT",
          boundedness: "UNBOUNDED",
        }),
    );
    expect(narrow.relationToParent).toBe("INSUFFICIENT_IDEA_GENERATIVITY");
  });
});

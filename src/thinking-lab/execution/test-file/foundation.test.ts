import { describe, expect, it } from "vitest";
import { buildExecutionGeneratePrompt } from "@/thinking-lab/execution/generate";
import { admitExecution } from "@/thinking-lab/execution/policy";
import { buildExecutionJudgePrompt, deriveExecutionRelation, normalizeExecutionFacts, parseExecutionJudge } from "@/thinking-lab/execution/semantic";
import type { ExecutionSemanticFacts } from "@/thinking-lab/execution/types";

function facts(overrides: Partial<ExecutionSemanticFacts> = {}): ExecutionSemanticFacts {
  return {
    pillar: "B_ROLL_STORYTELLING",
    whatItSays: "A scene",
    relationToParent: "UNRESOLVED",
    messageAdded: false,
    mechanismVisible: true,
    pillarOutside: false,
    masterSells: "unresolved",
    viewerClimb: "CLIMBS",
    subjectMatch: "MATCH",
    resolution: "UNRESOLVED",
    unresolvedReasons: [],
    ...overrides,
  };
}

describe("execution relations", () => {
  it("accepts one idea realized in a pillar without a new claim", () => {
    const row = normalizeExecutionFacts(facts());
    expect(row.relationToParent).toBe("VALID_EXECUTION");
    expect(admitExecution(row)).toBe("GENERATE_VALID");
  });

  it("rejects content that adds a claim", () => {
    expect(deriveExecutionRelation(facts({ messageAdded: true }))).toBe("MESSAGE_ADDED");
  });

  it("rejects a pillar that hides the idea mechanism", () => {
    expect(deriveExecutionRelation(facts({ mechanismVisible: false }))).toBe("MECHANISM_HIDDEN");
  });

  it("rejects a pillar that forces a message outside the idea", () => {
    expect(deriveExecutionRelation(facts({ pillarOutside: true }))).toBe("PILLAR_OUTSIDE");
  });

  it("allows Flash Sale Hook only when the Master Thought is selling", () => {
    expect(deriveExecutionRelation(facts({ pillar: "FLASH_SALE_HOOK", masterSells: false }))).toBe("PILLAR_NOT_SELLING");
    expect(deriveExecutionRelation(facts({ pillar: "FLASH_SALE_HOOK", masterSells: true }))).toBe("VALID_EXECUTION");
    expect(deriveExecutionRelation(facts({ pillar: "FLASH_SALE_HOOK", masterSells: "unresolved" }))).toBe("UNRESOLVED");
  });

  it("rejects a content whose viewer does not reach the named subject", () => {
    expect(deriveExecutionRelation(facts({ viewerClimb: "OTHER" }))).toBe("CLIMB_MISSED");
    expect(deriveExecutionRelation(facts({ viewerClimb: "NEGATIVE" }))).toBe("CLIMB_MISSED");
    expect(deriveExecutionRelation(facts({ subjectMatch: "OTHER" }))).toBe("SUBJECT_MISMATCH");
    expect(admitExecution(normalizeExecutionFacts(facts({ subjectMatch: "OTHER" })))).toBe("GENERATE_REJECT");
  });

  it("stays unresolved when the job facts are missing", () => {
    const row = normalizeExecutionFacts({ pillar: "BEHIND_THE_SCENE" });
    expect(row.relationToParent).toBe("UNRESOLVED");
    expect(row.unresolvedReasons).toContain("MESSAGE_ADDED_UNRESOLVED");
    expect(row.unresolvedReasons).toContain("VIEWER_CLIMB_UNRESOLVED");
    expect(row.unresolvedReasons).toContain("SUBJECT_MATCH_UNRESOLVED");
  });

  it("cannot match a subject that was never sealed", () => {
    const row = parseExecutionJudge(
      JSON.stringify({
        messageAdded: false,
        mechanismVisible: true,
        pillarOutside: false,
        masterSells: false,
        viewerClimb: "CLIMBS",
        subjectMatch: "MATCH",
      }),
      "B_ROLL_STORYTELLING",
      false,
    );
    expect(row.subjectMatch).toBe("UNRESOLVED");
    expect(row.relationToParent).toBe("UNRESOLVED");
  });

  it("names the pillar as a format, not a new meaning level", () => {
    const prompt = buildExecutionJudgePrompt({
      masterStatement: "People should believe this.",
      ideaStatement: "Ask the courier, so the kindness is visible.",
      pillar: "BACA_KOMEN_HATERS",
      candidate: "Read the comments while the courier answers.",
    });
    expect(prompt).toContain("not a new meaning level");
    expect(prompt).toContain("must not add a claim");
    expect(prompt).toContain("named Master Thought subject");
    expect(prompt).toContain("Flash Sale Hook is valid only when the Master Thought is actually selling");
    const generate = buildExecutionGeneratePrompt({
      masterStatement: "People should believe this.",
      ideaStatement: "Ask the courier, so the kindness is visible.",
      pillar: "B_ROLL_STORYTELLING",
    });
    expect(generate).toContain("B-Roll Storytelling");
    expect(generate).toContain("Do not add a claim");
  });
});

import { describe, expect, it } from "vitest";
import { buildAngleGenerativityPrompt, sealAngleFacts } from "@/thinking-lab/angle/generativity";
import type { AngleSemanticFacts } from "@/thinking-lab/angle/types";

const BANNED = ["tithing", "tithe", "obc", "charity", "apple", "iphone"];

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

describe("sealAngleFacts", () => {
  it("keeps IDEA_LIKE when the generativity review is unresolved", () => {
    const sealed = sealAngleFacts(facts({ conceptualForm: "IDEA_LIKE", relationToParent: "VALID_ANGLE" }), {
      ideaGenerativity: "UNRESOLVED",
      unresolvedReasons: ["NEED_MORE_CONTEXT"],
    });
    expect(sealed.relationToParent).toBe("IDEA_LIKE");
    expect(sealed.ideaGenerativity).toBe("UNRESOLVED");
    expect(sealed.resolution).toBe("RESOLVED");
    expect(sealed.unresolvedReasons).toEqual([]);
  });

  it("replaces a provisional sufficient value when the review finds insufficient generativity", () => {
    const sealed = sealAngleFacts(facts(), { ideaGenerativity: "INSUFFICIENT", unresolvedReasons: [] });
    expect(sealed.ideaGenerativity).toBe("INSUFFICIENT");
    expect(sealed.relationToParent).toBe("INSUFFICIENT_IDEA_GENERATIVITY");
    expect(sealed.resolution).toBe("RESOLVED");
  });

  it("stays unresolved when idea generativity is still required and the review cannot decide", () => {
    const sealed = sealAngleFacts(facts(), {
      ideaGenerativity: "UNRESOLVED",
      unresolvedReasons: ["NEED_MORE_CONTEXT"],
    });
    expect(sealed.relationToParent).toBe("UNRESOLVED");
    expect(sealed.resolution).toBe("UNRESOLVED");
    expect(sealed.unresolvedReasons).toContain("IDEA_GENERATIVITY_UNRESOLVED");
    expect(sealed.unresolvedReasons).toContain("NEED_MORE_CONTEXT");
  });

  it("owns idea generativity even when the preliminary judge said sufficient", () => {
    const sealed = sealAngleFacts(facts({ ideaGenerativity: "SUFFICIENT", relationToParent: "VALID_ANGLE" }), {
      ideaGenerativity: "INSUFFICIENT",
      unresolvedReasons: ["JUDGE_SAID_SUFFICIENT"],
    });
    expect(sealed.ideaGenerativity).toBe("INSUFFICIENT");
    expect(sealed.relationToParent).toBe("INSUFFICIENT_IDEA_GENERATIVITY");
  });
});

describe("buildAngleGenerativityPrompt", () => {
  it("does not use banned domain examples", () => {
    const prompt = buildAngleGenerativityPrompt({ parentStatement: "A space.", statement: "A point of view." }).toLowerCase();
    for (const word of BANNED) expect(prompt).not.toContain(word);
    expect(prompt).toContain("idea generativity");
  });
});

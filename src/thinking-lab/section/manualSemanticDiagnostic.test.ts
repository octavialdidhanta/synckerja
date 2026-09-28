import { describe, expect, it } from "vitest";
import { diagnoseBigThought } from "@/thinking-lab/section/diagnoseBigThought";

function distinctPass(code: string): string {
  return JSON.stringify({
    code,
    whatItSays: "A distinct causal premise",
    relationToParent: "DISTINCT_MATERIAL_SUPPORT",
    supportRole: "REASON",
    explainsWhyParentIsTrue: true,
    introducesUnsupportedPremise: false,
    duplicateOfCode: null,
    resolution: "RESOLVED",
    unresolvedReasons: [],
    confidence: 0.4,
  });
}

describe("manual semantic diagnostic", () => {
  it("uses the production judge and does not call it twice for a restatement", async () => {
    let calls = 0;
    const result = await diagnoseBigThought({
      parentStatement: "X remains responsible after the transfer.",
      candidate: "Responsibility continues after the handoff.",
      siblings: [],
      ask: async (prompt) => {
        calls += 1;
        expect(prompt).toContain("(none)");
        expect(prompt).not.toContain("BT01:");
        return JSON.stringify({
          code: "NEW",
          whatItSays: "The same conclusion",
          relationToParent: "RESTATEMENT",
          supportRole: "UNRESOLVED",
          explainsWhyParentIsTrue: false,
          introducesUnsupportedPremise: false,
          duplicateOfCode: null,
          resolution: "RESOLVED",
          unresolvedReasons: [],
        });
      },
    });
    expect(calls).toBe(1);
    expect(result.facts.relationToParent).toBe("RESTATEMENT");
    expect(result.admission).toBe("GENERATE_REJECT");
  });

  it("keeps an adversarially confirmed material support", async () => {
    let calls = 0;
    const result = await diagnoseBigThought({
      parentStatement: "X should carefully choose a steward.",
      candidate: "Different stewards can produce materially different outcomes.",
      siblings: [{ code: "BT01", statement: "An existing support" }],
      ask: async (prompt) => {
        calls += 1;
        if (calls === 1) {
          expect(prompt).toContain("BT01: An existing support");
          return distinctPass("NEW");
        }
        expect(prompt).toContain("adversarial verifier");
        return JSON.stringify({
          verdict: "CONFIRM_MATERIAL_SUPPORT",
          reason: "Material support: different outcomes are a causal premise absent from the duty to choose.",
        });
      },
    });
    expect(calls).toBe(2);
    expect(result.facts.relationToParent).toBe("DISTINCT_MATERIAL_SUPPORT");
    expect(result.facts.supportRole).toBe("REASON");
    expect(result.facts.confidence).toBe(0.4);
    expect(result.admission).toBe("GENERATE_VALID");
  });

  it("shows the judge unresolved result when the model is unavailable", async () => {
    const result = await diagnoseBigThought({
      parentStatement: "X is a good person.",
      candidate: "X consistently shows empathy.",
      siblings: [],
      ask: async () => null,
    });
    expect(result.facts.relationToParent).toBe("UNRESOLVED");
    expect(result.facts.resolution).toBe("UNRESOLVED");
    expect(result.facts.unresolvedReasons).toEqual(["JUDGE_UNAVAILABLE"]);
    expect(result.admission).toBe("UNRESOLVED");
  });
});

import { describe, expect, it } from "vitest";
import { buildBigThoughtJudgePrompt, buildSiblingSetPrompt } from "@/thinking-lab/big-thought/semantic";
import {
  buildGeneratePrompt,
  planGenerate,
  runGenerateRounds,
} from "@/thinking-lab/big-thought/generate";
import type { BigThoughtFacts } from "@/thinking-lab/big-thought/types";
import type { IndividualAdmission } from "@/thinking-lab/shared/verdict";

const BANNED = ["tithing", "tithe", "obc", "charity", "apple", "iphone"];

function validFacts(): BigThoughtFacts {
  return {
    code: "BT02",
    whatItSays: "Another foundational reason",
    relationToParent: "DISTINCT_MATERIAL_SUPPORT",
    supportRole: "REASON",
    explainsWhyParentIsTrue: true,
    introducesUnsupportedPremise: false,
    duplicateOfCode: null,
    resolution: "RESOLVED",
    unresolvedReasons: [],
  };
}

function incumbent(code: string, admission: IndividualAdmission = "GENERATE_VALID") {
  return { code, statement: `${code} statement`, admission };
}

describe("generate planner", () => {
  it("asks only for the missing GENERATE_VALID count", () => {
    expect(planGenerate({ activeCount: 0, generateValidCount: 0, round: 1, missingWhy: null }).needed).toBe(3);
    expect(planGenerate({ activeCount: 1, generateValidCount: 1, round: 1, missingWhy: null }).needed).toBe(2);
    expect(planGenerate({ activeCount: 2, generateValidCount: 2, round: 1, missingWhy: null }).needed).toBe(1);
  });

  it("counts a GENERATE_VALID row that has no audit score", async () => {
    const requested: number[] = [];
    const result = await runGenerateRounds({
      parentStatement: "A general belief",
      incumbents: [incumbent("BT01")],
      activeCount: 1,
      missingWhy: null,
      propose: async (plan) => {
        requested.push(plan.needed);
        return [
          { label: "Second Reason", statement: "Second reason" },
          { label: "Third Reason", statement: "Third reason" },
        ];
      },
      judge: async () => validFacts(),
      persist: async (candidate) => ({
        code: `NEW-${candidate.statement}`,
        statement: candidate.statement,
        admission: "GENERATE_VALID" as const,
      }),
    });
    expect(requested[0]).toBe(2);
    expect(result.incumbents[0]?.code).toBe("BT01");
    expect(result.outcome).toBe("READY");
  });

  it("keeps a rejected candidate visible without counting it as GENERATE_VALID", async () => {
    const saved: string[] = [];
    let calls = 0;
    const result = await runGenerateRounds({
      parentStatement: "A general belief",
      incumbents: [incumbent("BT01")],
      activeCount: 1,
      missingWhy: null,
      propose: async () => {
        calls += 1;
        return calls === 1
          ? [{ label: "Weaker Quality", statement: "Only a weaker quality." }]
          : [{ label: "Material Support", statement: "A distinct material support." }];
      },
      judge: async (statement) =>
        statement === "A distinct material support."
          ? validFacts()
          : {
              ...validFacts(),
              relationToParent: "ELABORATION",
              supportRole: "UNRESOLVED",
              explainsWhyParentIsTrue: false,
            },
      persist: async (candidate) => {
        saved.push(candidate.statement);
        return { code: `NEW-${saved.length}`, statement: candidate.statement, admission: "GENERATE_VALID" as const };
      },
    });
    expect(saved).toEqual(["Only a weaker quality.", "A distinct material support."]);
    expect(result.incumbents.map((row) => row.admission)).toEqual([
      "GENERATE_VALID",
      "GENERATE_REJECT",
      "GENERATE_VALID",
    ]);
    expect(result.generateValid).toBe(2);
  });

  it("stops after two rounds and at the cap", () => {
    expect(planGenerate({ activeCount: 0, generateValidCount: 0, round: 3, missingWhy: null }).stop).toBe("ROUNDS");
    expect(planGenerate({ activeCount: 6, generateValidCount: 2, round: 1, missingWhy: null }).stop).toBe("CAP");
  });

  it("passes the stored missing WHY into the request", () => {
    const missingWhy = { description: "The absent cause", boundary: "Only that cause, not a method" };
    const plan = planGenerate({ activeCount: 3, generateValidCount: 3, round: 1, missingWhy });
    expect(plan.needed).toBe(1);
    expect(plan.mode).toBe("gap");
    const prompt = buildGeneratePrompt({
      parentStatement: "A general belief",
      incumbents: [incumbent("BT01")],
      needed: plan.needed,
      missingWhy: plan.missingWhy,
    });
    expect(prompt).toContain("The absent cause");
    expect(prompt).toContain("Only that cause, not a method");
    expect(prompt).toContain("The candidate must not restate the Master Thought or an incumbent Big Thought.");
    expect(prompt).toContain("Inserting the word because between the Master Thought and the candidate must already make one sentence.");
    expect(prompt).toContain("It does not open a new claim.");
    expect(prompt).toContain("1 to 3 words");
    expect(prompt).toContain("Do not shorten or rewrite the statement so that it matches the label.");
    const lower = `${prompt}\n${buildBigThoughtJudgePrompt({
      parentStatement: "A general belief",
      candidate: { code: "BT04", statement: "Candidate" },
      siblings: [],
    })}\n${buildSiblingSetPrompt({ parentStatement: "A general belief", rows: [] })}`.toLowerCase();
    for (const word of BANNED) expect(lower).not.toContain(word);
  });
});

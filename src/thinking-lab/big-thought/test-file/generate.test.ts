import { describe, expect, it } from "vitest";
import { buildSiblingSetPrompt } from "@/thinking-lab/big-thought/semantic";
import {
  buildGeneratePrompt,
  nextBigThoughtCode,
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

describe("big thought codes", () => {
  it("takes the next code after the highest saved code", () => {
    expect(nextBigThoughtCode(["BT01", "BT18", "BT23"])).toBe("BT24");
    expect(nextBigThoughtCode(["BT01", "BT24"])).toBe("BT25");
    expect(nextBigThoughtCode([])).toBe("BT01");
  });
});

describe("generate planner", () => {
  it("asks only for the missing GENERATE_VALID count", () => {
    expect(planGenerate({ activeCount: 0, generateValidCount: 0, round: 1 }).needed).toBe(3);
    expect(planGenerate({ activeCount: 1, generateValidCount: 1, round: 1 }).needed).toBe(2);
    expect(planGenerate({ activeCount: 2, generateValidCount: 2, round: 1 }).needed).toBe(1);
  });

  it("counts a GENERATE_VALID row that has no audit score", async () => {
    const requested: number[] = [];
    const result = await runGenerateRounds({
      parentStatement: "A general belief",
      incumbents: [incumbent("BT01")],
      activeCount: 1,
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

  it("does not save a Big Thought whose label repeats one already kept", async () => {
    const saved: string[] = [];
    const result = await runGenerateRounds({
      parentStatement: "A general belief",
      incumbents: [{ code: "BT01", statement: "People return because the experience is clear.", label: "Pengalaman Pengguna", admission: "GENERATE_VALID" }],
      activeCount: 1,
      topUp: true,
      propose: async () => [
        { label: "Pengalaman Pengguna", statement: "A later clause about the same experience." },
        { label: "Kualitas Produk dan Nilai", statement: "Product quality carries the purchase." },
        { label: "Kualitas dan Nilai Produk", statement: "Another wording of product quality." },
      ],
      judge: async () => validFacts(),
      persist: async (candidate) => {
        saved.push(candidate.label);
        return { code: "BT02", statement: candidate.statement, label: candidate.label, admission: "GENERATE_VALID" as const };
      },
    });
    expect(saved).toEqual(["Kualitas Produk dan Nilai"]);
    expect(result.incumbents).toHaveLength(2);
  });

  it("stops after two rounds and still plans more after six Big Thoughts", () => {
    expect(planGenerate({ activeCount: 0, generateValidCount: 0, round: 3 }).stop).toBe("ROUNDS");
    expect(planGenerate({ activeCount: 6, generateValidCount: 2, round: 1 })).toEqual({
      needed: 1,
      mode: "fill",
      stop: null,
    });
  });

  it("adds another batch when the user asks for more after three valid Big Thoughts", () => {
    expect(planGenerate({ activeCount: 3, generateValidCount: 3, round: 1 }).stop).toBe("ENOUGH");
    expect(planGenerate({ activeCount: 3, generateValidCount: 3, round: 1, topUp: true })).toEqual({
      needed: 3,
      mode: "fill",
      stop: null,
    });
    expect(planGenerate({ activeCount: 5, generateValidCount: 5, round: 1, topUp: true }).needed).toBe(3);
  });

  it("asks for a because-clause that is not already listed", () => {
    const prompt = buildGeneratePrompt({
      parentStatement: "A general belief",
      incumbents: [incumbent("BT01")],
      needed: 1,
    });
    expect(prompt).toContain("Search for a because-clause that is not already in the incumbent list.");
    expect(prompt).toContain("Inserting the word because between the Master Thought and the candidate must already make one sentence.");
    expect(prompt).toContain("It does not open a new claim.");
    expect(prompt).toContain("A Big Thought does not need sehingga or so that.");
    expect(prompt).toContain("A cause that already explains the Master Thought stops there.");
    expect(prompt).toContain("semantic name of that statement's meaning");
    expect(prompt).toContain("Do not shorten or rewrite the statement so that it matches the label.");
    expect(prompt).toContain("same words as an incumbent label, in any order");
    const lower = `${prompt}\n${buildSiblingSetPrompt({ parentStatement: "A general belief", rows: [] })}`.toLowerCase();
    for (const word of BANNED) expect(lower).not.toContain(word);
  });

  it("tells the next attempt which gate failed and asks for one candidate", () => {
    const prompt = buildGeneratePrompt({
      parentStatement: "A general belief",
      incumbents: [incumbent("BT01")],
      needed: 1,
      lessons: [{ gate: "relation", reason: "ELABORATION", statement: "Only a weaker quality." }],
    });
    expect(prompt).toContain("Failed gate: relation. Cause: ELABORATION Failed clause: Only a weaker quality.");
    expect(prompt).toContain("Do not repeat those failures.");
    expect(prompt).toContain("Return at most 1 item(s).");
  });
});

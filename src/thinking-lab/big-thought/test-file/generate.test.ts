import { describe, expect, it } from "vitest";
import { buildBigThoughtJudgePrompt, buildSiblingSetPrompt } from "@/thinking-lab/big-thought/semantic";
import {
  buildGeneratePrompt,
  nextBigThoughtCode,
  planGenerate,
  runCheckedGenerate,
  runGenerateRounds,
} from "@/thinking-lab/big-thought/generate";
import type { BigThoughtFacts, SiblingSetFacts } from "@/thinking-lab/big-thought/types";
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

describe("big thought codes", () => {
  it("takes the next code after the highest saved code", () => {
    expect(nextBigThoughtCode(["BT01", "BT18", "BT23"])).toBe("BT24");
    expect(nextBigThoughtCode(["BT01", "BT24"])).toBe("BT25");
    expect(nextBigThoughtCode([])).toBe("BT01");
  });
});

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

  it("does not save a Big Thought whose label repeats one already kept", async () => {
    const saved: string[] = [];
    const result = await runGenerateRounds({
      parentStatement: "A general belief",
      incumbents: [{ code: "BT01", statement: "People return because the experience is clear.", label: "Pengalaman Pengguna", admission: "GENERATE_VALID" }],
      activeCount: 1,
      missingWhy: null,
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
    expect(planGenerate({ activeCount: 0, generateValidCount: 0, round: 3, missingWhy: null }).stop).toBe("ROUNDS");
    expect(planGenerate({ activeCount: 6, generateValidCount: 2, round: 1, missingWhy: null })).toEqual({
      needed: 1,
      mode: "fill",
      stop: null,
      missingWhy: null,
    });
  });

  it("adds another batch when the user asks for more after three valid Big Thoughts", () => {
    expect(planGenerate({ activeCount: 3, generateValidCount: 3, round: 1, missingWhy: null }).stop).toBe("ENOUGH");
    expect(planGenerate({ activeCount: 3, generateValidCount: 3, round: 1, missingWhy: null, topUp: true })).toEqual({
      needed: 3,
      mode: "fill",
      stop: null,
      missingWhy: null,
    });
    expect(planGenerate({ activeCount: 5, generateValidCount: 5, round: 1, missingWhy: null, topUp: true }).needed).toBe(3);
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
    expect(prompt).toContain("Join it with sehingga when the Master Thought is Indonesian");
    expect(prompt).toContain("When the cause already shows that result, stop.");
    expect(prompt).toContain("semantic name of that statement's meaning");
    expect(prompt).toContain("Do not shorten or rewrite the statement so that it matches the label.");
    expect(prompt).toContain("same words as an incumbent label, in any order");
    const lower = `${prompt}\n${buildBigThoughtJudgePrompt({
      parentStatement: "A general belief",
      candidate: { code: "BT04", statement: "Candidate" },
      siblings: [],
    })}\n${buildSiblingSetPrompt({ parentStatement: "A general belief", rows: [] })}`.toLowerCase();
    for (const word of BANNED) expect(lower).not.toContain(word);
  });

  it("tells the next attempt which gate failed and asks for one candidate", () => {
    const prompt = buildGeneratePrompt({
      parentStatement: "A general belief",
      incumbents: [incumbent("BT01")],
      needed: 1,
      missingWhy: null,
      lessons: [{ gate: "relation", reason: "ELABORATION", statement: "Only a weaker quality." }],
    });
    expect(prompt).toContain("Failed gate: relation. Cause: ELABORATION Failed clause: Only a weaker quality.");
    expect(prompt).toContain("Do not repeat those failures.");
    expect(prompt).toContain("Return at most 1 item(s).");
  });
});

function distinctSet(codes: string[]): SiblingSetFacts {
  return {
    fingerprint: "generate-check",
    distinct: true,
    duplicatePairs: [],
    reasonContributions: codes.map((code) => ({ code, reasonContribution: `${code} job` })),
    resolution: "RESOLVED",
    unresolvedReasons: [],
  };
}

describe("checked generate", () => {
  it("saves a failed candidate and carries the cause into the next attempt", async () => {
    const lessons: string[] = [];
    const saved: string[] = [];
    let siblingCalls = 0;
    const result = await runCheckedGenerate({
      parentStatement: "A general belief",
      incumbents: [incumbent("BT01")],
      missingWhy: null,
      topUp: true,
      propose: async (_plan, _incumbents, prior) => {
        lessons.push(prior.map((lesson) => lesson.gate).join(","));
        const index = saved.length;
        return [{ label: `Reason ${index}`, statement: index === 0 ? "Only a weaker quality." : `Support ${index}` }];
      },
      judge: async (statement) =>
        statement === "Only a weaker quality."
          ? { ...validFacts(), relationToParent: "ELABORATION", supportRole: "UNRESOLVED", explainsWhyParentIsTrue: false }
          : validFacts(),
      judgeSibling: async (rows) => {
        siblingCalls += 1;
        return distinctSet(rows.map((row) => row.code));
      },
      persist: async (candidate, _facts, checklist) => {
        saved.push(candidate.statement);
        return {
          code: `BT0${saved.length + 1}`,
          statement: candidate.statement,
          label: candidate.label,
          admission: checklist.passed ? "GENERATE_VALID" : "GENERATE_REJECT",
        };
      },
    });
    expect(saved[0]).toBe("Only a weaker quality.");
    expect(lessons[1]).toBe("relation");
    expect(siblingCalls).toBe(3);
    expect(result.outcome).toBe("READY");
    expect(saved).toHaveLength(4);
  });

  it("starts from stored failures so the first attempt already avoids them", async () => {
    const seen: string[][] = [];
    await runCheckedGenerate({
      parentStatement: "A general belief",
      incumbents: [],
      missingWhy: null,
      topUp: true,
      initialLessons: [{ gate: "relation", reason: "ELABORATION", statement: "Only a weaker quality." }],
      propose: async (_plan, _incumbents, lessons) => {
        seen.push(lessons.map((lesson) => lesson.statement));
        return [{ label: `Reason ${seen.length}`, statement: `Support ${seen.length}` }];
      },
      judge: async () => validFacts(),
      judgeSibling: async (rows) => distinctSet(rows.map((row) => row.code)),
      persist: async (candidate) => ({
        code: candidate.statement,
        statement: candidate.statement,
        label: candidate.label,
        admission: "GENERATE_VALID" as const,
      }),
    });
    expect(seen[0]).toEqual(["Only a weaker quality."]);
    expect(seen).toHaveLength(3);
  });

  it("does not judge a repeated label and stops after six failed attempts", async () => {
    let judgeCalls = 0;
    let siblingCalls = 0;
    const saved: string[] = [];
    const repeated = await runCheckedGenerate({
      parentStatement: "A general belief",
      incumbents: [{ code: "BT01", statement: "Kept reason.", label: "Pengalaman Pengguna", admission: "GENERATE_VALID" }],
      missingWhy: null,
      topUp: true,
      propose: async () => [{ label: "Pengalaman Pengguna", statement: "A later clause about the same experience." }],
      judge: async () => {
        judgeCalls += 1;
        return validFacts();
      },
      judgeSibling: async () => {
        siblingCalls += 1;
        return distinctSet(["BT01", "NEW"]);
      },
      persist: async (candidate) => {
        saved.push(candidate.statement);
        return { code: `BT0${saved.length + 1}`, statement: candidate.statement, admission: "GENERATE_REJECT", label: candidate.label };
      },
    });
    expect(judgeCalls).toBe(0);
    expect(siblingCalls).toBe(0);
    expect(saved).toHaveLength(6);
    expect(repeated.outcome).toBe("INSUFFICIENT_VALID_BIG_THOUGHTS");

    judgeCalls = 0;
    const failed = await runCheckedGenerate({
      parentStatement: "A general belief",
      incumbents: [],
      missingWhy: null,
      topUp: true,
      propose: async () => [{ label: "Weak", statement: "Still weak." }],
      judge: async () => {
        judgeCalls += 1;
        return { ...validFacts(), relationToParent: "METHOD", explainsWhyParentIsTrue: false };
      },
      judgeSibling: async () => {
        siblingCalls += 1;
        return distinctSet(["NEW"]);
      },
      persist: async (candidate) => ({ code: candidate.statement, statement: candidate.statement, admission: "GENERATE_REJECT" }),
    });
    expect(judgeCalls).toBe(6);
    expect(siblingCalls).toBe(0);
    expect(failed.outcome).toBe("INSUFFICIENT_VALID_BIG_THOUGHTS");
  });

  it("reports each requirement before the next one, and checks siblings only after the earlier gates pass", async () => {
    const reports: string[] = [];
    let siblingAfter = "";
    let confirmed = false;
    let proposed = 0;
    await runCheckedGenerate({
      parentStatement: "A general belief",
      incumbents: [incumbent("BT01")],
      missingWhy: null,
      topUp: true,
      propose: async () => {
        proposed += 1;
        if (proposed > 1) return [];
        return [{ label: "Reason 1", statement: "A distinct support." }];
      },
      judge: async () => validFacts(),
      judgeSibling: async (rows) => {
        siblingAfter = reports.at(-1) ?? "";
        return distinctSet(rows.map((row) => row.code));
      },
      onChecklist: async (checklist) => {
        if (checklist.report) reports.push(`${checklist.report.phase}:${checklist.report.gate}`);
      },
      persist: async (candidate, facts, checklist) => {
        confirmed = facts.passConfirmed === true && checklist.passed;
        return { code: "BT02", statement: candidate.statement, label: candidate.label, admission: "GENERATE_VALID" as const };
      },
    });
    expect(siblingAfter).toBe("checking:sibling");
    expect(reports).toEqual([
      "checking:resolved",
      "checked:resolved",
      "checking:relation",
      "checked:relation",
      "checking:role",
      "checked:role",
      "checking:explains",
      "checked:explains",
      "checking:premise",
      "checked:premise",
      "checking:duplicate",
      "checked:duplicate",
      "checking:sibling",
      "checked:sibling",
    ]);
    expect(confirmed).toBe(true);
  });

  it("stops the report at the first failed requirement", async () => {
    const reports: string[] = [];
    let proposed = 0;
    await runCheckedGenerate({
      parentStatement: "A general belief",
      incumbents: [],
      missingWhy: null,
      topUp: true,
      propose: async () => {
        proposed += 1;
        if (proposed > 1) return [];
        return [{ label: "Weak", statement: "Still weak." }];
      },
      judge: async () => ({ ...validFacts(), relationToParent: "METHOD", explainsWhyParentIsTrue: false }),
      judgeSibling: async () => distinctSet(["NEW"]),
      onChecklist: async (checklist) => {
        if (checklist.report) reports.push(`${checklist.report.phase}:${checklist.report.gate}`);
      },
      persist: async (candidate) => ({ code: "BT01", statement: candidate.statement, admission: "GENERATE_REJECT" as const }),
    });
    expect(reports).toEqual([
      "checking:resolved",
      "checked:resolved",
      "checking:relation",
      "checked:relation",
    ]);
  });
});

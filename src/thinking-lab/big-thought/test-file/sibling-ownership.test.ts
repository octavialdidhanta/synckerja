import { describe, expect, it } from "vitest";
import {
  displayedAuditVerdict,
  scoreAudit,
  siblingSetIsCurrent,
  siblingSetNeedsFreshJudgment,
} from "@/thinking-lab/big-thought/audit";
import { INDIVIDUAL_CERTIFICATION_CASES } from "@/thinking-lab/big-thought/certificationCases";
import { admissionAllowed } from "@/thinking-lab/big-thought/certificationReport";
import { individualAdmission } from "@/thinking-lab/big-thought/policy";
import {
  buildBigThoughtJudgePrompt,
  buildSiblingSetPrompt,
  judgeBigThought,
  normalizeBigThoughtFacts,
  normalizeSiblingSet,
} from "@/thinking-lab/big-thought/semantic";
import type { SiblingSetFacts } from "@/thinking-lab/big-thought/types";
import { bigThoughtFingerprint, incumbentSetFingerprint } from "@/thinking-lab/shared/fingerprint";

function contributions(codes: string[]): SiblingSetFacts["reasonContributions"] {
  return codes.map((code) => ({ code, reasonContribution: `${code} reasoning job` }));
}

function siblingSet(overrides: Partial<SiblingSetFacts> = {}): SiblingSetFacts {
  return {
    fingerprint: "set",
    distinct: true,
    duplicatePairs: [],
    reasonContributions: contributions(["BT01", "BT02", "BT03"]),
    resolution: "RESOLVED",
    unresolvedReasons: [],
    ...overrides,
  };
}

const rows = [
  { code: "BT01", admission: "GENERATE_VALID" as const },
  { code: "BT02", admission: "GENERATE_VALID" as const },
  { code: "BT03", admission: "GENERATE_VALID" as const },
];

describe("sibling reason contribution", () => {
  it("fails rows that share a reasoning job despite different wording", () => {
    const items = scoreAudit({
      rows,
      siblingSet: siblingSet({
        distinct: false,
        duplicatePairs: [
          {
            a: "BT01",
            b: "BT03",
            explanation: "Different wording, same reasoning job for the parent.",
          },
        ],
      }),
      siblingSetCurrent: true,
    });
    expect(items.map((item) => item.verdict)).toEqual(["AUDIT_FAIL", "AUDIT_PASS", "AUDIT_FAIL"]);
  });

  it("does not create a conflict from a shared subject when the judge records distinct jobs", () => {
    const items = scoreAudit({
      rows: [
        { code: "BT01", admission: "GENERATE_VALID" },
        { code: "BT02", admission: "GENERATE_VALID" },
      ],
      siblingSet: siblingSet({
        distinct: true,
        duplicatePairs: [],
        reasonContributions: [
          { code: "BT01", reasonContribution: "A first foundational reason about the same subject." },
          { code: "BT02", reasonContribution: "A different foundational reason about the same subject." },
        ],
      }),
      siblingSetCurrent: true,
    });
    expect(items.map((item) => item.verdict)).toEqual(["AUDIT_PASS", "AUDIT_PASS"]);
  });

  it("requires a reason contribution for every active code before the set is resolved", () => {
    const facts = normalizeSiblingSet(
      {
        distinct: true,
        duplicatePairs: [],
        reasonContributions: contributions(["BT01", "BT02"]),
        resolution: "RESOLVED",
        unresolvedReasons: [],
      },
      "set",
      ["BT01", "BT02", "BT03"],
    );
    expect(facts.resolution).toBe("UNRESOLVED");
    expect(facts.unresolvedReasons).toContain("MISSING_REASON_CONTRIBUTION");
  });

  it("does not pass a row whose reason contribution is missing", () => {
    const items = scoreAudit({
      rows,
      siblingSet: siblingSet({ reasonContributions: contributions(["BT01", "BT02"]) }),
      siblingSetCurrent: true,
    });
    expect(items.every((item) => item.verdict !== "AUDIT_PASS")).toBe(true);
  });

  it("does not accept a conflict pair that has no explanation", () => {
    const facts = normalizeSiblingSet(
      {
        distinct: false,
        duplicatePairs: [{ a: "BT01", b: "BT03", explanation: "" }],
        reasonContributions: contributions(["BT01", "BT02", "BT03"]),
        resolution: "RESOLVED",
        unresolvedReasons: [],
      },
      "set",
      ["BT01", "BT02", "BT03"],
    );
    expect(facts.resolution).toBe("UNRESOLVED");
    expect(facts.unresolvedReasons).toContain("MISSING_PAIR_EXPLANATION");
    const items = scoreAudit({
      rows,
      siblingSet: facts,
      siblingSetCurrent: true,
    });
    expect(items.every((item) => item.verdict !== "AUDIT_PASS")).toBe(true);
  });

  it("does not treat a legacy distinct set as reason-contribution proof", () => {
    const legacy = {
      fingerprint: "set",
      distinct: true,
      duplicatePairs: [],
      resolution: "RESOLVED",
      unresolvedReasons: [],
    } as SiblingSetFacts;
    const items = scoreAudit({ rows, siblingSet: legacy, siblingSetCurrent: true });
    expect(items.every((item) => item.verdict !== "AUDIT_PASS")).toBe(true);
    expect(
      displayedAuditVerdict(
        [{ code: "BT02", verdict: "AUDIT_PASS" }],
        "set",
        "set",
        "BT02",
        { siblingSet: legacy, activeCodes: ["BT01", "BT02", "BT03"] },
      ),
    ).toBe("UNRESOLVED");
    expect(siblingSetNeedsFreshJudgment(legacy, "set", ["BT01", "BT02", "BT03"])).toBe(true);
    expect(siblingSetNeedsFreshJudgment(siblingSet(), "set", ["BT01", "BT02", "BT03"])).toBe(false);
  });

  it("marks the previous sibling judgment stale when set membership changes", () => {
    const parent = "parent";
    const before = incumbentSetFingerprint({
      masterThoughtFingerprint: parent,
      bigThoughtFingerprints: [
        bigThoughtFingerprint({ statement: "First job", masterThoughtFingerprint: parent }),
        bigThoughtFingerprint({ statement: "Second job", masterThoughtFingerprint: parent }),
      ],
    });
    const after = incumbentSetFingerprint({
      masterThoughtFingerprint: parent,
      bigThoughtFingerprints: [
        bigThoughtFingerprint({ statement: "First job", masterThoughtFingerprint: parent }),
        bigThoughtFingerprint({ statement: "Replacement job", masterThoughtFingerprint: parent }),
      ],
    });
    expect(siblingSetIsCurrent(siblingSet({ fingerprint: before }), after)).toBe(false);
    expect(displayedAuditVerdict([{ code: "BT01", verdict: "AUDIT_PASS" }], before, after, "BT01")).toBe("STALE");
  });

  it("asks the sibling judge to compare reasoning jobs rather than wording", () => {
    const prompt = buildSiblingSetPrompt({
      parentStatement: "A general belief",
      rows: [
        { code: "BT01", statement: "One statement" },
        { code: "BT02", statement: "Another statement" },
      ],
    });
    expect(prompt).toContain("different wording");
    expect(prompt).toContain("substantially the same reasoning job");
    expect(prompt).toContain("reasonContribution");
    expect(prompt).toContain("if one Big Thought were removed");
    expect(prompt).toContain("distinct material support supplied to the parent");
    expect(prompt).toContain("evidentiary jobs differ");
    expect(prompt).toContain("same recurring conduct perform the same reasoning job");
    expect(prompt).toContain("can be different reasoning jobs");
    expect(prompt).toContain("broader or narrower version");
    expect(prompt).toContain("Do not reclassify a row's relation to the Master Thought.");
  });

  it("asks the individual judge for distinct material support", () => {
    const parent = "A duty does not end at the moment of transfer; choosing who will carry it is part of that duty.";
    const candidate = "The person still has an active role in how what was transferred is used.";
    const prompt = buildBigThoughtJudgePrompt({
      parentStatement: parent,
      candidate: { code: "BT02", statement: candidate },
      siblings: [],
    });
    expect(prompt).toContain(parent);
    expect(prompt).toContain(candidate);
    expect(prompt).toContain("Parent Conclusion Test");
    expect(prompt).toContain("semantic conclusion of the Master Thought and the semantic conclusion of the candidate");
    expect(prompt).toContain("explains why the parent conclusion should be accepted");
    expect(prompt).toContain("merely says the parent conclusion again");
    expect(prompt).toContain('"relationToParent":"UNRESOLVED"');
    expect(prompt).toContain('"supportRole":"UNRESOLVED"');
    expect(prompt).not.toContain('"relationToParent":"DISTINCT_MATERIAL_SUPPORT"');
    expect(prompt).toContain("Argumentative Support Test");
    expect(prompt).toContain("Conclusion-Substitution Test");
    expect(prompt).toContain("Because Test");
    expect(prompt).toContain("Job Form Test");
    expect(prompt).toContain("[Master Thought], because [candidate]");
    expect(prompt).toContain("Normative-Conclusion Guard");
    expect(prompt).toContain("Do not classify OUTCOME merely because the surface form is an effect.");
    expect(prompt).toContain("a good person must have empathy");
    expect(prompt).toContain("Do not give the benefit of the doubt to a pass.");
    expect(prompt).toContain("Material Contribution Test");
    expect(prompt).toContain("does not need to prove the entire Master Thought by itself");
    expect(prompt).toContain("would a meaningful and distinct part of the case for the Master Thought disappear");
    expect(prompt).toContain("Do not reject a candidate merely because it does not independently establish every comparative, superlative, universal, or strengthened aspect");
    expect(prompt).toContain("distributed across multiple distinct Big Thoughts");
    expect(prompt).toContain("Sibling audit decides whether that contribution repeats another Big Thought.");
    expect(prompt).toContain("Challenger decides whether the supporting set is still missing a material contribution.");
    expect(prompt).toContain("X once kept an important promise' is weak evidence");
    expect(prompt).toContain("X consistently shows deep empathy toward people in need' can be DISTINCT_MATERIAL_SUPPORT");
    expect(prompt).toContain("X is fundamentally a very good person' is RESTATEMENT or ELABORATION");
    expect(prompt).not.toContain("same level of claim strength");
    expect(prompt).not.toContain("only supports the weaker claim that X is good");
    expect(prompt).toContain("one dominant reasoning job");
    expect(prompt).toContain("Mixed-Conclusion Guard");
    expect(prompt).toContain("Clause Independence Test");
    expect(prompt).toContain("merely because one clause contains a valid new premise");
    expect(prompt).toContain("Do not reject every multi-clause sentence");
    expect(prompt).toContain("relationToParent");
    expect(prompt).not.toMatch(/\b(blacklist|synonym|keyword)\b/i);
  });
});

function firstPassDistinct(code: string, supportRole: "PREMISE" | "REASON" | "EVIDENCE" = "REASON"): string {
  return JSON.stringify({
    code,
    whatItSays: "A claimed material support",
    relationToParent: "DISTINCT_MATERIAL_SUPPORT",
    supportRole,
    explainsWhyParentIsTrue: true,
    introducesUnsupportedPremise: false,
    duplicateOfCode: null,
    resolution: "RESOLVED",
    unresolvedReasons: [],
  });
}

describe("adversarial individual verification", () => {
  it("downgrades a moral restatement when the verifier rejects it", async () => {
    const parent = "X remains responsible after Y.";
    const candidate = "X has a moral responsibility to ensure proper handling after Y.";
    let calls = 0;
    const facts = await judgeBigThought(
      { parentStatement: parent, candidate: { code: "BT02", statement: candidate }, siblings: [] },
      async (prompt) => {
        calls += 1;
        if (calls === 1) return firstPassDistinct("BT02");
        expect(prompt).toContain("Try to falsify");
        expect(prompt).toContain("Direction Test");
        expect(prompt).toContain("REJECT_AS_RESTATEMENT");
        expect(prompt).toContain("Material support:");
        expect(prompt).toContain("Do not give the benefit of the doubt to a pass.");
        expect(prompt).toContain(parent);
        expect(prompt).toContain(candidate);
        return JSON.stringify({ verdict: "REJECT_AS_RESTATEMENT", reason: "The candidate repeats the parent conclusion." });
      },
    );
    expect(calls).toBe(2);
    expect(facts.relationToParent).toBe("RESTATEMENT");
    expect(facts.explainsWhyParentIsTrue).toBe(false);
    expect(facts.resolution).toBe("RESOLVED");
    expect(facts.unresolvedReasons).toEqual([]);
    expect(individualAdmission({ facts, factsCurrent: true })).toBe("GENERATE_REJECT");
  });

  it("treats transfer and handoff as the same conclusion across wording", async () => {
    const parent = "Responsibility does not end after transfer.";
    const candidate = "Responsibility continues after handoff.";
    let calls = 0;
    const facts = await judgeBigThought(
      { parentStatement: parent, candidate: { code: "BT05", statement: candidate }, siblings: [] },
      async (prompt) => {
        calls += 1;
        if (calls === 1) return firstPassDistinct("BT05");
        expect(prompt).toContain("Semantic Equivalence Across Abstraction");
        expect(prompt).toContain("same subject, obligation/responsibility, temporal or causal relation, and practical implication");
        expect(prompt).toContain("responsibility does not end after transfer");
        expect(prompt).toContain("responsibility continues after handoff");
        expect(prompt).toContain("transfer, handoff, ownership change, delivery");
        expect(prompt).toContain("Negation / Inversion Equivalence");
        expect(prompt).toContain("'does not end' and 'continues' are semantically equivalent");
        expect(prompt).toContain("responsibility does not stop");
        expect(prompt).toContain("responsibility continues");
        expect(prompt).toContain("responsibility remains");
        expect(prompt).toContain("Structural-Proposition Test");
        expect(prompt).toContain("SUBJECT + RELATION/OBLIGATION + EVENT/CONDITION + RESULT");
        expect(prompt).toContain("Material support:");
        expect(prompt).toContain("Clause-Repackaging Guard");
        expect(prompt).toContain("same normative proposition about the same actor");
        expect(prompt).toContain("default toward REJECT_AS_RESTATEMENT");
        expect(prompt).toContain(parent);
        expect(prompt).toContain(candidate);
        return JSON.stringify({ verdict: "REJECT_AS_RESTATEMENT", reason: "The candidate preserves the same responsibility across the same transition." });
      },
    );
    expect(calls).toBe(2);
    expect(facts.relationToParent).not.toBe("DISTINCT_MATERIAL_SUPPORT");
    expect(facts.relationToParent).toBe("RESTATEMENT");
    expect(individualAdmission({ facts, factsCurrent: true })).toBe("GENERATE_REJECT");
  });

  it("keeps a distinct causal premise when the verifier confirms it", async () => {
    const facts = await judgeBigThought(
      {
        parentStatement: "X should carefully choose a steward.",
        candidate: { code: "BT04", statement: "Different stewards can produce materially different outcomes." },
        siblings: [],
      },
      async (prompt) => {
        if (!prompt.includes("adversarial verifier")) return firstPassDistinct("BT04", "PREMISE");
        expect(prompt).toContain("different stewards can produce materially different outcomes");
        expect(prompt).toContain("CONFIRM_MATERIAL_SUPPORT as PREMISE or REASON");
        return JSON.stringify({
          verdict: "CONFIRM_MATERIAL_SUPPORT",
          reason: "Material support: different outcomes are a causal premise absent from the duty to choose.",
        });
      },
    );
    expect(facts.relationToParent).toBe("DISTINCT_MATERIAL_SUPPORT");
    expect(facts.supportRole).toBe("PREMISE");
    expect(individualAdmission({ facts, factsCurrent: true })).toBe("GENERATE_VALID");
  });

  it("does not call the verifier when the first pass is already a restatement", async () => {
    let calls = 0;
    const facts = await judgeBigThought(
      {
        parentStatement: "X remains responsible after Y.",
        candidate: { code: "BT02", statement: "X has an ongoing responsibility after Y." },
        siblings: [],
      },
      async () => {
        calls += 1;
        return JSON.stringify({
          code: "BT02",
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
    );
    expect(calls).toBe(1);
    expect(facts.relationToParent).toBe("RESTATEMENT");
  });

  it("accepts CONFIRM_MATERIAL_SUPPORT only when the reason starts with Material support:", async () => {
    const ask = (reason: string) =>
      judgeBigThought(
        {
          parentStatement: "X should carefully choose a steward.",
          candidate: { code: "BT04", statement: "Different stewards can produce materially different outcomes." },
          siblings: [],
        },
        async (prompt) =>
          prompt.includes("adversarial verifier")
            ? JSON.stringify({ verdict: "CONFIRM_MATERIAL_SUPPORT", reason })
            : firstPassDistinct("BT04", "PREMISE"),
      );

    const confirmed = await ask("Material support: different outcomes are a causal premise absent from the duty to choose.");
    expect(confirmed.relationToParent).toBe("DISTINCT_MATERIAL_SUPPORT");
    expect(confirmed.supportRole).toBe("PREMISE");
    expect(confirmed.resolution).toBe("RESOLVED");
    expect(individualAdmission({ facts: confirmed, factsCurrent: true })).toBe("GENERATE_VALID");

    for (const reason of ["A non-empty reason without the required prefix.", ""]) {
      const rejected = await ask(reason);
      expect(rejected.relationToParent).toBe("UNRESOLVED");
      expect(rejected.explainsWhyParentIsTrue).toBe("unresolved");
      expect(rejected.resolution).toBe("UNRESOLVED");
      expect(rejected.unresolvedReasons).toEqual(["ADVERSARIAL_UNRESOLVED"]);
    }
  });

  it("keeps restatement and elaboration rejections resolved", async () => {
    const judge = (verdict: "REJECT_AS_RESTATEMENT" | "REJECT_AS_ELABORATION") =>
      judgeBigThought(
        {
          parentStatement: "X remains responsible after Y.",
          candidate: { code: "BT02", statement: "X has a moral responsibility to ensure proper handling after Y." },
          siblings: [],
        },
        async (prompt) =>
          prompt.includes("adversarial verifier")
            ? JSON.stringify({ verdict, reason: "The candidate repeats the parent conclusion." })
            : firstPassDistinct("BT02", "EVIDENCE"),
      );

    const restatement = await judge("REJECT_AS_RESTATEMENT");
    expect(restatement.relationToParent).toBe("RESTATEMENT");
    expect(restatement.supportRole).toBe("UNRESOLVED");
    expect(restatement.explainsWhyParentIsTrue).toBe(false);
    expect(restatement.resolution).toBe("RESOLVED");
    expect(restatement.unresolvedReasons).toEqual([]);

    const elaboration = await judge("REJECT_AS_ELABORATION");
    expect(elaboration.relationToParent).toBe("ELABORATION");
    expect(elaboration.supportRole).toBe("UNRESOLVED");
    expect(elaboration.explainsWhyParentIsTrue).toBe(false);
    expect(elaboration.resolution).toBe("RESOLVED");
    expect(elaboration.unresolvedReasons).toEqual([]);
  });

  it("fails closed when the verifier cannot identify an independent premise", async () => {
    const facts = await judgeBigThought(
      {
        parentStatement: "X remains responsible after Y.",
        candidate: { code: "BT02", statement: "X still bears a duty after Y." },
        siblings: [],
      },
      async (prompt) =>
        prompt.includes("adversarial verifier")
          ? JSON.stringify({ verdict: "UNRESOLVED", reason: "No independent premise is clear." })
          : firstPassDistinct("BT02"),
    );
    expect(facts.relationToParent).toBe("UNRESOLVED");
    expect(facts.supportRole).toBe("UNRESOLVED");
    expect(facts.explainsWhyParentIsTrue).toBe("unresolved");
    expect(facts.resolution).toBe("UNRESOLVED");
    expect(facts.unresolvedReasons).toEqual(["ADVERSARIAL_UNRESOLVED"]);
    expect(individualAdmission({ facts, factsCurrent: true })).toBe("UNRESOLVED");
  });

  it("rejects a restated evaluation and can keep behavioral or impact evidence", async () => {
    const parent = "X is exceptionally good.";
    const restatement = await judgeBigThought(
      {
        parentStatement: parent,
        candidate: { code: "BT02", statement: "X is fundamentally good and compassionate." },
        siblings: [],
      },
      async (prompt) => {
        if (!prompt.includes("adversarial verifier")) return firstPassDistinct("BT02");
        expect(prompt).toContain("X is fundamentally good and compassionate");
        expect(prompt).toContain("REJECT_AS_RESTATEMENT");
        return JSON.stringify({ verdict: "REJECT_AS_RESTATEMENT", reason: "The candidate repeats the evaluation." });
      },
    );
    expect(restatement.relationToParent).toBe("RESTATEMENT");
    expect(individualAdmission({ facts: restatement, factsCurrent: true })).toBe("GENERATE_REJECT");

    const evidence = await judgeBigThought(
      {
        parentStatement: parent,
        candidate: { code: "BT03", statement: "X remains empathetic toward others even under pressure." },
        siblings: [],
      },
      async (prompt) => {
        if (!prompt.includes("adversarial verifier")) return firstPassDistinct("BT03", "EVIDENCE");
        expect(prompt).toContain("X remains empathetic toward others even under pressure");
        expect(prompt).toContain("Do not reject valid evidence merely because");
        return JSON.stringify({
          verdict: "CONFIRM_MATERIAL_SUPPORT",
          reason: "Material support: observable empathy under pressure makes the evaluation more defensible.",
        });
      },
    );
    expect(evidence.relationToParent).toBe("DISTINCT_MATERIAL_SUPPORT");
    expect(evidence.supportRole).toBe("EVIDENCE");
    expect(individualAdmission({ facts: evidence, factsCurrent: true })).toBe("GENERATE_VALID");

    const impact = await judgeBigThought(
      {
        parentStatement: parent,
        candidate: { code: "BT04", statement: "X's presence consistently increases other people's sense of safety and wellbeing." },
        siblings: [],
      },
      async (prompt) => {
        if (!prompt.includes("adversarial verifier")) return firstPassDistinct("BT04", "EVIDENCE");
        expect(prompt).toContain("Do not reject valid evidence merely because");
        expect(prompt).toContain("Master Thought → candidate");
        return JSON.stringify({
          verdict: "CONFIRM_MATERIAL_SUPPORT",
          reason: "Material support: the recurring effect is evidence for the evaluation.",
        });
      },
    );
    expect(impact.relationToParent).toBe("DISTINCT_MATERIAL_SUPPORT");
    expect(impact.supportRole).toBe("EVIDENCE");
    expect(individualAdmission({ facts: impact, factsCurrent: true })).toBe("GENERATE_VALID");
  });

  it("maps criterion, example, method, tactic, and execution rejections onto the existing taxonomy", async () => {
    const cases = [
      ["REJECT_AS_CRITERION", "CRITERION", "A good person must have empathy."],
      ["REJECT_AS_EXAMPLE", "EXAMPLE", "One trivial illustration of X."],
      ["REJECT_AS_METHOD", "METHOD", "X becomes good by following a procedure."],
      ["REJECT_AS_TACTIC", "TACTIC", "X should take this practical step."],
      ["REJECT_AS_EXECUTION", "EXECUTION", "X carries the belief out through a concrete medium."],
      ["REJECT_AS_OUTCOME", "OUTCOME", "People applaud after X is accepted."],
      ["REJECT_AS_CONSEQUENCE", "CONSEQUENCE", "Accepting X leads to a later result that does not support X."],
      ["REJECT_AS_UNSUPPORTED_PREMISE", "UNSUPPORTED_PREMISE", "An unsupported new claim about X."],
    ] as const;
    for (const [verdict, relation, statement] of cases) {
      const facts = await judgeBigThought(
        { parentStatement: "X is exceptionally good.", candidate: { code: "BT06", statement }, siblings: [] },
        async (prompt) =>
          prompt.includes("adversarial verifier")
            ? JSON.stringify({ verdict, reason: "The candidate does not supply material support." })
            : firstPassDistinct("BT06"),
      );
      expect(facts.relationToParent).toBe(relation);
      expect(facts.supportRole).toBe("UNRESOLVED");
      expect(facts.explainsWhyParentIsTrue).toBe(false);
      expect(facts.resolution).toBe("RESOLVED");
      expect(facts.unresolvedReasons).toEqual([]);
      expect(individualAdmission({ facts, factsCurrent: true })).toBe("GENERATE_REJECT");
    }
  });

  it("does not treat a stored foundational relation as a valid material support", () => {
    const facts = normalizeBigThoughtFacts({
      code: "BT01",
      whatItSays: "An old positive classification",
      relationToParent: "DISTINCT_FOUNDATIONAL_WHY",
      supportRole: "PREMISE",
      explainsWhyParentIsTrue: true,
      introducesUnsupportedPremise: false,
      duplicateOfCode: null,
      resolution: "RESOLVED",
      unresolvedReasons: [],
    });
    expect(facts.relationToParent).toBe("UNRESOLVED");
    expect(facts.supportRole).toBe("UNRESOLVED");
    expect(facts.resolution).toBe("UNRESOLVED");
    expect(facts.unresolvedReasons).toContain("LEGACY_POSITIVE_RELATION");
    expect(individualAdmission({ facts, factsCurrent: true })).toBe("UNRESOLVED");
  });

  it("accepts partial evidence for a superlative parent and rejects a restatement or a single occasion", async () => {
    const passes = [
      "X consistently shows deep empathy toward people in need.",
      "X always gives unconditional support to people in need.",
      "X makes other people feel safe and valued.",
      "X keeps giving without expecting a reward.",
    ];
    for (const candidate of passes) {
      const facts = await judgeBigThought(
        { parentStatement: "X is the best person.", candidate: { code: "BT08", statement: candidate }, siblings: [] },
        async (prompt) => {
          if (!prompt.includes("adversarial verifier")) return firstPassDistinct("BT08", "EVIDENCE");
          expect(prompt).toContain("Material Contribution Test");
          expect(prompt).toContain("Do not require the candidate to independently prove the entire Master Thought.");
          expect(prompt).toContain("Do not reject valid evidence merely because other Big Thoughts are needed to complete the case.");
          expect(prompt).toContain("X consistently shows deep empathy toward people in need' can be CONFIRM_MATERIAL_SUPPORT as EVIDENCE");
          expect(prompt).not.toContain("X consistently shows empathy' is REJECT_AS_ELABORATION");
          expect(prompt).toContain("Sibling audit decides whether two contributions repeat the same reasoning job.");
          expect(prompt).toContain(candidate);
          return JSON.stringify({
            verdict: "CONFIRM_MATERIAL_SUPPORT",
            reason: "Material support: this evidence contributes a distinct reason based on consistent empathy, strengthening the overall case for the evaluation without duplicating another support.",
          });
        },
      );
      expect(facts.relationToParent).toBe("DISTINCT_MATERIAL_SUPPORT");
      expect(facts.supportRole).toBe("EVIDENCE");
      expect(individualAdmission({ facts, factsCurrent: true })).toBe("GENERATE_VALID");
    }

    const restatement = await judgeBigThought(
      {
        parentStatement: "X is the best person.",
        candidate: { code: "BT09", statement: "X is fundamentally a very good person." },
        siblings: [],
      },
      async (prompt) => {
        if (!prompt.includes("adversarial verifier")) return firstPassDistinct("BT09", "EVIDENCE");
        expect(prompt).toContain("X is fundamentally a very good person' is REJECT_AS_RESTATEMENT or REJECT_AS_ELABORATION");
        return JSON.stringify({ verdict: "REJECT_AS_RESTATEMENT", reason: "The candidate repeats the evaluation." });
      },
    );
    expect(restatement.relationToParent).toBe("RESTATEMENT");
    expect(individualAdmission({ facts: restatement, factsCurrent: true })).toBe("GENERATE_REJECT");

    const weak = await judgeBigThought(
      {
        parentStatement: "X always keeps a promise.",
        candidate: { code: "BT10", statement: "X once kept an important promise." },
        siblings: [],
      },
      async (prompt) => {
        if (!prompt.includes("adversarial verifier")) return firstPassDistinct("BT10", "EVIDENCE");
        expect(prompt).toContain("too weak for its own consistency job");
        return JSON.stringify({ verdict: "REJECT_AS_ELABORATION", reason: "One occasion does not support the consistency job." });
      },
    );
    expect(weak.relationToParent).not.toBe("DISTINCT_MATERIAL_SUPPORT");
    expect(individualAdmission({ facts: weak, factsCurrent: true })).toBe("GENERATE_REJECT");

    const consistent = await judgeBigThought(
      {
        parentStatement: "X always keeps a promise.",
        candidate: { code: "BT11", statement: "Across many situations and a long time, X keeps the promises X has made." },
        siblings: [],
      },
      async (prompt) =>
        prompt.includes("adversarial verifier")
          ? JSON.stringify({
              verdict: "CONFIRM_MATERIAL_SUPPORT",
              reason: "Material support: the long pattern is a distinct consistency contribution to the overall case.",
            })
          : firstPassDistinct("BT11", "EVIDENCE"),
    );
    expect(consistent.relationToParent).toBe("DISTINCT_MATERIAL_SUPPORT");
    expect(consistent.supportRole).toBe("EVIDENCE");
    expect(individualAdmission({ facts: consistent, factsCurrent: true })).toBe("GENERATE_VALID");
  });
});

describe("mixed-conclusion guard", () => {
  const parent =
    "tanggung jawab dalam memberikan perpuluhan tidak berhenti pada penyerahan dana perpuluhan itu saja, tetapi kesungguhan memilih wadah yang akan mengelolanya juga merupakan bagian dari tanggung jawab pemberi.";

  function resolvedExclusion(code: string, relation: "RESTATEMENT" | "ELABORATION"): string {
    return JSON.stringify({
      code,
      whatItSays: "A judged statement",
      relationToParent: relation,
      supportRole: "UNRESOLVED",
      explainsWhyParentIsTrue: false,
      introducesUnsupportedPremise: false,
      duplicateOfCode: null,
      resolution: "RESOLVED",
      unresolvedReasons: [],
    });
  }

  it("keeps a pure restatement rejected without a second pass", async () => {
    const candidate = "Tanggung jawab pemberi tetap berlanjut setelah dana perpuluhan diserahkan.";
    let calls = 0;
    const facts = await judgeBigThought(
      { parentStatement: parent, candidate: { code: "NEW", statement: candidate }, siblings: [] },
      async (prompt) => {
        calls += 1;
        expect(prompt).toContain("Mixed-Conclusion Guard");
        expect(prompt).not.toContain("adversarial verifier");
        return resolvedExclusion("NEW", "RESTATEMENT");
      },
    );
    expect(calls).toBe(1);
    expect(facts.relationToParent).toBe("RESTATEMENT");
    expect(individualAdmission({ facts, factsCurrent: true })).toBe("GENERATE_REJECT");
  });

  it("rejects a new premise attached to a restated parent conclusion", async () => {
    const candidate =
      "Perpuluhan mencerminkan komitmen spiritual pemberi, sehingga pemilihan wadah yang bertanggung jawab juga harus dilakukan dengan sungguh-sungguh.";
    const facts = await judgeBigThought(
      { parentStatement: parent, candidate: { code: "NEW", statement: candidate }, siblings: [] },
      async (prompt) => {
        if (!prompt.includes("adversarial verifier")) {
          expect(prompt).toContain("Clause Independence Test");
          expect(prompt).toContain("Prefer ELABORATION when the candidate combines a new premise");
          expect(prompt).toContain(
            "Pemberian mencerminkan komitmen spiritual, sehingga pemilihan wadah harus dilakukan dengan sungguh-sungguh.",
          );
          expect(prompt).toContain(candidate);
          return firstPassDistinct("NEW", "PREMISE");
        }
        expect(prompt).toContain(
          "Does this candidate contain a valid support clause plus another clause that restates or reproduces the parent conclusion?",
        );
        expect(prompt).toContain(
          "Pemberian mencerminkan komitmen spiritual, sehingga pemilihan wadah harus dilakukan dengan sungguh-sungguh.' is REJECT_AS_ELABORATION",
        );
        return JSON.stringify({
          verdict: "REJECT_AS_ELABORATION",
          reason: "The second clause restates the parent conclusion.",
        });
      },
    );
    expect(facts.relationToParent).toBe("ELABORATION");
    expect(facts.supportRole).toBe("UNRESOLVED");
    expect(individualAdmission({ facts, factsCurrent: true })).toBe("GENERATE_REJECT");
  });

  it("still admits one dominant causal job and a standalone premise", async () => {
    const passes = [
      {
        statement:
          "Pengelola yang berbeda dapat menggunakan dana yang sama dengan tingkat integritas dan dampak yang berbeda.",
        role: "REASON" as const,
      },
      {
        statement:
          "Setelah dana diserahkan, pemberi kehilangan sebagian besar kendali langsung atas bagaimana dana tersebut digunakan.",
        role: "REASON" as const,
      },
      {
        statement: "Perpuluhan mencerminkan komitmen spiritual pemberi.",
        role: "PREMISE" as const,
      },
    ];
    for (const row of passes) {
      const facts = await judgeBigThought(
        { parentStatement: parent, candidate: { code: "NEW", statement: row.statement }, siblings: [] },
        async (prompt) => {
          if (!prompt.includes("adversarial verifier")) return firstPassDistinct("NEW", row.role);
          expect(prompt).toContain("Do not reject every multi-clause sentence");
          expect(prompt).toContain("different stewards materially change outcomes");
          expect(prompt).toContain("may be CONFIRM_MATERIAL_SUPPORT as PREMISE");
          return JSON.stringify({
            verdict: "CONFIRM_MATERIAL_SUPPORT",
            reason: "Material support: the candidate supplies one distinct contribution to the overall case.",
          });
        },
      );
      expect(facts.relationToParent).toBe("DISTINCT_MATERIAL_SUPPORT");
      expect(facts.supportRole).toBe(row.role);
      expect(individualAdmission({ facts, factsCurrent: true })).toBe("GENERATE_VALID");
    }
  });
});

describe("unsupported premise warrant", () => {
  function unsupportedFirstPass(code: string): string {
    return JSON.stringify({
      code,
      whatItSays: "A strong factual assertion",
      relationToParent: "UNSUPPORTED_PREMISE",
      supportRole: "PREMISE",
      explainsWhyParentIsTrue: true,
      introducesUnsupportedPremise: false,
      duplicateOfCode: null,
      resolution: "RESOLVED",
      unresolvedReasons: [],
    });
  }

  async function judged(parent: string, candidate: string, script: (prompt: string) => string) {
    return judgeBigThought(
      { parentStatement: parent, candidate: { code: "NEW", statement: candidate }, siblings: [] },
      async (prompt) => script(prompt),
    );
  }

  it("rejects the golden unsupported premise and keeps the warrant field consistent", async () => {
    const golden = INDIVIDUAL_CERTIFICATION_CASES.find((row) => row.id === "unsupported-premise");
    expect(golden).toBeTruthy();
    const facts = await judged(golden!.parentStatement, golden!.candidateStatement, (prompt) => {
      expect(prompt).toContain("Unsupported Premise Guard");
      expect(prompt).toContain("NEW INFORMATION is not UNSUPPORTED_PREMISE");
      expect(prompt).toContain("the parent does not state this fact, therefore it is unsupported' is invalid");
      expect(prompt).toContain("If this were true, it would strongly support the parent");
      expect(prompt).toContain("warning signs, not automatic rejection rules");
      expect(prompt).toContain(golden!.candidateStatement);
      expect(prompt).toContain("Different stewards can use the same resources with materially different integrity and outcomes.");
      expect(prompt).toContain("After resources are handed over, the giver loses direct control over how they are used.");
      if (prompt.includes("adversarial verifier")) {
        return JSON.stringify({ verdict: "REJECT_AS_UNSUPPORTED_PREMISE", reason: "The factual guarantee is not warranted." });
      }
      return firstPassDistinct("NEW", "PREMISE");
    });
    expect(facts.relationToParent).toBe("UNSUPPORTED_PREMISE");
    expect(facts.introducesUnsupportedPremise).toBe(true);
    const admission = individualAdmission({ facts, factsCurrent: true });
    expect(admission).not.toBe("GENERATE_VALID");
    expect(admissionAllowed(golden!.expectedAdmission, admission)).toBe(true);

    const fromFirstPass = await judged(golden!.parentStatement, golden!.candidateStatement, () => unsupportedFirstPass("NEW"));
    expect(fromFirstPass.introducesUnsupportedPremise).toBe(true);
    expect(individualAdmission({ facts: fromFirstPass, factsCurrent: true })).toBe("GENERATE_REJECT");
  });

  it("rejects unsupported universal, numerical, and deterministic claims", async () => {
    const parent = "Choosing who will carry a duty is part of that duty.";
    const candidates = [
      "Every bearer will certainly abandon an unchecked duty.",
      "Within 30 days, 90 percent of bearers will lose the resources.",
      "Lack of checking necessarily causes the bearer to divert the resources.",
    ];
    for (const candidate of candidates) {
      const facts = await judged(parent, candidate, (prompt) => {
        expect(prompt).toContain("universal or absolute certainty");
        expect(prompt).toContain("precise quantities or proportions");
        expect(prompt).toContain("exact time horizons");
        expect(prompt).toContain("deterministic predictions");
        expect(prompt).toContain("strong causal guarantees");
        return prompt.includes("adversarial verifier")
          ? JSON.stringify({ verdict: "REJECT_AS_UNSUPPORTED_PREMISE", reason: "The specific certainty is not defensible." })
          : firstPassDistinct("NEW", "PREMISE");
      });
      expect(facts.relationToParent).toBe("UNSUPPORTED_PREMISE");
      expect(facts.introducesUnsupportedPremise).toBe(true);
      expect(individualAdmission({ facts, factsCurrent: true })).not.toBe("GENERATE_VALID");
    }
  });

  it("keeps ordinary premises and warranted evidence valid", async () => {
    const premise = await judged(
      "Choosing who will carry a duty is part of that duty.",
      "Different stewards can use the same resources with materially different integrity and outcomes.",
      (prompt) =>
        prompt.includes("adversarial verifier")
          ? JSON.stringify({
              verdict: "CONFIRM_MATERIAL_SUPPORT",
              reason: "Material support: different stewards supply a general causal premise for careful selection.",
            })
          : firstPassDistinct("NEW", "PREMISE"),
    );
    expect(premise.relationToParent).toBe("DISTINCT_MATERIAL_SUPPORT");
    expect(premise.supportRole).toBe("PREMISE");
    expect(premise.introducesUnsupportedPremise).toBe(false);
    expect(individualAdmission({ facts: premise, factsCurrent: true })).toBe("GENERATE_VALID");

    const causal = await judged(
      "Choosing who will carry a duty is part of that duty.",
      "After resources are handed over, the giver loses direct control over how they are used.",
      (prompt) =>
        prompt.includes("adversarial verifier")
          ? JSON.stringify({
              verdict: "CONFIRM_MATERIAL_SUPPORT",
              reason: "Material support: loss of direct control is an ordinary defensible premise for careful selection.",
            })
          : firstPassDistinct("NEW", "REASON"),
    );
    expect(causal.relationToParent).toBe("DISTINCT_MATERIAL_SUPPORT");
    expect(causal.supportRole).toBe("REASON");
    expect(causal.introducesUnsupportedPremise).toBe(false);
    expect(individualAdmission({ facts: causal, factsCurrent: true })).toBe("GENERATE_VALID");

    const evidence = await judged(
      "X is exceptionally good.",
      "This person consistently shows deep empathy toward people in need.",
      (prompt) =>
        prompt.includes("adversarial verifier")
          ? JSON.stringify({
              verdict: "CONFIRM_MATERIAL_SUPPORT",
              reason: "Material support: the consistent empathy is warranted evidence for the evaluation.",
            })
          : firstPassDistinct("NEW", "EVIDENCE"),
    );
    expect(evidence.relationToParent).toBe("DISTINCT_MATERIAL_SUPPORT");
    expect(evidence.supportRole).toBe("EVIDENCE");
    expect(evidence.introducesUnsupportedPremise).toBe(false);
    expect(individualAdmission({ facts: evidence, factsCurrent: true })).toBe("GENERATE_VALID");
  });

  it("keeps generic guards without memorizing the suspect regression sentences", async () => {
    const elaboration = INDIVIDUAL_CERTIFICATION_CASES.find((row) => row.id === "suspect-commitment-elaboration");
    const purity = INDIVIDUAL_CERTIFICATION_CASES.find((row) => row.id === "suspect-moral-purity");
    const recipient = INDIVIDUAL_CERTIFICATION_CASES.find((row) => row.id === "control-recipient-effect");
    const loss = INDIVIDUAL_CERTIFICATION_CASES.find((row) => row.id === "control-loss-of-control-full");
    const intention = INDIVIDUAL_CERTIFICATION_CASES.find((row) => row.id === "control-intention-not-guarantee");
    expect(elaboration?.candidateStatement).toContain("mencerminkan kedalaman komitmennya");
    expect(purity?.candidateStatement).toContain("kesucian tindakan memberi");
    expect(recipient?.expectedAdmission).toBe("GENERATE_VALID");
    expect(loss?.expectedAdmission).toBe("GENERATE_VALID");
    expect(intention?.expectedAdmission).toBe("GENERATE_VALID");
    const seen: string[] = [];
    const elaborated = await judged(
      "Choosing who will carry a duty is part of that duty.",
      "Different stewards can produce materially different outcomes.",
      (prompt) => {
        seen.push(prompt);
        expect(prompt).not.toContain(elaboration!.candidateStatement);
        expect(prompt).not.toContain(purity!.candidateStatement);
        expect(prompt).toContain("Material Contribution Test");
        expect(prompt).toContain("Evaluative Elaboration Guard");
        expect(prompt).toContain("Unsupported Premise Guard");
        if (prompt.includes("adversarial verifier")) {
          return JSON.stringify({ verdict: "REJECT_AS_ELABORATION", reason: "The candidate says what the parent behavior symbolizes." });
        }
        return firstPassDistinct("NEW", "REASON");
      },
    );
    expect(seen.some((prompt) => prompt.includes("adversarial verifier"))).toBe(true);
    expect(seen.some((prompt) => !prompt.includes("adversarial verifier"))).toBe(true);
    expect(elaborated.relationToParent).toBe("ELABORATION");
    expect(individualAdmission({ facts: elaborated, factsCurrent: true })).not.toBe("GENERATE_VALID");
    const moral = await judged(purity!.parentStatement, purity!.candidateStatement, (prompt) => {
      const instruction = prompt.slice(0, prompt.lastIndexOf("Candidate:"));
      expect(instruction).not.toContain(purity!.candidateStatement);
      expect(instruction).not.toContain(elaboration!.candidateStatement);
      if (prompt.includes("adversarial verifier")) {
        return JSON.stringify({ verdict: "REJECT_AS_UNSUPPORTED_PREMISE", reason: "The evaluative claim is not warranted." });
      }
      return firstPassDistinct("NEW", "REASON");
    });
    expect(moral.relationToParent).toBe("UNSUPPORTED_PREMISE");
    expect(moral.introducesUnsupportedPremise).toBe(true);
    expect(admissionAllowed(purity!.expectedAdmission, individualAdmission({ facts: moral, factsCurrent: true }))).toBe(true);
  });
});

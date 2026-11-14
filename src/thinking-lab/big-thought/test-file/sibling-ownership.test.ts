import { describe, expect, it } from "vitest";
import {
  displayedAuditVerdict,
  scoreAudit,
  siblingSetIsCurrent,
} from "@/thinking-lab/big-thought/audit";
import { individualAdmission } from "@/thinking-lab/big-thought/policy";
import { buildSiblingSetPrompt, normalizeBigThoughtFacts, normalizeSiblingSet } from "@/thinking-lab/big-thought/semantic";
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
});

describe("stored Big Thought facts", () => {
  it("does not treat a stored foundational relation as a valid material support", () => {
    const facts = normalizeBigThoughtFacts({
      code: "BT01",
      whatItSays: "An old positive classification",
      relationToParent: "DISTINCT_FOUNDATIONAL_WHY",
      explainsWhyParentIsTrue: true,
      introducesUnsupportedPremise: false,
      duplicateOfCode: null,
      resolution: "RESOLVED",
      unresolvedReasons: [],
    });
    expect(facts.relationToParent).toBe("UNRESOLVED");
    expect(facts.resolution).toBe("UNRESOLVED");
    expect(facts.unresolvedReasons).toContain("LEGACY_POSITIVE_RELATION");
    expect(individualAdmission({ facts, factsCurrent: true })).toBe("UNRESOLVED");
  });
});

describe("sibling set prompt", () => {
  it("shows no sample pair the model could copy, and drops pairs whose jobs differ", () => {
    const prompt = buildSiblingSetPrompt({
      parentStatement: "Sate kambing muda sama juicy-nya dengan wagyu.",
      rows: [
        { code: "BT01", statement: "lemak kambing muda terselip di dalam serat" },
        { code: "BT02", statement: "serat kambing muda halus dan pendek" },
      ],
    });
    expect(prompt).not.toContain('"a":"BT01"');
    expect(prompt).not.toContain('"b":"BT03"');
    expect(prompt).toContain("do not list that pair");
  });
});

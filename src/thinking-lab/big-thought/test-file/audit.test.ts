import { describe, expect, it } from "vitest";
import { evaluateLock } from "@/thinking-lab/big-thought/lock";
import {
  auditSiblingGate,
  keptPassingAuditItems,
  exclusionsForParent,
  nextAuthoritativeSetRecord,
  scoreAudit,
  siblingReasonProofReady,
  parseLabSetRecord,
  mergeFixLessons,
  mergeGenerateLessons,
  dropFixLessons,
  clearSetConclusions,
  emptySetRecord,
} from "@/thinking-lab/big-thought/audit";
import type { LabSetRecord, SiblingSetFacts } from "@/thinking-lab/big-thought/types";
import { bigThoughtFingerprint, incumbentSetFingerprint } from "@/thinking-lab/shared/fingerprint";

function siblingSet(overrides: Partial<SiblingSetFacts> = {}): SiblingSetFacts {
  return {
    fingerprint: "set",
    distinct: true,
    duplicatePairs: [],
    reasonContributions: [],
    resolution: "RESOLVED",
    unresolvedReasons: [],
    ...overrides,
  };
}

function contributions(codes: string[]): SiblingSetFacts["reasonContributions"] {
  return codes.map((code) => ({ code, reasonContribution: `${code} reasoning job` }));
}

describe("keptPassingAuditItems", () => {
  it("keeps an unchanged AUDIT_PASS and drops the edited Big Thought", () => {
    const kept = keptPassingAuditItems({
      editedCode: "BT06",
      items: [
        { code: "BT01", verdict: "AUDIT_PASS", statementFingerprint: "fp-01", gatesChecked: true },
        { code: "BT02", verdict: "AUDIT_PASS", statementFingerprint: "fp-02" },
        { code: "BT06", verdict: "AUDIT_PASS", statementFingerprint: "fp-06" },
      ],
      rows: [
        { code: "BT01", statementFingerprint: "fp-01" },
        { code: "BT02", statementFingerprint: "fp-02" },
        { code: "BT06", statementFingerprint: "fp-06-edited" },
      ],
    });
    expect(kept.map((item) => item.code)).toEqual(["BT01", "BT02"]);
    expect(kept[0]?.gatesChecked).toBe(true);
  });
});

describe("set audit", () => {
  it("writes AUDIT_PASS without changing GENERATE_VALID", () => {
    const rows = [
      { code: "BT01", admission: "GENERATE_VALID" as const },
      { code: "BT02", admission: "GENERATE_VALID" as const },
    ];
    const items = scoreAudit({
      rows,
      siblingSet: siblingSet({ reasonContributions: contributions(["BT01", "BT02"]) }),
      siblingSetCurrent: true,
    });
    expect(items.map((item) => item.verdict)).toEqual(["AUDIT_PASS", "AUDIT_PASS"]);
    expect(rows[0]?.admission).toBe("GENERATE_VALID");
  });

  it("fails only the duplicate codes", () => {
    const items = scoreAudit({
      rows: [
        { code: "BT01", admission: "GENERATE_VALID" },
        { code: "BT02", admission: "GENERATE_VALID" },
        { code: "BT03", admission: "GENERATE_VALID" },
      ],
      siblingSet: siblingSet({
        distinct: false,
        duplicatePairs: [{ a: "BT01", b: "BT02", explanation: "Same reasoning job." }],
        reasonContributions: contributions(["BT01", "BT02", "BT03"]),
      }),
      siblingSetCurrent: true,
    });
    expect(items.map((item) => item.verdict)).toEqual(["AUDIT_FAIL", "AUDIT_FAIL", "AUDIT_PASS"]);
  });

  it("marks a stale sibling set as stale", () => {
    const items = scoreAudit({
      rows: [{ code: "BT01", admission: "GENERATE_VALID" }],
      siblingSet: siblingSet(),
      siblingSetCurrent: false,
    });
    expect(items[0]?.verdict).toBe("STALE");
  });

  it("reports the sibling gate from the same audit score", () => {
    const passed = auditSiblingGate({
      code: "BT02",
      siblingSet: siblingSet({
        distinct: false,
        duplicatePairs: [{ a: "BT01", b: "BT03", explanation: "Those two overlap." }],
        reasonContributions: contributions(["BT01", "BT02", "BT03"]),
      }),
      siblingSetCurrent: true,
      activeCodes: ["BT01", "BT02", "BT03"],
    });
    const failed = auditSiblingGate({
      code: "BT01",
      siblingSet: siblingSet({
        distinct: false,
        duplicatePairs: [{ a: "BT01", b: "BT03", explanation: "Same reasoning job." }],
        reasonContributions: contributions(["BT01", "BT02", "BT03"]),
      }),
      siblingSetCurrent: true,
      activeCodes: ["BT01", "BT02", "BT03"],
    });
    expect(passed).toEqual({ passed: true, reason: "" });
    expect(failed).toEqual({ passed: false, reason: "Same reasoning job." });
  });
});

function auditedSet(): {
  record: LabSetRecord;
  setFingerprint: string;
} {
  const parent = "parent";
  const statements = [
    { code: "BT01", statement: "First why" },
    { code: "BT02", statement: "Second why" },
    { code: "BT03", statement: "Third why" },
  ];
  const setFingerprint = incumbentSetFingerprint({
    masterThoughtFingerprint: parent,
    bigThoughtFingerprints: statements.map((row) =>
      bigThoughtFingerprint({ statement: row.statement, masterThoughtFingerprint: parent }),
    ),
  });
  const record: LabSetRecord = {
    schema: "thinking-lab/v1",
    siblingSet: siblingSet({
      fingerprint: setFingerprint,
      distinct: false,
      duplicatePairs: [{ a: "BT01", b: "BT03", explanation: "Same reasoning job." }],
      reasonContributions: contributions(["BT01", "BT02", "BT03"]),
    }),
    audit: {
      setFingerprint,
      items: [
        { code: "BT01", verdict: "AUDIT_FAIL" },
        { code: "BT02", verdict: "AUDIT_PASS" },
        { code: "BT03", verdict: "AUDIT_FAIL" },
      ],
    },
    semanticExclusions: null,
  };
  return { record, setFingerprint };
}

describe("audit record history", () => {
  it("replaces the authoritative sibling set without deleting exclusion history", () => {
    const { record, setFingerprint } = auditedSet();
    const fresh = siblingSet({
      fingerprint: `${setFingerprint}-next`,
      reasonContributions: contributions(["BT01", "BT02", "BT04"]),
    });
    const next = nextAuthoritativeSetRecord({
      record,
      parentFingerprint: "parent",
      siblingSet: fresh,
      audit: { setFingerprint: fresh.fingerprint, items: [{ code: "BT01", verdict: "AUDIT_PASS" }] },
    });
    expect(next.siblingSet).toEqual(fresh);
    expect(next.semanticExclusions?.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reasonContribution: "BT01 reasoning job" }),
        expect.objectContaining({ explanation: "Same reasoning job." }),
      ]),
    );
  });

  it("does not let exclusion history satisfy audit or lock", () => {
    const { record } = auditedSet();
    record.semanticExclusions = {
      parentFingerprint: "parent",
      entries: [{ reasonContribution: "A stored job", explanation: "A stored overlap.", codes: ["BT01"] }],
    };
    const items = scoreAudit({
      rows: [
        { code: "BT01", admission: "GENERATE_VALID" },
        { code: "BT02", admission: "GENERATE_VALID" },
      ],
      siblingSet: siblingSet({ reasonContributions: [] }),
      siblingSetCurrent: true,
    });
    expect(items.every((item) => item.verdict !== "AUDIT_PASS")).toBe(true);
    expect(siblingReasonProofReady(siblingSet({ reasonContributions: [] }), ["BT01", "BT02"])).toBe(false);
    expect(
      evaluateLock({
        auditPassCount: 0,
        activeCount: 3,
        anyFail: false,
        anyStale: false,
        anyUnresolved: true,
        siblingCurrent: false,
      }).ok,
    ).toBe(false);
    expect(record.semanticExclusions?.entries[0]?.explanation).toBe("A stored overlap.");
  });

  it("drops exclusion history when the confirmed parent fingerprint changes", () => {
    const { record } = auditedSet();
    record.semanticExclusions = {
      parentFingerprint: "previous-parent",
      entries: [{ reasonContribution: "Old parent job", explanation: "", codes: ["BT01"] }],
    };
    expect(exclusionsForParent(record.semanticExclusions, "next-parent")).toEqual([]);
    const next = nextAuthoritativeSetRecord({
      record,
      parentFingerprint: "next-parent",
      siblingSet: siblingSet({ fingerprint: "next-parent\n\nfresh" }),
      audit: null,
    });
    expect(next.semanticExclusions?.entries).toEqual([]);
  });
});

describe("Big Thought fix lessons", () => {
  it("keeps a failed attempt on the set record and drops it when that card passes", () => {
    const stored = parseLabSetRecord({
      schema: "thinking-lab/v1",
      siblingSet: null,
      audit: null,
      fixLessons: [
        { code: "BT07", statement: "The failed clause", reason: "explains: It names a result." },
        { code: "bt07", statement: "The failed clause", reason: "explains: It names a result." },
        { code: "BT01", statement: "Another clause", reason: "role: It names a feature." },
      ],
    });
    expect(stored?.fixLessons).toEqual([
      { code: "BT07", statement: "The failed clause", reason: "explains: It names a result." },
      { code: "BT01", statement: "Another clause", reason: "role: It names a feature." },
    ]);
    const merged = mergeFixLessons(stored?.fixLessons, [
      { code: "BT07", statement: "A second failed clause", reason: "explains: The result is still missing." },
    ]);
    expect(merged.map((lesson) => lesson.statement)).toEqual([
      "The failed clause",
      "Another clause",
      "A second failed clause",
    ]);
    const kept = clearSetConclusions({ ...(stored ?? emptySetRecord()), fixLessons: merged });
    expect(kept.audit).toBeNull();
    expect(kept.fixLessons).toEqual(merged);
    const passed = dropFixLessons(merged, ["BT07"]);
    expect(passed).toEqual([{ code: "BT01", statement: "Another clause", reason: "role: It names a feature." }]);
  });
});

describe("Big Thought generate lessons", () => {
  const failed = "The sentence that only restates the Master Thought.";

  it("keeps a rejected sentence and replaces the reason for the same gate", () => {
    const stored = parseLabSetRecord({
      schema: "thinking-lab/v1",
      siblingSet: null,
      audit: null,
      fixLessons: [{ code: "BT04", statement: "A card already saved", reason: "explains: It names a result." }],
      generateLessons: [
        { gate: "relation", statement: failed, reason: "It restates the Master Thought." },
        { gate: "relation", statement: `  ${failed}  `, reason: "It elaborates the same claim." },
        { gate: "resolved", statement: failed, reason: "The judgment is still open." },
        { gate: "unknown", statement: failed, reason: "Not a gate." },
        { gate: "relation", statement: "", reason: "Missing the sentence." },
      ],
    });
    expect(stored?.generateLessons).toEqual([
      { gate: "relation", statement: failed, reason: "It elaborates the same claim." },
      { gate: "resolved", statement: failed, reason: "The judgment is still open." },
    ]);
    expect(stored?.fixLessons).toEqual([
      { code: "BT04", statement: "A card already saved", reason: "explains: It names a result." },
    ]);
    const merged = mergeGenerateLessons(stored?.generateLessons, [
      { gate: "duplicate", statement: failed, reason: "Same Big Thought as BT01." },
    ]);
    expect(merged.map((lesson) => lesson.gate)).toEqual(["relation", "resolved", "duplicate"]);
  });

  it("keeps rejected sentences when a later card passes or the set is saved again", () => {
    const record = {
      ...emptySetRecord(),
      fixLessons: [{ code: "BT04", statement: "A card already saved", reason: "explains: It names a result." }],
      generateLessons: [{ gate: "relation" as const, statement: failed, reason: "It restates the Master Thought." }],
    };
    const cleared = clearSetConclusions(record);
    expect(cleared.audit).toBeNull();
    expect(cleared.generateLessons).toEqual(record.generateLessons);
    expect(cleared.fixLessons).toEqual(record.fixLessons);
    const next = nextAuthoritativeSetRecord({
      record,
      parentFingerprint: "parent",
      siblingSet: null,
      audit: null,
    });
    expect(next.generateLessons).toEqual(record.generateLessons);
    expect(next.fixLessons).toEqual(record.fixLessons);
  });
});

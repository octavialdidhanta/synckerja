import { describe, expect, it } from "vitest";
import { challengerCanRun } from "@/thinking-lab/big-thought/challenger";
import { evaluateLock } from "@/thinking-lab/big-thought/lock";
import {
  displayedAuditVerdict,
  holdPassingAuditVerdicts,
  keptPassingAuditItems,
  exclusionsForParent,
  nextAuthoritativeSetRecord,
  heldAuditAfterFix,
  persistedSetRecordAfterFix,
  scoreAudit,
  siblingReasonProofReady,
} from "@/thinking-lab/big-thought/audit";
import type { BigThoughtFacts, ChallengerFacts, LabSetRecord, SiblingSetFacts } from "@/thinking-lab/big-thought/types";
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
        { code: "BT01", verdict: "AUDIT_PASS", statementFingerprint: "fp-01" },
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
    const scored = holdPassingAuditVerdicts(
      [
        { code: "BT01", verdict: "AUDIT_FAIL" },
        { code: "BT02", verdict: "AUDIT_FAIL" },
        { code: "BT06", verdict: "AUDIT_PASS" },
      ],
      kept.map((item) => item.code),
    );
    expect(scored.map((item) => item.verdict)).toEqual(["AUDIT_PASS", "AUDIT_PASS", "AUDIT_PASS"]);
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
});

function rowFacts(code: string, statement: string): BigThoughtFacts {
  return {
    code,
    whatItSays: statement,
    relationToParent: "DISTINCT_MATERIAL_SUPPORT",
    supportRole: "REASON",
    explainsWhyParentIsTrue: true,
    introducesUnsupportedPremise: false,
    duplicateOfCode: null,
    resolution: "RESOLVED",
    unresolvedReasons: [],
  };
}

function auditedSet(): {
  record: LabSetRecord;
  facts: BigThoughtFacts[];
  setFingerprint: string;
} {
  const parent = "parent";
  const statements = [
    { code: "BT01", statement: "First why" },
    { code: "BT02", statement: "Second why" },
    { code: "BT03", statement: "Third why" },
  ];
  const facts = statements.map((row) => rowFacts(row.code, row.statement));
  const setFingerprint = incumbentSetFingerprint({
    masterThoughtFingerprint: parent,
    bigThoughtFingerprints: statements.map((row) =>
      bigThoughtFingerprint({ statement: row.statement, masterThoughtFingerprint: parent }),
    ),
  });
  const challenger: ChallengerFacts = {
    setFingerprint,
    status: "COMPLETE",
    missingWhyDescription: "",
    missingWhyBoundary: "",
    resolution: "RESOLVED",
    unresolvedReasons: [],
  };
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
    challenger,
    semanticExclusions: null,
  };
  return { record, facts, setFingerprint };
}

describe("fix audit persistence", () => {
  it("keeps the audit record when no replacement is inserted", () => {
    const { record, facts, setFingerprint } = auditedSet();
    const before = structuredClone(record);
    const factsBefore = structuredClone(facts);
    const decision = persistedSetRecordAfterFix(record, 0);
    const fingerprintAfter = incumbentSetFingerprint({
      masterThoughtFingerprint: "parent",
      bigThoughtFingerprints: facts.map((row) =>
        bigThoughtFingerprint({ statement: row.whatItSays, masterThoughtFingerprint: "parent" }),
      ),
    });

    expect(decision).toEqual({ write: false });
    expect(record).toEqual(before);
    expect(facts).toEqual(factsBefore);
    expect(fingerprintAfter).toBe(setFingerprint);
    expect(record.challenger).toEqual(before.challenger);
    for (const item of record.audit?.items ?? []) {
      expect(
        displayedAuditVerdict(record.audit?.items, record.audit?.setFingerprint, setFingerprint, item.code),
      ).toBe(item.verdict);
    }
  });

  it("clears set conclusions after a real replacement", () => {
    const { record } = auditedSet();
    const decision = persistedSetRecordAfterFix(record, 1);
    expect(decision.write).toBe(true);
    if (!decision.write) return;
    expect(decision.lastAudit.audit).toBeNull();
    expect(decision.lastAudit.challenger).toBeNull();
    expect(decision.lastAudit.siblingSet).toEqual(record.siblingSet);
  });

  it("keeps an unchanged AUDIT_PASS after a replacement", () => {
    const { record } = auditedSet();
    const held = heldAuditAfterFix({
      items: record.audit?.items,
      rows: [
        { code: "BT02", statementFingerprint: "fp-02" },
        { code: "BT03", statementFingerprint: "fp-03" },
      ],
      replacedCodes: ["BT01"],
    });
    const decision = persistedSetRecordAfterFix(record, 1, null, held);
    expect(decision.write).toBe(true);
    if (!decision.write) return;
    expect(decision.lastAudit.audit?.items).toEqual([
      { code: "BT02", verdict: "AUDIT_PASS", statementFingerprint: "fp-02" },
      { code: "BT03", verdict: "AUDIT_FAIL", statementFingerprint: "fp-03" },
    ]);
    expect(
      displayedAuditVerdict(
        decision.lastAudit.audit?.items,
        decision.lastAudit.audit?.setFingerprint,
        "a-different-set",
        "BT02",
        undefined,
        "fp-02",
      ),
    ).toBe("AUDIT_PASS");
  });

  it("keeps audit state when exhaustion only adds search context", () => {
    const { record } = auditedSet();
    const history = {
      parentFingerprint: "parent",
      entries: [
        {
          reasonContribution: "A candidate job",
          explanation: "Overlaps the incumbent job.",
          codes: ["BT01", "NEW"],
        },
      ],
    };
    const decision = persistedSetRecordAfterFix(record, 0, history);
    expect(decision.write).toBe(true);
    if (!decision.write) return;
    expect(decision.lastAudit.audit).toEqual(record.audit);
    expect(decision.lastAudit.challenger).toEqual(record.challenger);
    expect(decision.lastAudit.siblingSet).toEqual(record.siblingSet);
    expect(decision.lastAudit.semanticExclusions).toEqual(history);
  });

  it("keeps semantic exclusion history when a replacement clears authoritative conclusions", () => {
    const { record } = auditedSet();
    const history = {
      parentFingerprint: "parent",
      entries: [{ reasonContribution: "Kept job", explanation: "Same reasoning job.", codes: ["BT01", "BT03"] }],
    };
    const decision = persistedSetRecordAfterFix(record, 1, history);
    expect(decision.write).toBe(true);
    if (!decision.write) return;
    expect(decision.lastAudit.audit).toBeNull();
    expect(decision.lastAudit.challenger).toBeNull();
    expect(decision.lastAudit.semanticExclusions).toEqual(history);
  });

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
      challenger: null,
    });
    expect(next.siblingSet).toEqual(fresh);
    expect(next.semanticExclusions?.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reasonContribution: "BT01 reasoning job" }),
        expect.objectContaining({ explanation: "Same reasoning job." }),
      ]),
    );
  });

  it("does not let exclusion history satisfy audit, challenger, or lock", () => {
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
      challengerCanRun({
        auditPassCount: 0,
        activeCount: 3,
        anyFail: false,
        anyStale: false,
        anyUnresolved: true,
      }),
    ).toBe(false);
    expect(
      evaluateLock({
        auditPassCount: 0,
        activeCount: 3,
        anyFail: false,
        anyStale: false,
        anyUnresolved: true,
        siblingCurrent: false,
        challenger: null,
        challengerCurrent: false,
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
      challenger: null,
    });
    expect(next.semanticExclusions?.entries).toEqual([]);
  });
});

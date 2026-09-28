import { describe, expect, it } from "vitest";
import { evaluateLock, selectStageAction } from "@/thinking-lab/big-thought/lock";
import type { ChallengerFacts } from "@/thinking-lab/big-thought/types";

function challenger(): ChallengerFacts {
  return {
    setFingerprint: "set",
    status: "COMPLETE",
    missingWhyDescription: "",
    missingWhyBoundary: "",
    resolution: "RESOLVED",
    unresolvedReasons: [],
  };
}

function ready() {
  return {
    auditPassCount: 3,
    activeCount: 3,
    anyFail: false,
    anyStale: false,
    anyUnresolved: false,
    siblingCurrent: true,
    challenger: challenger(),
    challengerCurrent: true,
  };
}

describe("lock decision", () => {
  it("refuses when fewer than 3 rows are AUDIT_PASS", () => {
    expect(evaluateLock({ ...ready(), auditPassCount: 2 }).ok).toBe(false);
  });

  it("refuses stale, unresolved, sibling, failure, and challenger gates", () => {
    expect(evaluateLock({ ...ready(), anyStale: true })).toMatchObject({ reason: "STALE" });
    expect(evaluateLock({ ...ready(), anyUnresolved: true })).toMatchObject({ reason: "UNRESOLVED" });
    expect(evaluateLock({ ...ready(), siblingCurrent: false })).toMatchObject({ reason: "SIBLING" });
    expect(evaluateLock({ ...ready(), anyFail: true })).toMatchObject({ reason: "AUDIT_FAIL" });
    expect(evaluateLock({ ...ready(), challenger: null })).toMatchObject({ reason: "CHALLENGER" });
  });

  it("allows lock when every gate is current", () => {
    expect(evaluateLock(ready())).toEqual({ ok: true });
  });

  it("does not lock when audit proof is incomplete", () => {
    const decision = evaluateLock({ ...ready(), auditPassCount: 2, anyUnresolved: true });
    expect(decision).toEqual({ ok: false, reason: "NEED_AUDIT_PASS" });
    expect(decision).not.toBeInstanceOf(Promise);
  });
});

describe("stage action priority", () => {
  const base = {
    anyFail: false,
    generateValidCount: 3,
    activeCount: 3,
    missingWhy: false,
    auditPassCount: 3,
    anyStale: false,
    anyUnresolved: false,
    challengerComplete: false,
    lockOk: false,
  };

  it("shows only the current priority", () => {
    expect(selectStageAction({ ...base, anyFail: true, generateValidCount: 1, auditPassCount: 0 })).toBe("fix");
    expect(selectStageAction({ ...base, generateValidCount: 2, activeCount: 2, auditPassCount: 0 })).toBe("audit");
    expect(selectStageAction({ ...base, generateValidCount: 2, activeCount: 2, auditPassCount: 2 })).toBe("generate");
    expect(selectStageAction({ ...base, generateValidCount: 0, activeCount: 0, auditPassCount: 0 })).toBe("generate");
    expect(selectStageAction({ ...base, missingWhy: true, activeCount: 3 })).toBe("generate");
    expect(selectStageAction({ ...base, missingWhy: true, activeCount: 6, auditPassCount: 6 })).toBe("challenger");
    expect(selectStageAction({ ...base, auditPassCount: 2 })).toBe("audit");
    expect(selectStageAction(base)).toBe("challenger");
    expect(selectStageAction({ ...base, challengerComplete: true, lockOk: true })).toBe("lock");
  });
});

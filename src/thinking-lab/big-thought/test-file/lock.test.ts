import { describe, expect, it } from "vitest";
import { evaluateLock, selectStageAction } from "@/thinking-lab/big-thought/lock";

const PASS = "AUDIT_PASS" as const;
const FAIL = "AUDIT_FAIL" as const;

describe("lock decision", () => {
  it("locks when every listed Big Thought passed", () => {
    expect(evaluateLock({ verdicts: [PASS] }).ok).toBe(true);
    expect(evaluateLock({ verdicts: [PASS, PASS, PASS] }).ok).toBe(true);
    expect(evaluateLock({ verdicts: [] })).toEqual({ ok: false, reason: "NEED_AUDIT_PASS" });
    expect(evaluateLock({ verdicts: [PASS, null] })).toEqual({ ok: false, reason: "NEED_AUDIT_PASS" });
    expect(evaluateLock({ verdicts: [PASS, FAIL] })).toEqual({ ok: false, reason: "AUDIT_FAIL" });
  });
});

describe("stage action", () => {
  it("audits cards never checked, locks when all passed, otherwise generates up to the target", () => {
    expect(selectStageAction({ verdicts: [] })).toBe("generate");
    expect(selectStageAction({ verdicts: [PASS, null] })).toBe("audit");
    expect(selectStageAction({ verdicts: [PASS, PASS] })).toBe("lock");
    expect(selectStageAction({ verdicts: [PASS, FAIL] })).toBe("generate");
    // A failed card is revised on the card; with the target reached the set has no action.
    expect(selectStageAction({ verdicts: [PASS, PASS, PASS, FAIL] })).toBeNull();
  });
});

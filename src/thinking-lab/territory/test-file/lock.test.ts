import { describe, expect, it } from "vitest";
import { evaluateTerritoryLock, selectTerritoryStage } from "@/thinking-lab/territory/lock";

const PASS = "AUDIT_PASS" as const;

describe("territory lock", () => {
  it("locks after three passing cards", () => {
    expect(evaluateTerritoryLock({ verdicts: [PASS, PASS, PASS] }).ok).toBe(true);
    expect(evaluateTerritoryLock({ verdicts: [PASS, PASS] }).ok).toBe(false);
    expect(evaluateTerritoryLock({ verdicts: [PASS, "AUDIT_FAIL", PASS] })).toEqual({ ok: false, reason: "AUDIT_FAIL" });
    expect(evaluateTerritoryLock({ verdicts: [PASS, null, PASS] })).toEqual({ ok: false, reason: "NEED_AUDIT_PASS" });
  });

  it("audits cards never checked, generates up to the target, then locks", () => {
    expect(selectTerritoryStage({ verdicts: [PASS, PASS, PASS], canAdd: true })).toBe("lock");
    expect(selectTerritoryStage({ verdicts: [PASS, PASS, null], canAdd: true })).toBe("audit");
    expect(selectTerritoryStage({ verdicts: [PASS, PASS], canAdd: true })).toBe("generate");
    expect(selectTerritoryStage({ verdicts: [PASS, PASS], canAdd: false })).toBeNull();
    // A failed card is revised on the card; the set has no action.
    expect(selectTerritoryStage({ verdicts: ["AUDIT_FAIL", PASS, PASS], canAdd: true })).toBeNull();
    expect(selectTerritoryStage({ verdicts: [], canAdd: true })).toBeNull();
  });
});

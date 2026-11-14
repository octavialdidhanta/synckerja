import { describe, expect, it } from "vitest";
import { evaluateTerritoryLock, selectTerritoryStage } from "@/thinking-lab/territory/lock";

const stage = (input: Partial<Parameters<typeof selectTerritoryStage>[0]>) =>
  selectTerritoryStage({
    admittedCount: 3,
    verdicts: ["AUDIT_PASS", "AUDIT_PASS", "AUDIT_PASS"],
    canAdd: true,
    repairsUsed: false,
    lockOk: false,
    ...input,
  });

describe("territory lock", () => {
  it("locks after three passing audits", () => {
    expect(evaluateTerritoryLock({ verdicts: ["AUDIT_PASS", "AUDIT_PASS", "AUDIT_PASS"] }).ok).toBe(true);
    expect(evaluateTerritoryLock({ verdicts: ["AUDIT_PASS", "AUDIT_PASS"] }).ok).toBe(false);
    expect(evaluateTerritoryLock({ verdicts: ["AUDIT_PASS", "AUDIT_FAIL", "AUDIT_PASS"] })).toEqual({
      ok: false,
      reason: "AUDIT_FAIL",
    });
  });

  it("audits, fixes once, generates up to the target, then locks", () => {
    expect(stage({ lockOk: true })).toBe("lock");
    expect(stage({ verdicts: ["AUDIT_PASS", "AUDIT_PASS", null] })).toBe("audit");
    expect(stage({ admittedCount: 2, verdicts: ["AUDIT_PASS", "AUDIT_PASS"] })).toBe("generate");
    expect(stage({ admittedCount: 2, verdicts: ["AUDIT_PASS", "AUDIT_PASS"], canAdd: false })).toBeNull();
    expect(stage({ verdicts: ["AUDIT_FAIL", "AUDIT_PASS", "AUDIT_PASS"] })).toBe("fix");
    expect(stage({ verdicts: ["AUDIT_FAIL", "AUDIT_PASS", "AUDIT_PASS"], repairsUsed: true })).toBeNull();
    expect(stage({ admittedCount: 0, verdicts: [] })).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { coverageFromChallenger, normalizeTerritoryChallenger } from "@/thinking-lab/territory/challenger";
import { evaluateTerritoryLock, selectTerritoryStage } from "@/thinking-lab/territory/lock";

describe("territory challenger and lock", () => {
  it("requires a description for a material gap", () => {
    expect(normalizeTerritoryChallenger({ status: "MATERIAL_GAP", unresolvedReasons: [] }).status).toBe("UNRESOLVED");
    const gap = normalizeTerritoryChallenger({
      status: "MATERIAL_GAP",
      materialGapDescription: "A missing space",
      unresolvedReasons: [],
    });
    expect(coverageFromChallenger(gap)).toBe("MATERIAL_GAP");
  });

  it("locks only after three passing audits and a complete challenger", () => {
    const denied = evaluateTerritoryLock({
      verdicts: ["AUDIT_PASS", "AUDIT_PASS", "AUDIT_PASS"],
      challenger: null,
      challengerCurrent: false,
    });
    expect(denied.ok).toBe(false);
    const allowed = evaluateTerritoryLock({
      verdicts: ["AUDIT_PASS", "AUDIT_PASS", "AUDIT_PASS"],
      challenger: { status: "COMPLETE", unresolvedReasons: [] },
      challengerCurrent: true,
    });
    expect(allowed.ok).toBe(true);
    expect(
      selectTerritoryStage({
        admittedCount: 3,
        verdicts: ["AUDIT_PASS", "AUDIT_PASS", "AUDIT_PASS"],
        challengerComplete: true,
        materialGap: false,
        canAdd: true,
        repairsUsed: false,
        lockOk: true,
      }),
    ).toBe("lock");
    expect(
      selectTerritoryStage({
        admittedCount: 2,
        verdicts: ["AUDIT_PASS", "AUDIT_PASS"],
        challengerComplete: false,
        materialGap: false,
        canAdd: true,
        repairsUsed: false,
        lockOk: false,
      }),
    ).toBe("generate");
    expect(
      selectTerritoryStage({
        admittedCount: 2,
        verdicts: ["AUDIT_PASS", "AUDIT_PASS"],
        challengerComplete: false,
        materialGap: false,
        canAdd: false,
        repairsUsed: false,
        lockOk: false,
      }),
    ).toBeNull();
    expect(
      selectTerritoryStage({
        admittedCount: 3,
        verdicts: ["AUDIT_FAIL", "AUDIT_PASS", "AUDIT_PASS"],
        challengerComplete: false,
        materialGap: false,
        canAdd: true,
        repairsUsed: false,
        lockOk: false,
      }),
    ).toBe("fix");
    expect(
      selectTerritoryStage({
        admittedCount: 3,
        verdicts: ["AUDIT_PASS", "AUDIT_PASS", "AUDIT_PASS"],
        challengerComplete: false,
        materialGap: true,
        canAdd: true,
        repairsUsed: false,
        lockOk: false,
      }),
    ).toBeNull();
    expect(
      selectTerritoryStage({
        admittedCount: 3,
        verdicts: ["AUDIT_FAIL", "AUDIT_PASS", "AUDIT_PASS"],
        challengerComplete: false,
        materialGap: false,
        canAdd: true,
        repairsUsed: true,
        lockOk: false,
      }),
    ).toBeNull();
  });
});

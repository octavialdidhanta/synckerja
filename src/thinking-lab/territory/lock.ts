import { TARGET_GENERATE_VALID } from "@/thinking-lab/shared/limits";
import type { TerritoryChallengerResult } from "@/thinking-lab/territory/types";
import type { AuditVerdict } from "@/thinking-lab/shared/verdict";

export type TerritoryStageAction = "fix" | "generate" | "audit" | "challenger" | "lock";

export type TerritoryLockDecision =
  | { ok: true }
  | { ok: false; reason: "NEED_AUDIT_PASS" | "AUDIT_FAIL" | "STALE" | "UNRESOLVED" | "CHALLENGER" };

export function evaluateTerritoryLock(input: {
  verdicts: Array<AuditVerdict | null>;
  challenger: TerritoryChallengerResult | null;
  challengerCurrent: boolean;
}): TerritoryLockDecision {
  if (input.verdicts.length < TARGET_GENERATE_VALID) return { ok: false, reason: "NEED_AUDIT_PASS" };
  if (input.verdicts.some((verdict) => verdict == null)) return { ok: false, reason: "NEED_AUDIT_PASS" };
  if (input.verdicts.some((verdict) => verdict === "AUDIT_FAIL")) return { ok: false, reason: "AUDIT_FAIL" };
  if (input.verdicts.some((verdict) => verdict === "STALE")) return { ok: false, reason: "STALE" };
  if (input.verdicts.some((verdict) => verdict === "UNRESOLVED")) return { ok: false, reason: "UNRESOLVED" };
  if (!input.verdicts.every((verdict) => verdict === "AUDIT_PASS")) return { ok: false, reason: "NEED_AUDIT_PASS" };
  if (
    !input.challengerCurrent ||
    !input.challenger ||
    input.challenger.status !== "COMPLETE" ||
    input.challenger.unresolvedReasons.length > 0
  ) {
    return { ok: false, reason: "CHALLENGER" };
  }
  return { ok: true };
}

export function selectTerritoryStage(input: {
  admittedCount: number;
  verdicts: Array<AuditVerdict | null>;
  challengerComplete: boolean;
  materialGap: boolean;
  canAdd: boolean;
  repairsUsed: boolean;
  lockOk: boolean;
}): TerritoryStageAction | null {
  if (input.admittedCount === 0) return null;
  const awaitingAudit =
    input.verdicts.length !== input.admittedCount ||
    input.verdicts.some((verdict) => verdict == null || verdict === "STALE" || verdict === "UNRESOLVED");
  if (awaitingAudit) return "audit";
  if (input.verdicts.some((verdict) => verdict === "AUDIT_FAIL")) return input.repairsUsed ? null : "fix";
  if (input.admittedCount < TARGET_GENERATE_VALID) return input.canAdd ? "generate" : null;
  if (input.materialGap && input.canAdd) return null;
  if (!input.challengerComplete) return "challenger";
  if (input.lockOk) return "lock";
  return null;
}

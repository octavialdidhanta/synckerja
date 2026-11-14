import { TARGET_GENERATE_VALID } from "../shared/limits";
import type { AuditVerdict } from "../shared/verdict";

export type TerritoryStageAction = "fix" | "generate" | "audit" | "lock";

export type TerritoryLockDecision =
  | { ok: true }
  | { ok: false; reason: "NEED_AUDIT_PASS" | "AUDIT_FAIL" | "STALE" | "UNRESOLVED" };

export function evaluateTerritoryLock(input: { verdicts: Array<AuditVerdict | null> }): TerritoryLockDecision {
  if (input.verdicts.length < TARGET_GENERATE_VALID) return { ok: false, reason: "NEED_AUDIT_PASS" };
  if (input.verdicts.some((verdict) => verdict == null)) return { ok: false, reason: "NEED_AUDIT_PASS" };
  if (input.verdicts.some((verdict) => verdict === "AUDIT_FAIL")) return { ok: false, reason: "AUDIT_FAIL" };
  if (input.verdicts.some((verdict) => verdict === "STALE")) return { ok: false, reason: "STALE" };
  if (input.verdicts.some((verdict) => verdict === "UNRESOLVED")) return { ok: false, reason: "UNRESOLVED" };
  if (!input.verdicts.every((verdict) => verdict === "AUDIT_PASS")) return { ok: false, reason: "NEED_AUDIT_PASS" };
  return { ok: true };
}

/** Audit until every Territory has a verdict, Fix once after a fail, Generate up to the target, then Lock. */
export function selectTerritoryStage(input: {
  admittedCount: number;
  verdicts: Array<AuditVerdict | null>;
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
  if (input.lockOk) return "lock";
  return null;
}

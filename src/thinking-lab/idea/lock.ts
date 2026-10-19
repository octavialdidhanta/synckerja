import type { AuditVerdict } from "@/thinking-lab/shared/verdict";

export type IdeaStageAction = "fix" | "audit" | "lock";

export type IdeaLockDecision =
  | { ok: true }
  | { ok: false; reason: "NEED_AUDIT_PASS" | "AUDIT_FAIL" | "STALE" | "UNRESOLVED" };

export function evaluateIdeaLock(input: {
  admittedCount: number;
  verdicts: Array<AuditVerdict | null>;
}): IdeaLockDecision {
  if (input.admittedCount < 1) return { ok: false, reason: "NEED_AUDIT_PASS" };
  if (input.verdicts.length < input.admittedCount) return { ok: false, reason: "NEED_AUDIT_PASS" };
  if (input.verdicts.some((verdict) => verdict == null)) return { ok: false, reason: "NEED_AUDIT_PASS" };
  if (input.verdicts.some((verdict) => verdict === "AUDIT_FAIL")) return { ok: false, reason: "AUDIT_FAIL" };
  if (input.verdicts.some((verdict) => verdict === "STALE")) return { ok: false, reason: "STALE" };
  if (input.verdicts.some((verdict) => verdict === "UNRESOLVED")) return { ok: false, reason: "UNRESOLVED" };
  if (!input.verdicts.every((verdict) => verdict === "AUDIT_PASS")) return { ok: false, reason: "NEED_AUDIT_PASS" };
  return { ok: true };
}

export function selectIdeaStage(input: {
  admittedCount: number;
  verdicts: Array<AuditVerdict | null>;
  repairsUsed: boolean;
  lockOk: boolean;
}): IdeaStageAction | null {
  if (input.admittedCount === 0) return null;
  const awaitingAudit =
    input.verdicts.length !== input.admittedCount ||
    input.verdicts.some((verdict) => verdict == null || verdict === "STALE" || verdict === "UNRESOLVED");
  if (awaitingAudit) return "audit";
  if (input.verdicts.some((verdict) => verdict === "AUDIT_FAIL")) return input.repairsUsed ? null : "fix";
  if (input.lockOk) return "lock";
  return null;
}

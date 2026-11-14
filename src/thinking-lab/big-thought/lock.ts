import { TARGET_GENERATE_VALID } from "@/thinking-lab/shared/limits";

export type StageAction = "generate" | "audit" | "lock";

export type LockDecision =
  | { ok: true }
  | {
      ok: false;
      reason: "NEED_AUDIT_PASS" | "AUDIT_FAIL" | "STALE" | "UNRESOLVED" | "SIBLING";
    };

export function evaluateLock(input: {
  auditPassCount: number;
  activeCount: number;
  anyFail: boolean;
  anyStale: boolean;
  anyUnresolved: boolean;
  siblingCurrent: boolean;
}): LockDecision {
  if (input.auditPassCount < 1 || input.auditPassCount !== input.activeCount) {
    return { ok: false, reason: "NEED_AUDIT_PASS" };
  }
  if (input.anyFail) return { ok: false, reason: "AUDIT_FAIL" };
  if (input.anyStale) return { ok: false, reason: "STALE" };
  if (input.anyUnresolved) return { ok: false, reason: "UNRESOLVED" };
  if (!input.siblingCurrent) return { ok: false, reason: "SIBLING" };
  return { ok: true };
}

export function selectStageAction(input: {
  anyFail: boolean;
  awaitingVerdict?: boolean;
  generateValidCount: number;
  activeCount: number;
  auditPassCount: number;
  anyStale: boolean;
  anyUnresolved: boolean;
  siblingCurrent: boolean;
  lockOk: boolean;
}): StageAction | null {
  if (input.awaitingVerdict || input.anyStale || input.anyUnresolved) return "audit";
  const awaitingAudit =
    input.activeCount > 0 && input.auditPassCount !== input.activeCount && !input.anyFail;
  if (awaitingAudit) return "audit";
  if (input.auditPassCount >= 1 && input.auditPassCount === input.activeCount && !input.siblingCurrent) return "audit";
  if (input.lockOk) return "lock";
  if (input.generateValidCount < TARGET_GENERATE_VALID) return "generate";
  return null;
}

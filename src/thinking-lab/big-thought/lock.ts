import { TARGET_GENERATE_VALID } from "@/thinking-lab/shared/limits";
import type { ChallengerFacts } from "@/thinking-lab/big-thought/types";

export type StageAction = "generate" | "audit" | "challenger" | "lock";

export type LockDecision =
  | { ok: true }
  | {
      ok: false;
      reason: "NEED_AUDIT_PASS" | "AUDIT_FAIL" | "STALE" | "UNRESOLVED" | "SIBLING" | "CHALLENGER";
    };

export function evaluateLock(input: {
  auditPassCount: number;
  activeCount: number;
  anyFail: boolean;
  anyStale: boolean;
  anyUnresolved: boolean;
  siblingCurrent: boolean;
  challenger: ChallengerFacts | null;
  challengerCurrent: boolean;
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
  missingWhy: boolean;
  auditPassCount: number;
  anyStale: boolean;
  anyUnresolved: boolean;
  siblingCurrent: boolean;
  challengerComplete: boolean;
  lockOk: boolean;
}): StageAction | null {
  if (input.awaitingVerdict || input.anyStale || input.anyUnresolved) return "audit";
  const awaitingAudit =
    input.activeCount > 0 && input.auditPassCount !== input.activeCount && !input.anyFail;
  if (awaitingAudit) return "audit";
  if (input.auditPassCount >= 1 && input.auditPassCount === input.activeCount && !input.siblingCurrent) return "audit";
  if (input.missingWhy) return "generate";
  if (input.lockOk) return "lock";
  if (input.generateValidCount < TARGET_GENERATE_VALID) return "generate";
  return null;
}

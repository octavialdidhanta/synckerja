import { ACTIVE_SET_CAP, TARGET_GENERATE_VALID } from "@/thinking-lab/shared/limits";
import type { ChallengerFacts } from "@/thinking-lab/big-thought/types";

export type StageAction = "fix" | "generate" | "audit" | "challenger" | "lock";

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
  if (input.auditPassCount < 3 || input.auditPassCount !== input.activeCount) {
    return { ok: false, reason: "NEED_AUDIT_PASS" };
  }
  if (input.anyFail) return { ok: false, reason: "AUDIT_FAIL" };
  if (input.anyStale) return { ok: false, reason: "STALE" };
  if (input.anyUnresolved) return { ok: false, reason: "UNRESOLVED" };
  if (!input.siblingCurrent) return { ok: false, reason: "SIBLING" };
  if (!input.challengerCurrent || !input.challenger || input.challenger.status !== "COMPLETE") {
    return { ok: false, reason: "CHALLENGER" };
  }
  if (input.challenger.resolution !== "RESOLVED" || input.challenger.unresolvedReasons.length > 0) {
    return { ok: false, reason: "CHALLENGER" };
  }
  return { ok: true };
}

export function selectStageAction(input: {
  anyFail: boolean;
  generateValidCount: number;
  activeCount: number;
  missingWhy: boolean;
  auditPassCount: number;
  anyStale: boolean;
  anyUnresolved: boolean;
  challengerComplete: boolean;
  lockOk: boolean;
}): StageAction | null {
  if (input.anyFail) return "fix";
  const awaitingAudit =
    input.activeCount > 0 &&
    (input.auditPassCount !== input.activeCount || input.anyStale || input.anyUnresolved);
  if (awaitingAudit) return "audit";
  const needsGenerate =
    input.generateValidCount < TARGET_GENERATE_VALID ||
    (input.missingWhy && input.activeCount < ACTIVE_SET_CAP);
  if (needsGenerate) return "generate";
  if (!input.challengerComplete) return "challenger";
  if (input.lockOk) return "lock";
  return null;
}

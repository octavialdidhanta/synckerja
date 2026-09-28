import { countAuditPass, scoreAudit } from "@/thinking-lab/big-thought/audit";
import { evaluateLock, type LockDecision } from "@/thinking-lab/big-thought/lock";
import type { ChallengerFacts, SiblingSetFacts } from "@/thinking-lab/big-thought/types";
import type { IndividualAdmission } from "@/thinking-lab/shared/verdict";

export function lockDecisionFromScoredSet(input: {
  rows: Array<{ code: string; admission: IndividualAdmission }>;
  siblingSet: SiblingSetFacts | null;
  siblingSetCurrent: boolean;
  challenger: ChallengerFacts | null;
  challengerCurrent: boolean;
}): LockDecision {
  const items = scoreAudit({
    rows: input.rows,
    siblingSet: input.siblingSet,
    siblingSetCurrent: input.siblingSetCurrent,
  });
  return evaluateLock({
    auditPassCount: countAuditPass(items),
    activeCount: input.rows.length,
    anyFail: items.some((item) => item.verdict === "AUDIT_FAIL"),
    anyStale: items.some((item) => item.verdict === "STALE"),
    anyUnresolved: items.some((item) => item.verdict === "UNRESOLVED"),
    siblingCurrent: input.siblingSetCurrent,
    challenger: input.challenger,
    challengerCurrent: input.challengerCurrent,
  });
}

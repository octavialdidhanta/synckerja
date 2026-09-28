import { TARGET_IDEA_VALID } from "@/thinking-lab/idea/generate";
import type { IdeaDownTopVerdict } from "@/thinking-lab/idea/downTop";
import type { AuditVerdict } from "@/thinking-lab/shared/verdict";

export type IdeaStageAction = "fix" | "audit" | "downtop" | "lock";

export type IdeaLockDecision =
  | { ok: true }
  | { ok: false; reason: "NEED_AUDIT_PASS" | "AUDIT_FAIL" | "STALE" | "UNRESOLVED" | "DOWN_TOP" | "NEED_COUNT" };

export function evaluateIdeaLock(input: {
  admittedCount: number;
  verdicts: Array<AuditVerdict | null>;
  downTop: Array<IdeaDownTopVerdict | null>;
  downTopCurrent: boolean;
}): IdeaLockDecision {
  if (input.admittedCount < TARGET_IDEA_VALID) return { ok: false, reason: "NEED_COUNT" };
  if (input.verdicts.length < input.admittedCount) return { ok: false, reason: "NEED_AUDIT_PASS" };
  if (input.verdicts.some((verdict) => verdict == null)) return { ok: false, reason: "NEED_AUDIT_PASS" };
  if (input.verdicts.some((verdict) => verdict === "AUDIT_FAIL")) return { ok: false, reason: "AUDIT_FAIL" };
  if (input.verdicts.some((verdict) => verdict === "STALE")) return { ok: false, reason: "STALE" };
  if (input.verdicts.some((verdict) => verdict === "UNRESOLVED")) return { ok: false, reason: "UNRESOLVED" };
  if (!input.verdicts.every((verdict) => verdict === "AUDIT_PASS")) return { ok: false, reason: "NEED_AUDIT_PASS" };
  if (!input.downTopCurrent || input.downTop.length !== input.admittedCount) return { ok: false, reason: "DOWN_TOP" };
  if (input.downTop.some((verdict) => verdict !== "PASS")) return { ok: false, reason: "DOWN_TOP" };
  return { ok: true };
}

export function selectIdeaStage(input: {
  admittedCount: number;
  verdicts: Array<AuditVerdict | null>;
  downTop: Array<IdeaDownTopVerdict | null>;
  downTopCurrent: boolean;
  repairsUsed: boolean;
  lockOk: boolean;
}): IdeaStageAction | null {
  if (input.admittedCount === 0) return null;
  const awaitingAudit =
    input.verdicts.length !== input.admittedCount ||
    input.verdicts.some((verdict) => verdict == null || verdict === "STALE" || verdict === "UNRESOLVED");
  if (awaitingAudit) return "audit";
  if (input.verdicts.some((verdict) => verdict === "AUDIT_FAIL")) return input.repairsUsed ? null : "fix";
  const downTopReady =
    input.downTopCurrent && input.downTop.length === input.admittedCount && input.downTop.every((verdict) => verdict != null);
  if (!downTopReady) return "downtop";
  if (input.downTop.some((verdict) => verdict === "FAIL" || verdict === "UNRESOLVED")) {
    return input.repairsUsed ? null : "fix";
  }
  if (input.lockOk) return "lock";
  return null;
}

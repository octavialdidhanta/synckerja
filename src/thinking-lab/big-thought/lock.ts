import { TARGET_GENERATE_VALID } from "../shared/limits";

export type StageAction = "generate" | "audit" | "lock";

export type BigThoughtVerdict = "AUDIT_PASS" | "AUDIT_FAIL" | null;

export type LockDecision = { ok: true } | { ok: false; reason: "NEED_AUDIT_PASS" | "AUDIT_FAIL" };

/** Lock needs at least one Big Thought, and every listed Big Thought's current sentence passed its checks. */
export function evaluateLock(input: { verdicts: readonly BigThoughtVerdict[] }): LockDecision {
  if (input.verdicts.length === 0) return { ok: false, reason: "NEED_AUDIT_PASS" };
  if (input.verdicts.some((verdict) => verdict === "AUDIT_FAIL")) return { ok: false, reason: "AUDIT_FAIL" };
  if (!input.verdicts.every((verdict) => verdict === "AUDIT_PASS")) return { ok: false, reason: "NEED_AUDIT_PASS" };
  return { ok: true };
}

/**
 * The one set action the menu offers: "audit" checks the cards that were never checked (rows saved before
 * checks ran at Generate), "lock" when every card passed, otherwise "generate" up to the target.
 * A failed card is revised on the card itself.
 */
export function selectStageAction(input: { verdicts: readonly BigThoughtVerdict[] }): StageAction | null {
  if (input.verdicts.some((verdict) => verdict == null)) return "audit";
  if (evaluateLock(input).ok) return "lock";
  const passed = input.verdicts.filter((verdict) => verdict === "AUDIT_PASS").length;
  return passed < TARGET_GENERATE_VALID ? "generate" : null;
}

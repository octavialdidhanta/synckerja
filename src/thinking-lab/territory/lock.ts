import { TARGET_GENERATE_VALID } from "../shared/limits";

export type TerritoryStageAction = "generate" | "audit" | "lock";

export type TerritoryVerdict = "AUDIT_PASS" | "AUDIT_FAIL" | null;

export type TerritoryLockDecision = { ok: true } | { ok: false; reason: "NEED_AUDIT_PASS" | "AUDIT_FAIL" };

/** Lock needs at least the target number of Territories, and every Territory's current name passed its checks. */
export function evaluateTerritoryLock(input: { verdicts: readonly TerritoryVerdict[] }): TerritoryLockDecision {
  if (input.verdicts.length < TARGET_GENERATE_VALID) return { ok: false, reason: "NEED_AUDIT_PASS" };
  if (input.verdicts.some((verdict) => verdict === "AUDIT_FAIL")) return { ok: false, reason: "AUDIT_FAIL" };
  if (!input.verdicts.every((verdict) => verdict === "AUDIT_PASS")) return { ok: false, reason: "NEED_AUDIT_PASS" };
  return { ok: true };
}

/**
 * The one set action the menu offers: "audit" checks the cards that were never checked (rows saved before
 * checks ran at Generate), "generate" tops the set up to the target, "lock" when every card passed.
 * A failed card is revised on the card itself.
 */
export function selectTerritoryStage(input: {
  verdicts: readonly TerritoryVerdict[];
  canAdd: boolean;
}): TerritoryStageAction | null {
  if (input.verdicts.length === 0) return null;
  if (input.verdicts.some((verdict) => verdict == null)) return "audit";
  if (input.verdicts.length < TARGET_GENERATE_VALID) return input.canAdd ? "generate" : null;
  return evaluateTerritoryLock(input).ok ? "lock" : null;
}

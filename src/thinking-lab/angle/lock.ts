export type AngleStageAction = "audit" | "lock";

export type AngleVerdict = "AUDIT_PASS" | "AUDIT_FAIL" | null;

export type AngleLockDecision = { ok: true } | { ok: false; reason: "NEED_AUDIT_PASS" | "AUDIT_FAIL" };

/** Lock needs at least one Angle, and every Angle's current sentence passed its checks. */
export function evaluateAngleLock(input: { verdicts: readonly AngleVerdict[] }): AngleLockDecision {
  if (input.verdicts.length === 0) return { ok: false, reason: "NEED_AUDIT_PASS" };
  if (input.verdicts.some((verdict) => verdict === "AUDIT_FAIL")) return { ok: false, reason: "AUDIT_FAIL" };
  if (!input.verdicts.every((verdict) => verdict === "AUDIT_PASS")) return { ok: false, reason: "NEED_AUDIT_PASS" };
  return { ok: true };
}

/**
 * The one set action the menu offers: "audit" checks the cards that were never checked (rows saved before
 * checks ran at Generate), "lock" when every card passed. A failed card is revised on the card itself.
 */
export function selectAngleStage(input: { verdicts: readonly AngleVerdict[] }): AngleStageAction | null {
  if (input.verdicts.length === 0) return null;
  if (input.verdicts.some((verdict) => verdict == null)) return "audit";
  return evaluateAngleLock(input).ok ? "lock" : null;
}

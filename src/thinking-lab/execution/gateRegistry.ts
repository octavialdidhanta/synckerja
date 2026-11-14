/**
 * Registry of execution pass-check ids (phase 2–4).
 * Meaning/open runners: meaningGateRunner.ts. Image open: imageGateRunner.ts.
 * Pass-switch rewrite (`buildPassSwitchRewritePrompt` / `applyPassSwitchScript` in passChecklist.ts)
 * and line-repair prompts both stay live. Line repair still injects `fixScope` via
 * `fixScopeLines` (`shared/fixScope.ts`); do not remove FixScope while that path exists.
 */
import type { ExecutionPassCheckId } from "./types";

export { EXECUTION_PASS_CHECK_IDS, EXECUTION_LINE_REPAIR_IDS, LINE_CHECK_IDS } from "./passChecklist";

/** Meaning-audit checks, in run order (same as EXECUTION_PASS_CHECK_IDS). */
export const EXECUTION_MEANING_GATE_ORDER: readonly ExecutionPassCheckId[] = [
  "hookHolds",
  "soundsSpoken",
  "usesSlang",
  "pillarFits",
  "formatHolds",
  "mechanismVisible",
  "messageStays",
  "causeChain",
  "viewerClimb",
  "emotionalTone",
];

/** Checks that primarily inspect narration line ids. */
export const EXECUTION_LINE_GATES = ["soundsSpoken", "usesSlang", "messageStays", "causeChain", "viewerClimb", "emotionalTone"] as const satisfies readonly ExecutionPassCheckId[];
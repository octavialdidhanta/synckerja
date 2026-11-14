/**
 * Execution meaning/open pass checks via runGateChain (phase 3).
 * Public behavior matches the previous for-loop: one ask per check, stop at first fail,
 * silent speech auto-pass, hook missing lines fail, enabled/lineIds preserved.
 */
import { runGateChain } from "../shared/gateChain";
import type { AncestorStake } from "../shared/ancestorStake";
import type { VoiceOverScript } from "./script";
import type { ExecutionAuditLesson, ExecutionPassCheckId, ExecutionSemanticFacts, ExecutionTriState } from "./types";
import {
  EXECUTION_PASS_CHECK_IDS,
  MISSING_OPENING,
  buildExecutionPassPrompt,
  checklistWithPrior,
  executionFactsFromChecks,
  failedCheck,
  knownIds,
  linesFor,
  parseExecutionPassCheck,
  type ExecutionPassCheck,
} from "./passChecklist";

export type ExecutionGateRunInput = {
  pillar: string;
  pillarCategory?: string | null;
  pillarDescription?: string | null;
  masterStatement: string;
  masterSubject?: string;
  ideaStatement: string;
  ancestors?: AncestorStake[];
  pillarDevelopment?: string | null;
  script: VoiceOverScript;
  masterSells: true | false | "unresolved" | "unknown";
  auditLessons?: ExecutionAuditLesson[];
  prior?: readonly ExecutionPassCheck[];
  ask: (prompt: string) => Promise<string | null>;
  resolveSelling?: () => Promise<true | false | "unresolved">;
  onStep: (checks: ExecutionPassCheck[]) => void;
};

async function runExecutionChecksWithGate(
  input: ExecutionGateRunInput & { prior: readonly ExecutionPassCheck[] | undefined },
  rerunPassed: boolean,
): Promise<{ checks: ExecutionPassCheck[]; passed: boolean; facts: ExecutionSemanticFacts }> {
  const checks = checklistWithPrior(input.prior, rerunPassed);
  const publish = () => input.onStep(checks.map((check) => ({ ...check })));
  const masterSells: ExecutionTriState = input.masterSells === "unknown" ? "unresolved" : input.masterSells;
  publish();

  const skip = EXECUTION_PASS_CHECK_IDS.filter((id) => {
    const row = checks.find((check) => check.id === id);
    return row?.enabled === false;
  });
  const keep = !rerunPassed
    ? EXECUTION_PASS_CHECK_IDS.filter((id) => {
        const row = checks.find((check) => check.id === id);
        return row?.enabled !== false && row?.state === "pass";
      })
    : [];

  await runGateChain({
    ids: EXECUTION_PASS_CHECK_IDS,
    skip,
    keep,
    batchable: () => false,
    batchPrompt: () => "",
    prompt: () => "",
    ask: async () => null,
    before: async (id) => {
      const index = checks.findIndex((check) => check.id === id);
      checks[index] = { id, state: "running", enabled: true };
      publish();
      if ((id === "soundsSpoken" || id === "usesSlang") && input.script.speech === "silent") {
        checks[index] = { id, state: "pass", enabled: true };
        publish();
        return { pass: true, reason: "" };
      }
      const lines = linesFor(id, input.script);
      if (id === "hookHolds" && lines.length === 0) {
        checks[index] = { id, state: "fail", enabled: true, reason: MISSING_OPENING, lineIds: [] };
        publish();
        return { pass: false, reason: MISSING_OPENING };
      }
      const parsed = parseExecutionPassCheck(
        await input.ask(
          buildExecutionPassPrompt({
            id,
            pillar: input.pillar,
            pillarCategory: input.pillarCategory,
            pillarDescription: input.pillarDescription,
            masterStatement: input.masterStatement,
            masterSubject: input.masterSubject,
            ideaStatement: input.ideaStatement,
            ancestors: input.ancestors,
            pillarDevelopment: input.pillarDevelopment,
            decisions: input.script.decisions,
            lines,
          }),
        ),
        knownIds(lines),
      );
      if (!parsed.pass) {
        checks[index] = { ...failedCheck(id, parsed, lines), enabled: true };
        publish();
        return { pass: false, reason: checks[index]?.reason ?? "" };
      }
      checks[index] = { id, state: "pass", enabled: true };
      publish();
      return { pass: true, reason: "" };
    },
  });

  const facts = executionFactsFromChecks({
    pillar: input.pillar,
    checks,
    masterSells,
    auditLessons: input.auditLessons,
  });
  return {
    checks: checks.map((check) => ({ ...check })),
    passed: facts.relationToParent === "VALID_EXECUTION",
    facts,
  };
}

export async function runExecutionMeaningChecks(
  input: ExecutionGateRunInput,
): Promise<{ checks: ExecutionPassCheck[]; passed: boolean; facts: ExecutionSemanticFacts }> {
  return runExecutionChecksWithGate({ ...input, prior: input.prior }, true);
}

export async function runExecutionOpenChecks(
  input: ExecutionGateRunInput & { prior: readonly ExecutionPassCheck[] },
): Promise<{ checks: ExecutionPassCheck[]; passed: boolean; facts: ExecutionSemanticFacts }> {
  return runExecutionChecksWithGate(input, false);
}

export type { ExecutionPassCheckId };
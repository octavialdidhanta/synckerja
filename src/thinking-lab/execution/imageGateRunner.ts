/**
 * Image open/meaning pass checks via runGateChain (phase 3 subset).
 * Preserves coded judges (shape/prompt/caption) and one-ask-per-check model path.
 */
import { runGateChain } from "../shared/gateChain";
import { UNDECIDED_REASON } from "../shared/batchGates";
import type { AncestorStake } from "../shared/ancestorStake";
import { parseExecutionPassCheck } from "./passChecklist";
import type { ImageSettings, VoiceOverScript } from "./script";
import type { ExecutionAuditLesson, ExecutionSemanticFacts, ExecutionTriState } from "./types";
import {
  IMAGE_PASS_CHECK_IDS,
  buildImagePassPrompt,
  emptyImagePassChecklist,
  imageFactsFromChecks,
  judgeImagePromptShape,
  judgeImageShape,
  slideLines,
  type ImagePassCheck,
} from "./imageChecklist";

const UNDECIDED = UNDECIDED_REASON;

export type ImageGateRunInput = {
  pillar: string;
  pillarCategory?: string | null;
  pillarDescription?: string | null;
  masterStatement: string;
  ideaStatement: string;
  ancestors?: AncestorStake[];
  pillarDevelopment?: string | null;
  script: VoiceOverScript;
  image: ImageSettings;
  masterSells: ExecutionTriState;
  auditLessons?: ExecutionAuditLesson[];
  prior?: readonly ImagePassCheck[];
  ask: (prompt: string) => Promise<string | null>;
  onStep: (checks: ImagePassCheck[]) => void;
};

export async function runImageOpenChecks(
  input: ImageGateRunInput,
): Promise<{ checks: ImagePassCheck[]; passed: boolean; facts: ExecutionSemanticFacts }> {
  const checks = emptyImagePassChecklist().map((check) => {
    const previous = input.prior?.find((item) => item.id === check.id);
    if (!previous) return { ...check };
    if (previous.enabled === false) return { id: check.id, state: "pass" as const, enabled: false };
    return previous.state === "pass"
      ? { id: check.id, state: "pass" as const, enabled: true }
      : { id: check.id, state: "pending" as const, enabled: true };
  });
  const publish = () => input.onStep(checks.map((check) => ({ ...check })));
  publish();

  const skip = IMAGE_PASS_CHECK_IDS.filter((id) => checks.find((check) => check.id === id)?.enabled === false);
  const keep = IMAGE_PASS_CHECK_IDS.filter((id) => {
    const row = checks.find((check) => check.id === id);
    return row?.enabled !== false && row?.state === "pass";
  });

  await runGateChain({
    ids: IMAGE_PASS_CHECK_IDS,
    skip,
    keep,
    batchable: () => false,
    batchPrompt: () => "",
    prompt: () => "",
    ask: async () => null,
    before: async (id) => {
      const index = checks.findIndex((check) => check.id === id);
      checks[index] = { id, state: "running" };
      publish();
      if (id === "imageShape") {
        const shape = judgeImageShape(input.script, input.image);
        checks[index] = shape.pass
          ? { id, state: "pass" }
          : { id, state: "fail", reason: "reason" in shape ? shape.reason : "", lineIds: [] };
        publish();
        return { pass: Boolean(shape.pass), reason: shape.pass ? "" : "reason" in shape ? shape.reason : "" };
      }
      if (id === "imagePrompt") {
        const shape = judgeImagePromptShape(input.script, input.image);
        if (!shape.pass || !input.image.withImage) {
          checks[index] = shape.pass
            ? { id, state: "pass" }
            : { id, state: "fail", reason: "reason" in shape ? shape.reason : "", lineIds: [] };
          publish();
          return { pass: Boolean(shape.pass), reason: shape.pass ? "" : "reason" in shape ? shape.reason : "" };
        }
      }
      if (id === "imageCaption" && (!input.script.caption.trim() || !input.script.caption.includes("#"))) {
        const reason = "The caption needs short points and hashtags.";
        checks[index] = { id, state: "fail", reason, lineIds: [] };
        publish();
        return { pass: false, reason };
      }
      const known = new Set([...slideLines(input.script).map((line) => line.id), "caption"]);
      const parsed = parseExecutionPassCheck(
        await input.ask(
          buildImagePassPrompt({
            id,
            pillar: input.pillar,
            pillarCategory: input.pillarCategory,
            pillarDescription: input.pillarDescription,
            masterStatement: input.masterStatement,
            ideaStatement: input.ideaStatement,
            ancestors: input.ancestors,
            pillarDevelopment: input.pillarDevelopment,
            script: input.script,
            image: input.image,
          }),
        ),
        known,
      );
      if (!parsed.pass) {
        const lineIds = parsed.lineIds;
        const unnamedPerson = id === "emotionalTone" && (parsed.reason === UNDECIDED || lineIds.length === 0);
        checks[index] = {
          id,
          state: "fail",
          reason: parsed.reason,
          lineIds: unnamedPerson ? [] : lineIds,
        };
        publish();
        return { pass: false, reason: parsed.reason };
      }
      checks[index] = { id, state: "pass" };
      publish();
      return { pass: true, reason: "" };
    },
  });

  const facts = imageFactsFromChecks({
    pillar: input.pillar,
    checks,
    masterSells: input.masterSells === "unresolved" ? "unresolved" : input.masterSells,
    auditLessons: input.auditLessons,
  });
  return {
    checks: checks.map((check) => ({ ...check })),
    passed: facts.relationToParent === "VALID_EXECUTION",
    facts,
  };
}

export async function runImageMeaningChecks(
  input: ImageGateRunInput,
): Promise<{ checks: ImagePassCheck[]; passed: boolean; facts: ExecutionSemanticFacts }> {
  return runImageOpenChecks(input);
}
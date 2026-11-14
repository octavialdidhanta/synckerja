import { UNDECIDED_REASON, buildBatchGatePrompt, parseGateAnswer, type GateAnswer } from "../shared/batchGates";
import { runLevelGateChain } from "../shared/defineLevelGates";
import { ancestorStakeBlock, type AncestorStake } from "../shared/ancestorStake";
import { sameWording } from "../shared/distinct";
import { angleExampleProblem } from "./example";
import { angleSubjectProblem } from "./subject";

// Runs the six Angle checks on one card, in order, and stops at the first one that does not pass.
// The same runner serves Generate, a manual edit, Revise, and the MCP server.
// Relative imports only: the MCP server loads this file.

/** The six Angle checks, in the order they run. */
export const ANGLE_PASS_CHECK_IDS = [
  "stakeHolds",
  "observation",
  "rightSize",
  "ownSubject",
  "livedExample",
  "siblingsDistinct",
] as const;

export type AnglePassCheckId = (typeof ANGLE_PASS_CHECK_IDS)[number];

/**
 * The eight earlier checks folded into the six. A new check starts ON when any switch it replaced was ON,
 * and a stored result under an old id counts for the check that replaced it.
 */
export const LEGACY_ANGLE_SWITCHES: Readonly<Record<AnglePassCheckId, readonly string[]>> = {
  stakeHolds: ["stakeHolds"],
  observation: ["observationShape", "observationJob"],
  rightSize: ["clearBoundary", "severalIdeas"],
  ownSubject: ["ownSubject"],
  livedExample: ["livedExample"],
  siblingsDistinct: ["siblingsDistinct"],
};

/** A current or an earlier check id, read as the current id; anything else is null. */
export function readAngleCheckId(value: unknown): AnglePassCheckId | null {
  if (typeof value !== "string") return null;
  if ((ANGLE_PASS_CHECK_IDS as readonly string[]).includes(value)) return value as AnglePassCheckId;
  for (const id of ANGLE_PASS_CHECK_IDS) if (LEGACY_ANGLE_SWITCHES[id].includes(value)) return id;
  return null;
}

export type AnglePassCheckState = "pending" | "running" | "pass" | "fail";

export type AnglePassCheck = {
  id: AnglePassCheckId;
  state: AnglePassCheckState;
  reason?: string;
};

/** Another Angle of the same Territory that already passed (or is locked). */
export type AnglePeer = { code: string; statement: string; subject?: string };

const UNDECIDED = UNDECIDED_REASON;

export function emptyAnglePassChecklist(): AnglePassCheck[] {
  return ANGLE_PASS_CHECK_IDS.map((id) => ({ id, state: "pending" }));
}

/**
 * The checklist a card shows after refresh, before a live run replaces it.
 * Passed: every check passed. A stored failure: the checks before it passed, the rest wait. Neither: not checked yet.
 */
export function angleChecksFromStored(input: {
  gateFailure?: { gate: string; reason: string } | null;
  passed?: boolean;
}): AnglePassCheck[] {
  if (input.passed) return ANGLE_PASS_CHECK_IDS.map((id) => ({ id, state: "pass" }));
  const gate = input.gateFailure ? readAngleCheckId(input.gateFailure.gate) : null;
  if (!gate) return [];
  const failIndex = ANGLE_PASS_CHECK_IDS.indexOf(gate);
  return ANGLE_PASS_CHECK_IDS.map((id, index) => {
    if (id === gate) return { id, state: "fail", reason: input.gateFailure?.reason ?? "" };
    return index < failIndex ? { id, state: "pass" } : { id, state: "pending" };
  });
}

/** The first failed check of a run, or null when every check passed. */
export function firstAngleFailure(checks: readonly AnglePassCheck[]): { gate: AnglePassCheckId; reason: string } | null {
  const failed = checks.find((check) => check.state === "fail");
  return failed ? { gate: failed.id, reason: failed.reason?.trim() || UNDECIDED } : null;
}

/** The rule text of one Angle check, shared by the one-check and the batched prompts. */
export function angleGateRules(id: AnglePassCheckId, subject?: string, example?: string): string[] {
  switch (id) {
    case "stakeHolds":
      return [
        "pass is true only when this Angle would stop being coherent if the distinctive stake of this Territory, or of the Big Thought or Master Thought above it, is removed.",
        "pass is false when the sentence would still stand as an Angle after that stake is removed.",
        "Also name which part of the Big Thought's reason becomes more believable when this observation is true. pass is false when no part of that reason becomes more believable, even when the observation is true and stays inside the Territory.",
      ];
    case "observation":
      return [
        "pass is true only when this is an observation inside this Territory: something rarely noticed, a contradiction, or a tension.",
        "pass is false when it is a topic, domain, label, or category; a belief or a because-reason that supports a belief; a restatement of the Territory; a concrete creative concept; or a format, scene, channel, or production form.",
      ];
    case "rightSize":
      return [
        "pass is true only when the observation is narrower than the Territory and keeps a clear boundary, and is still broad enough to generate several semantically distinct Ideas.",
        "Distinct Ideas are different creative concepts. They may differ by mechanism, narrative concept, experiment, comparison, metaphor, proof structure, scenario, or character dynamic. Differences of wording, titles, format, or cosmetics do not count.",
        "pass is false when it is too vague or too broad to bound one point of view, or so narrow that it is already one Idea.",
        "A short sentence can pass. A long sentence can fail. Do not count words.",
      ];
    case "livedExample":
      return [
        "pass is true only when the example is one concrete situation a person could point at, and that situation shows this same observation.",
        "pass is false when the example only restates the explanation, names a brand or a belief system, or is already a finished Idea.",
        `Example: ${example?.trim() || "(none)"}`,
      ];
    case "ownSubject":
      return [
        "pass is true when the short subject, read alone, still carries the distinctive fact of this observation.",
        "A noun phrase is the right shape. It does not have to repeat the sentence, mention the Territory, or be exclusive to this Territory.",
        "The same words may be sayable in another place. That does not make pass false.",
        "pass is false only when the subject names the place instead of the fact: the Territory's name, a piece of the Territory, a chopped opening, or a heading under which a different observation would still fit.",
        `Subject: ${subject?.trim() || "(none)"}`,
      ];
    case "siblingsDistinct":
      return [
        "pass is true when this Angle is a different observation from every other Angle listed below.",
        "pass is false only when it repeats one of them, or one of them already contains it: the same rarely noticed fact in other words.",
        "A shared topic or a shared Territory is not a repeat. When pass is false, the reason names the code of the Angle it repeats.",
      ];
  }
}

function angleDecisionHint(id: AnglePassCheckId): string {
  return id === "ownSubject"
    ? "When the words still carry the distinctive fact, return pass true even if they are a noun phrase and could be said in another place. When the words only name the place, do not return pass true."
    : "When you cannot decide, do not return pass true.";
}

function peerLines(peers: readonly AnglePeer[]): string[] {
  return ["Other Angles of this Territory that already passed:", ...peers.map((peer) => `${peer.code}: ${peer.statement}`)];
}

type CheckContext = {
  statement: string;
  parentStatement: string;
  ancestors?: AncestorStake[];
  subject?: string;
  example?: string;
  peers?: readonly AnglePeer[];
};

function contextLines(input: CheckContext): string[] {
  return [`Angle: ${input.statement.trim()}`, "Direct Territory:", input.parentStatement.trim(), ...ancestorStakeBlock(input.ancestors)];
}

function extraFor(id: AnglePassCheckId, input: CheckContext): string[] {
  return id === "siblingsDistinct" ? [angleDecisionHint(id), ...peerLines(input.peers ?? [])] : [angleDecisionHint(id)];
}

/** Every open Angle check of one sentence in one prompt. */
export function buildAngleBatchPrompt(input: CheckContext & { ids: readonly AnglePassCheckId[] }): string {
  return buildBatchGatePrompt({
    item: "Angle",
    language: "Territory",
    gates: input.ids.map((id) => ({ id, rules: angleGateRules(id, input.subject, input.example), extra: extraFor(id, input) })),
    context: contextLines(input),
  });
}

export function buildAnglePassPrompt(input: CheckContext & { id: AnglePassCheckId }): string {
  return [
    "Decide one Angle pass check. Do not rewrite the sentence.",
    ...angleGateRules(input.id, input.subject, input.example),
    "When pass is false, reason says why in the same language as the Territory.",
    ...extraFor(input.id, input),
    'Return JSON only: {"pass":true,"reason":""} or {"pass":false,"reason":"..."}',
    "",
    ...contextLines(input),
  ].join("\n");
}

/** A missing or undecided answer fails the check. */
export const parseAnglePassCheck = parseGateAnswer;

/**
 * A check decided without a model: an empty or copied subject, an empty or restated example,
 * the same sentence or subject as a passed Angle, or no passed Angle to compare with.
 */
function decidedInCode(id: AnglePassCheckId, input: CheckContext): GateAnswer | null {
  if (id === "ownSubject") {
    const problem = angleSubjectProblem(input.subject ?? "", input.parentStatement);
    return problem ? { pass: false, reason: problem } : null;
  }
  if (id === "livedExample") {
    const problem = angleExampleProblem(input.example ?? "", input.statement);
    return problem ? { pass: false, reason: problem } : null;
  }
  if (id === "siblingsDistinct") {
    const peers = input.peers ?? [];
    if (peers.length === 0) return { pass: true, reason: "" };
    const repeated = peers.find(
      (peer) => sameWording(peer.statement, input.statement) || Boolean(input.subject && peer.subject && sameWording(peer.subject, input.subject)),
    );
    if (repeated) return { pass: false, reason: `${repeated.code}: ${repeated.statement}` };
  }
  return null;
}

export type AngleCheckRun = { checks: AnglePassCheck[]; passed: boolean };

/**
 * Runs the six checks in order and stops at the first one that does not pass.
 * A check switched OFF, or kept from an earlier pass on this card, is not asked.
 */
export async function runAngleChecks(
  input: CheckContext & {
    /** Checks switched OFF for this organization: treated as passed, never asked. */
    skip?: readonly string[];
    /** Checks that already passed on this exact card; they stay passed. */
    keep?: readonly AnglePassCheckId[];
    ask: (prompt: string) => Promise<string | null>;
    onStep?: (checks: AnglePassCheck[]) => void;
  },
): Promise<AngleCheckRun> {
  const run = await runLevelGateChain({
    ids: ANGLE_PASS_CHECK_IDS,
    skip: input.skip,
    keep: input.keep,
    decided: (id) => decidedInCode(id, input),
    batchPrompt: (ids) => buildAngleBatchPrompt({ ...input, ids }),
    prompt: (id) => buildAnglePassPrompt({ ...input, id }),
    ask: input.ask,
    onStep: input.onStep,
  });
  return { checks: run.checks, passed: run.passed };
}

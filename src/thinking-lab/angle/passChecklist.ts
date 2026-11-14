import { parseModelJson } from "../shared/parseModelJson";
import { askBatchGates, buildBatchGatePrompt, isUndecided, type GateAnswer } from "../shared/batchGates";
import { ancestorStakeBlock, type AncestorStake } from "../shared/ancestorStake";
import { angleExampleProblem } from "./example";
import { angleSubjectProblem } from "./subject";
import type { AngleGeneratePass } from "./types";

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

const INDIVIDUAL_PASS_CHECK_IDS = [
  "stakeHolds",
  "observation",
  "rightSize",
  "ownSubject",
  "livedExample",
] as const satisfies readonly AnglePassCheckId[];

type IndividualCheckId = (typeof INDIVIDUAL_PASS_CHECK_IDS)[number];

/** Generate judges only the observation; the other checks wait for Audit. */
export const ANGLE_GENERATE_PASS_IDS = ["observation"] as const satisfies readonly AngleGeneratePass[];

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

/** The Generate pass, also from rows saved with the two earlier Generate checks (both were needed). */
export function readAngleGeneratePasses(value: unknown): AngleGeneratePass[] {
  if (!Array.isArray(value)) return [];
  if (value.includes("observation")) return ["observation"];
  return value.includes("observationJob") && value.includes("observationShape") ? ["observation"] : [];
}

/** Checklist shown while Generate is judging a sentence. Later Audit checks stay off this list. */
export function angleAdmissionChecks(failed?: { id: AngleGeneratePass; reason: string } | null): AnglePassCheck[] {
  return ANGLE_GENERATE_PASS_IDS.map((id) =>
    failed && id === failed.id ? { id, state: "fail", reason: failed.reason } : { id, state: "pending" },
  );
}

/** A new sentence loses the Generate pass. Checks that passed on this sentence stay. */
export function fixPriorForNextAngleStatement(
  prior: readonly AnglePassCheck[],
  previousStatement: string,
  nextStatement: string,
): AnglePassCheck[] {
  const changed = previousStatement.trim().toLocaleLowerCase() !== nextStatement.trim().toLocaleLowerCase();
  return prior.map((item) => (changed && item.id === "observation" ? { id: item.id, state: "pending" } : { ...item }));
}

/** The checklist a card shows after refresh, before a live run replaces it. */
export function angleChecksFromStored(input: {
  generatePasses?: unknown;
  gateFailure?: { gate: string; reason: string } | null;
  passed?: boolean;
}): AnglePassCheck[] {
  if (input.passed) return ANGLE_PASS_CHECK_IDS.map((id) => ({ id, state: "pass" }));
  const carried = new Set<string>(readAngleGeneratePasses(input.generatePasses));
  const gate = input.gateFailure ? readAngleCheckId(input.gateFailure.gate) : null;
  const failIndex = gate ? ANGLE_PASS_CHECK_IDS.indexOf(gate) : -1;
  if (!gate && carried.size === 0) return [];
  return ANGLE_PASS_CHECK_IDS.map((id, index) => {
    if (gate && id === gate) return { id, state: "fail", reason: input.gateFailure?.reason ?? "" };
    if (carried.has(id)) return { id, state: "pass" };
    if (gate && index < failIndex) return { id, state: "pass" };
    return { id, state: "pending" };
  });
}

export type AnglePassCheckState = "pending" | "running" | "pass" | "fail";

export type AnglePassCheck = {
  id: AnglePassCheckId;
  state: AnglePassCheckState;
  reason?: string;
};

const UNDECIDED = "This check could not be decided.";

export function emptyAnglePassChecklist(): AnglePassCheck[] {
  return ANGLE_PASS_CHECK_IDS.map((id) => ({ id, state: "pending" }));
}

export function individualAnglePassChecksCleared(checks: readonly AnglePassCheck[]): boolean {
  return INDIVIDUAL_PASS_CHECK_IDS.every((id) => checks.some((check) => check.id === id && check.state === "pass"));
}

/** The rule text of one Angle check, shared by the one-check and the batched prompts. */
export function angleGateRules(id: IndividualCheckId, subject?: string, example?: string): string[] {
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
  }
}

function angleDecisionHint(id: IndividualCheckId): string {
  return id === "ownSubject"
    ? "When the words still carry the distinctive fact, return pass true even if they are a noun phrase and could be said in another place. When the words only name the place, do not return pass true."
    : "When you cannot decide, do not return pass true.";
}

type CheckContext = {
  statement: string;
  parentStatement: string;
  ancestors?: AncestorStake[];
  subject?: string;
  example?: string;
};

/** Every open Angle check of one sentence in one prompt. */
export function buildAngleBatchPrompt(input: CheckContext & { ids: readonly IndividualCheckId[] }): string {
  return buildBatchGatePrompt({
    item: "Angle",
    language: "Territory",
    gates: input.ids.map((id) => ({
      id,
      rules: angleGateRules(id, input.subject, input.example),
      extra: [angleDecisionHint(id)],
    })),
    context: [`Angle: ${input.statement.trim()}`, "Direct Territory:", input.parentStatement.trim(), ...ancestorStakeBlock(input.ancestors)],
  });
}

export function buildAnglePassPrompt(input: CheckContext & { id: IndividualCheckId }): string {
  return [
    "Decide one Angle pass check. Do not rewrite the sentence.",
    ...angleGateRules(input.id, input.subject, input.example),
    "When pass is false, reason says why in the same language as the Territory.",
    angleDecisionHint(input.id),
    'Return JSON only: {"pass":true,"reason":""} or {"pass":false,"reason":"..."}',
    "",
    `Angle: ${input.statement.trim()}`,
    "Direct Territory:",
    input.parentStatement.trim(),
    ...ancestorStakeBlock(input.ancestors),
  ].join("\n");
}

/** A missing or undecided answer fails the check. */
export function parseAnglePassCheck(script: string | null): { pass: boolean; reason: string } {
  if (!script?.trim()) return { pass: false, reason: UNDECIDED };
  const parsed = parseModelJson(script);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { pass: false, reason: UNDECIDED };
  const row = parsed as { pass?: unknown; reason?: unknown };
  const reason = typeof row.reason === "string" ? row.reason.trim() : "";
  if (row.pass === true) return { pass: true, reason: "" };
  if (row.pass === false) return { pass: false, reason: reason || UNDECIDED };
  return { pass: false, reason: UNDECIDED };
}

export function beginAngleSiblingCheck(checks: readonly AnglePassCheck[]): AnglePassCheck[] {
  if (!individualAnglePassChecksCleared(checks)) return checks.map((check) => ({ ...check }));
  return checks.map((check) => (check.id === "siblingsDistinct" ? { id: check.id, state: "running" } : { ...check }));
}

export function finishAngleSiblingCheck(
  checks: readonly AnglePassCheck[],
  pass: boolean,
  reason: string,
): AnglePassCheck[] {
  if (!individualAnglePassChecksCleared(checks)) return checks.map((check) => ({ ...check }));
  return checks.map((check) =>
    check.id === "siblingsDistinct"
      ? { id: check.id, state: pass ? "pass" : "fail", ...(pass ? {} : { reason: reason.trim() || UNDECIDED }) }
      : { ...check },
  );
}

/** A problem found without a model: an empty or copied subject, an empty or restated example. */
function localProblem(id: IndividualCheckId, input: CheckContext): string | null {
  if (id === "ownSubject") return angleSubjectProblem(input.subject ?? "", input.parentStatement);
  if (id === "livedExample") return angleExampleProblem(input.example ?? "", input.statement);
  return null;
}

type RunInput = CheckContext & {
  /** Ask every open check in one model call (falls back to one call per check). */
  batch?: boolean;
  /** Checks switched OFF for this organization: treated as passed, never asked. */
  skip?: readonly string[];
  ask: (prompt: string) => Promise<string | null>;
  onStep: (checks: AnglePassCheck[]) => void;
};

/**
 * The one runner behind Generate and Audit: runs `ids` in order on top of `start`, stops at the first fail.
 * A check that is already passed, or switched OFF, is not asked.
 */
async function runChecks(
  input: RunInput & { ids: readonly IndividualCheckId[]; start: AnglePassCheck[]; retryUndecided?: boolean },
): Promise<{ checks: AnglePassCheck[]; passed: boolean }> {
  const checks = input.start.map((check) =>
    input.skip?.includes(check.id) ? { id: check.id, state: "pass" as const } : { ...check },
  );
  const snapshot = () => checks.map((check) => ({ ...check }));
  const publish = () => input.onStep(snapshot());
  const set = (next: AnglePassCheck) => {
    checks[checks.findIndex((check) => check.id === next.id)] = next;
    publish();
  };
  publish();
  const open = input.ids.filter((id) => checks.find((check) => check.id === id)?.state !== "pass");
  const batchIds = open.filter((id) => !localProblem(id, input));
  let batched = new Map<string, GateAnswer>();
  if (input.batch && batchIds.length >= 2) {
    batched = (await askBatchGates({ prompt: buildAngleBatchPrompt({ ...input, ids: batchIds }), ids: batchIds, ask: input.ask })) ?? new Map();
  }
  for (const id of open) {
    set({ id, state: "running" });
    const problem = localProblem(id, input);
    if (problem) {
      set({ id, state: "fail", reason: problem });
      return { checks: snapshot(), passed: false };
    }
    const answer = batched.get(id);
    let parsed = answer && !isUndecided(answer) ? answer : null;
    const prompt = buildAnglePassPrompt({ ...input, id });
    if (!parsed) parsed = parseAnglePassCheck(await input.ask(prompt));
    if (!parsed.pass && parsed.reason === UNDECIDED && input.retryUndecided) {
      parsed = parseAnglePassCheck(await input.ask(prompt));
    }
    if (!parsed.pass) {
      set({ id, state: "fail", reason: parsed.reason });
      return { checks: snapshot(), passed: false };
    }
    set({ id, state: "pass" });
  }
  return { checks: snapshot(), passed: true };
}

/** Generate: the observation check only. */
export function runAngleAdmissionChecks(input: RunInput): Promise<{ checks: AnglePassCheck[]; passed: boolean }> {
  return runChecks({ ...input, ids: ANGLE_GENERATE_PASS_IDS, start: angleAdmissionChecks(), retryUndecided: true });
}

/** Audit: every check except the sibling check. Checks that passed before stay passed. */
export function runAngleOpenChecks(
  input: RunInput & { prior: readonly AnglePassCheck[] },
): Promise<{ checks: AnglePassCheck[]; passed: boolean }> {
  const start = emptyAnglePassChecklist().map((check) =>
    input.prior.some((item) => item.id === check.id && item.state === "pass") ? { id: check.id, state: "pass" as const } : check,
  );
  return runChecks({ ...input, ids: INDIVIDUAL_PASS_CHECK_IDS, start });
}

/** Audit of a fresh sentence: the Generate pass it carries counts, the rest is asked. */
export function runAngleIndividualChecks(
  input: RunInput & { carried?: readonly AngleGeneratePass[] },
): Promise<{ checks: AnglePassCheck[]; passed: boolean }> {
  const carried = new Set<string>(readAngleGeneratePasses(input.carried));
  return runAngleOpenChecks({ ...input, prior: [...carried].map((id) => ({ id: id as AnglePassCheckId, state: "pass" })) });
}

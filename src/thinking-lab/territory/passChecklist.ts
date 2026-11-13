import { parseModelJson } from "../shared/parseModelJson";
import { askBatchGates, buildBatchGatePrompt, isUndecided, type GateAnswer } from "../shared/batchGates";
import type { TerritoryGeneratePass } from "./types";

export const TERRITORY_PASS_CHECK_IDS = [
  "partOfBigThought",
  "audienceLanguage",
  "questionArises",
  "wideEnough",
  "siblingsDistinct",
] as const;

export type TerritoryPassCheckId = (typeof TERRITORY_PASS_CHECK_IDS)[number];

const INDIVIDUAL_PASS_CHECK_IDS = [
  "partOfBigThought",
  "audienceLanguage",
  "questionArises",
  "wideEnough",
] as const satisfies readonly TerritoryPassCheckId[];

export const TERRITORY_GENERATE_PASS_IDS = [
  "partOfBigThought",
  "audienceLanguage",
] as const satisfies readonly TerritoryGeneratePass[];

/** Both Generate checks, or nothing. One id alone is not a pass to carry. */
export function readTerritoryGeneratePasses(value: unknown): TerritoryGeneratePass[] {
  if (!Array.isArray(value)) return [];
  const found = new Set<TerritoryGeneratePass>();
  for (const item of value) {
    if (item === "partOfBigThought" || item === "audienceLanguage") found.add(item);
  }
  return TERRITORY_GENERATE_PASS_IDS.every((id) => found.has(id)) ? [...TERRITORY_GENERATE_PASS_IDS] : [];
}

/** Checklist shown while Generate is judging a name. Later Audit checks stay off this list. */
export function territoryAdmissionChecks(
  failed?: { id: TerritoryGeneratePass; reason: string } | null,
): TerritoryPassCheck[] {
  return TERRITORY_GENERATE_PASS_IDS.map((id) => {
    if (!failed) return { id, state: "pending" };
    const index = TERRITORY_GENERATE_PASS_IDS.indexOf(id);
    const failIndex = TERRITORY_GENERATE_PASS_IDS.indexOf(failed.id);
    if (index < failIndex) return { id, state: "pass" };
    if (id === failed.id) return { id, state: "fail", reason: failed.reason };
    return { id, state: "pending" };
  });
}

/** A new name keeps every check that already passed. Only a failed or unrun check is asked again. */
export function fixPriorForNextTerritoryName(
  prior: readonly TerritoryPassCheck[],
  _previousStatement: string,
  _nextStatement: string,
): TerritoryPassCheck[] {
  return prior.map((item) => ({ ...item }));
}

/** The checklist a card shows after refresh, before a live run replaces it. */
export function territoryChecksFromStored(input: {
  generatePasses?: unknown;
  gateFailure?: { gate: TerritoryPassCheckId; reason: string } | null;
  passed?: boolean;
}): TerritoryPassCheck[] {
  if (input.passed) return TERRITORY_PASS_CHECK_IDS.map((id) => ({ id, state: "pass" }));
  const carried = new Set(readTerritoryGeneratePasses(input.generatePasses));
  const failure = input.gateFailure ?? null;
  const failIndex = failure ? TERRITORY_PASS_CHECK_IDS.indexOf(failure.gate) : -1;
  if (!failure && carried.size === 0) return [];
  return TERRITORY_PASS_CHECK_IDS.map((id, index) => {
    if (failure && index === failIndex) return { id, state: "fail", reason: failure.reason };
    if (failure && index > failIndex) return { id, state: "pending" };
    if (failure && index < failIndex) return { id, state: "pass" };
    if (carried.has(id as TerritoryGeneratePass)) return { id, state: "pass" };
    return { id, state: "pending" };
  });
}

export type TerritoryPassCheckState = "pending" | "running" | "pass" | "fail";

export type TerritoryPassCheck = {
  id: TerritoryPassCheckId;
  state: TerritoryPassCheckState;
  reason?: string;
};

const UNDECIDED = "This check could not be decided.";
const MISSING_QUESTION = "The question this Big Thought answers did not come back.";

export function emptyPassChecklist(): TerritoryPassCheck[] {
  return TERRITORY_PASS_CHECK_IDS.map((id) => ({ id, state: "pending" }));
}

export function individualPassChecksCleared(checks: readonly TerritoryPassCheck[]): boolean {
  return INDIVIDUAL_PASS_CHECK_IDS.every((id) => checks.some((check) => check.id === id && check.state === "pass"));
}

/** The rule text of one Territory check, shared by the one-check and the batched prompts. */
function territoryGateRules(
  id: (typeof INDIVIDUAL_PASS_CHECK_IDS)[number],
  audience?: string,
  question?: string,
): string[] {
  const audienceText = audience?.trim();
  const questionText = question?.trim() ?? "";
  return (
    id === "partOfBigThought"
      ? [
          "pass is true only when the name is an area in the audience's world that is part of this Big Thought: the Big Thought's own reason is something people in that area actually meet, so it can be discussed there specifically, and the name is not a keyword copied from the Big Thought.",
          "pass is false when the name is not an area in the audience's world, when the name is only a keyword copied from the Big Thought (its title, its reason, or a short restatement of its words), or when the area is so general that any Big Thought of this Master Thought could be placed there just as well.",
          "A word that also appears in the Big Thought does not make the name a copied keyword when the name still names a different area.",
          "That the area also holds other subjects is fine. What matters is that this Big Thought's reason is met there, not only that it could be connected.",
          "Kurir paket passes under a Big Thought about delivery cost. Biaya kirim fails because it copies the Big Thought.",
        ]
      : id === "audienceLanguage"
        ? [
            "pass is true when these words are how the audience would name this area.",
            "pass is false when the words are an internal strategy term or jargon the audience would not use.",
            audienceText ? `Audience: ${audienceText}` : "Use the audience named with the Big Thought.",
          ]
        : id === "questionArises"
          ? [
              "pass is true only when the question the Big Thought answers actually comes up in this area.",
              "pass is false when a different question comes up there, or the question only restates the Big Thought.",
              "Other questions coming up in that area do not make pass false.",
              "The question that comes up must be one the Big Thought's own reason answers. A question about a different quality of the same subject is a different question, even when the topic is close: pass is false.",
              "Judge the supplied question only. Do not replace it with a question taken from the Territory name or from another subject.",
              questionText ? `Question the Big Thought answers: ${questionText}` : "No question was supplied, so pass is false.",
            ]
            : [
              "An Angle is one observation inside a Territory. This check asks whether the name is still a place or has already become one Angle.",
              "pass is true only when you can name at least two different rarely noticed observations in this place, besides the Big Thought's own answer, without leaving the name and without one only restating the other. Name them in your reasoning before you decide.",
              "pass is false when the name itself is already one observation, one claim, one conclusion, or one method, or when the only observation you can name there is the Big Thought's own answer, or when fewer than two other observations can be named.",
              "Do not fail only because the other Angles have not been written yet. Judge whether they could be.",
              "Kurir paket passes under a Big Thought that one courier type is cheaper. Route, weight, and speed remain other observations. Kurir motor lebih murah fails because the name is already that one claim.",
              "When pass is false, the reason names the observation already stated by the Territory name. Do not quote the Big Thought's answer as that observation.",
            ]
  );
}

function territoryDecisionHint(id: (typeof INDIVIDUAL_PASS_CHECK_IDS)[number]): string {
  return id === "partOfBigThought"
      ? "When the only doubt is a shared word, return pass true. When the Big Thought's reason is not actually met in that area, or you cannot decide whether it names an area at all, do not return pass true."
      : id === "wideEnough"
        ? "When you cannot name two different observations there besides the Big Thought's answer, do not return pass true. When the name itself is already one observation or one claim, do not return pass true."
        : "When you cannot decide, do not return pass true.";
}

/** Every open Territory check of one name in one prompt. */
export function buildTerritoryBatchPrompt(input: {
  ids: ReadonlyArray<(typeof INDIVIDUAL_PASS_CHECK_IDS)[number]>;
  statement: string;
  parentStatement: string;
  audience?: string;
  question?: string;
}): string {
  return buildBatchGatePrompt({
    item: "Territory",
    language: "Big Thought",
    gates: input.ids.map((id) => ({
      id,
      rules: territoryGateRules(id, input.audience, input.question),
      extra: [territoryDecisionHint(id)],
    })),
    context: [`Territory: ${input.statement.trim()}`, "Big Thought:", input.parentStatement.trim()],
  });
}

/** One model call for the open checks; questionArises joins only when its question is known. */
async function batchedTerritoryAnswers(input: {
  batch?: boolean;
  open: ReadonlyArray<(typeof INDIVIDUAL_PASS_CHECK_IDS)[number]>;
  statement: string;
  parentStatement: string;
  audience?: string;
  question?: string;
  ask: (prompt: string) => Promise<string | null>;
}): Promise<Map<string, GateAnswer>> {
  if (!input.batch) return new Map();
  const ids = input.open.filter((id) => id !== "questionArises" || Boolean(input.question?.trim()));
  if (ids.length < 2) return new Map();
  const answers = await askBatchGates({
    prompt: buildTerritoryBatchPrompt({ ...input, ids }),
    ids,
    ask: input.ask,
  });
  return answers ?? new Map();
}

export function buildTerritoryPassPrompt(input: {
  id: (typeof INDIVIDUAL_PASS_CHECK_IDS)[number];
  statement: string;
  parentStatement: string;
  audience?: string;
  question?: string;
}): string {
  const rule = territoryGateRules(input.id, input.audience, input.question);
  return [
    "Decide one Territory pass check. Do not rewrite the name.",
    ...rule,
    "When pass is false, reason says why in the same language as the Big Thought.",
    territoryDecisionHint(input.id),
    'Return JSON only: {"pass":true,"reason":""} or {"pass":false,"reason":"..."}',
    "",
    `Territory: ${input.statement.trim()}`,
    "Big Thought:",
    input.parentStatement.trim(),
  ].join("\n");
}

/** A missing or undecided answer fails the check. */
export function parseTerritoryPassCheck(script: string | null): { pass: boolean; reason: string } {
  if (!script?.trim()) return { pass: false, reason: UNDECIDED };
  const parsed = parseModelJson(script);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { pass: false, reason: UNDECIDED };
  const row = parsed as { pass?: unknown; reason?: unknown };
  const reason = typeof row.reason === "string" ? row.reason.trim() : "";
  if (row.pass === true) return { pass: true, reason: "" };
  if (row.pass === false) return { pass: false, reason: reason || UNDECIDED };
  return { pass: false, reason: UNDECIDED };
}

export function beginSiblingCheck(checks: readonly TerritoryPassCheck[]): TerritoryPassCheck[] {
  if (!individualPassChecksCleared(checks)) return checks.map((check) => ({ ...check }));
  return checks.map((check) => (check.id === "siblingsDistinct" ? { id: check.id, state: "running" } : { ...check }));
}

export function finishSiblingCheck(
  checks: readonly TerritoryPassCheck[],
  pass: boolean,
  reason: string,
): TerritoryPassCheck[] {
  if (!individualPassChecksCleared(checks)) return checks.map((check) => ({ ...check }));
  return checks.map((check) =>
    check.id === "siblingsDistinct"
      ? { id: check.id, state: pass ? "pass" : "fail", ...(pass ? {} : { reason: reason.trim() || UNDECIDED }) }
      : { ...check },
  );
}

export async function runTerritoryAdmissionChecks(input: {
  /** Ask every open check in one model call (falls back to one call per check). */
  batch?: boolean;
  statement: string;
  parentStatement: string;
  audience?: string;
  ask: (prompt: string) => Promise<string | null>;
  onStep: (checks: TerritoryPassCheck[]) => void;
}): Promise<{ checks: TerritoryPassCheck[]; passed: boolean }> {
  const checks = territoryAdmissionChecks();
  const publish = () => input.onStep(checks.map((check) => ({ ...check })));
  publish();
  const batched = await batchedTerritoryAnswers({ ...input, open: TERRITORY_GENERATE_PASS_IDS });
  for (const id of TERRITORY_GENERATE_PASS_IDS) {
    const index = checks.findIndex((check) => check.id === id);
    checks[index] = { id, state: "running" };
    publish();
    const prompt = buildTerritoryPassPrompt({
      id,
      statement: input.statement,
      parentStatement: input.parentStatement,
      audience: input.audience,
    });
    const answer = batched.get(id);
    let script = answer && !isUndecided(answer) ? null : await input.ask(prompt);
    let parsed = answer && !isUndecided(answer) ? answer : parseTerritoryPassCheck(script);
    if (!parsed.pass && parsed.reason === UNDECIDED) {
      script = await input.ask(prompt);
      parsed = parseTerritoryPassCheck(script);
    }
    if (!parsed.pass) {
      checks[index] = { id, state: "fail", reason: parsed.reason };
      publish();
      return { checks: checks.map((check) => ({ ...check })), passed: false };
    }
    checks[index] = { id, state: "pass" };
    publish();
  }
  return { checks: checks.map((check) => ({ ...check })), passed: true };
}

export async function runTerritoryIndividualChecks(input: {
  /** Ask every open check in one model call (falls back to one call per check). */
  batch?: boolean;
  statement: string;
  parentStatement: string;
  audience?: string;
  question?: string;
  ensureQuestion?: () => Promise<string>;
  /** Both Generate passes for this exact name. Audit does not ask these again. */
  carried?: readonly TerritoryGeneratePass[];
  /** Checks switched OFF for this organization: treated as passed, never asked. */
  skip?: readonly string[];
  ask: (prompt: string) => Promise<string | null>;
  onStep: (checks: TerritoryPassCheck[]) => void;
}): Promise<{ checks: TerritoryPassCheck[]; passed: boolean; question: string }> {
  const carried = new Set(readTerritoryGeneratePasses(input.carried));
  const skip = new Set<string>(input.skip ?? []);
  const checks = emptyPassChecklist().map((check) =>
    carried.has(check.id as TerritoryGeneratePass) || skip.has(check.id) ? { id: check.id, state: "pass" as const } : check,
  );
  const publish = () => input.onStep(checks.map((check) => ({ ...check })));
  publish();
  let question = input.question?.trim() ?? "";
  const batched = await batchedTerritoryAnswers({
    ...input,
    question,
    open: INDIVIDUAL_PASS_CHECK_IDS.filter((id) => checks.find((check) => check.id === id)?.state !== "pass"),
  });
  for (const id of INDIVIDUAL_PASS_CHECK_IDS) {
    const index = checks.findIndex((check) => check.id === id);
    if (checks[index]?.state === "pass") continue;
    checks[index] = { id, state: "running" };
    publish();
    if (id === "questionArises" && !question && input.ensureQuestion) {
      try {
        question = (await input.ensureQuestion()).trim();
      } catch {
        question = "";
      }
    }
    if (id === "questionArises" && !question) {
      checks[index] = { id, state: "fail", reason: MISSING_QUESTION };
      publish();
      return { checks: checks.map((check) => ({ ...check })), passed: false, question };
    }
    const prompt = buildTerritoryPassPrompt({
      id,
      statement: input.statement,
      parentStatement: input.parentStatement,
      audience: input.audience,
      question,
    });
    const answer = batched.get(id);
    let script = answer && !isUndecided(answer) ? null : await input.ask(prompt);
    let parsed = answer && !isUndecided(answer) ? answer : parseTerritoryPassCheck(script);
    if (!parsed.pass && parsed.reason === UNDECIDED) {
      script = await input.ask(prompt);
      parsed = parseTerritoryPassCheck(script);
    }
    if (!parsed.pass) {
      checks[index] = { id, state: "fail", reason: parsed.reason };
      publish();
      return { checks: checks.map((check) => ({ ...check })), passed: false, question };
    }
    checks[index] = { id, state: "pass" };
    publish();
  }
  return { checks: checks.map((check) => ({ ...check })), passed: true, question };
}

/** Re-ask the checks that failed or have not run. Checks that already passed stay passed. */
export async function runTerritoryOpenChecks(input: {
  /** Ask every open check in one model call (falls back to one call per check). */
  batch?: boolean;
  statement: string;
  parentStatement: string;
  audience?: string;
  question?: string;
  ensureQuestion?: () => Promise<string>;
  /** Checks switched OFF for this organization: treated as passed, never asked. */
  skip?: readonly string[];
  prior: readonly TerritoryPassCheck[];
  ask: (prompt: string) => Promise<string | null>;
  onStep: (checks: TerritoryPassCheck[]) => void;
}): Promise<{ checks: TerritoryPassCheck[]; passed: boolean; question: string }> {
  const checks: TerritoryPassCheck[] = emptyPassChecklist().map((check) => {
    const previous = input.prior.find((item) => item.id === check.id);
    return previous?.state === "pass" || input.skip?.includes(check.id) ? { id: check.id, state: "pass" as const } : { id: check.id, state: "pending" as const };
  });
  const publish = () => input.onStep(checks.map((check) => ({ ...check })));
  publish();
  let question = input.question?.trim() ?? "";
  const batched = await batchedTerritoryAnswers({
    ...input,
    question,
    open: INDIVIDUAL_PASS_CHECK_IDS.filter((id) => checks.find((check) => check.id === id)?.state !== "pass"),
  });
  for (const id of INDIVIDUAL_PASS_CHECK_IDS) {
    const index = checks.findIndex((check) => check.id === id);
    if (checks[index]?.state === "pass") continue;
    checks[index] = { id, state: "running" };
    publish();
    if (id === "questionArises" && !question && input.ensureQuestion) {
      try {
        question = (await input.ensureQuestion()).trim();
      } catch {
        question = "";
      }
    }
    if (id === "questionArises" && !question) {
      checks[index] = { id, state: "fail", reason: MISSING_QUESTION };
      publish();
      return { checks: checks.map((check) => ({ ...check })), passed: false, question };
    }
    const prompt = buildTerritoryPassPrompt({
      id,
      statement: input.statement,
      parentStatement: input.parentStatement,
      audience: input.audience,
      question,
    });
    const answer = batched.get(id);
    let script = answer && !isUndecided(answer) ? null : await input.ask(prompt);
    let parsed = answer && !isUndecided(answer) ? answer : parseTerritoryPassCheck(script);
    if (!parsed.pass && parsed.reason === UNDECIDED) {
      script = await input.ask(prompt);
      parsed = parseTerritoryPassCheck(script);
    }
    if (!parsed.pass) {
      checks[index] = { id, state: "fail", reason: parsed.reason };
      publish();
      return { checks: checks.map((check) => ({ ...check })), passed: false, question };
    }
    checks[index] = { id, state: "pass" };
    publish();
  }
  return { checks: checks.map((check) => ({ ...check })), passed: true, question };
}

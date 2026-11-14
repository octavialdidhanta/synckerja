import { UNDECIDED_REASON, answerGate, askBatchGates, buildBatchGatePrompt, parseGateAnswer, type GateAnswer } from "../shared/batchGates";
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

const UNDECIDED = UNDECIDED_REASON;
const MISSING_QUESTION = "The question this Big Thought answers did not come back.";

export function emptyPassChecklist(): TerritoryPassCheck[] {
  return TERRITORY_PASS_CHECK_IDS.map((id) => ({ id, state: "pending" }));
}

export function individualPassChecksCleared(checks: readonly TerritoryPassCheck[]): boolean {
  return INDIVIDUAL_PASS_CHECK_IDS.every((id) => checks.some((check) => check.id === id && check.state === "pass"));
}

/** The rule text of one Territory check, shared by the one-check and the batched prompts. */
export function territoryGateRules(
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
export const parseTerritoryPassCheck = parseGateAnswer;

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

type TerritoryRunInput = {
  /** Ask every open check in one model call (falls back to one call per check). */
  batch?: boolean;
  statement: string;
  parentStatement: string;
  audience?: string;
  question?: string;
  ensureQuestion?: () => Promise<string>;
  /** Checks switched OFF for this organization: treated as passed, never asked. */
  skip?: readonly string[];
  ask: (prompt: string) => Promise<string | null>;
  onStep: (checks: TerritoryPassCheck[]) => void;
};

type TerritoryRun = { checks: TerritoryPassCheck[]; passed: boolean; question: string };

/**
 * Walks ids in order over a starting checklist and stops at the first check that does not pass.
 * A check already marked pass is not asked; a check switched OFF passes when its turn comes.
 */
async function runTerritoryChain(
  input: TerritoryRunInput,
  ids: ReadonlyArray<(typeof INDIVIDUAL_PASS_CHECK_IDS)[number]>,
  checks: TerritoryPassCheck[],
): Promise<TerritoryRun> {
  const skip = new Set<string>(input.skip ?? []);
  const snapshot = () => checks.map((check) => ({ ...check }));
  const set = (next: TerritoryPassCheck) => {
    checks[checks.findIndex((check) => check.id === next.id)] = next;
    input.onStep(snapshot());
  };
  input.onStep(snapshot());
  let question = input.question?.trim() ?? "";
  const batched = await batchedTerritoryAnswers({
    ...input,
    question,
    open: ids.filter((id) => !skip.has(id) && checks.find((check) => check.id === id)?.state !== "pass"),
  });
  for (const id of ids) {
    if (checks.find((check) => check.id === id)?.state === "pass") continue;
    if (skip.has(id)) {
      set({ id, state: "pass" });
      continue;
    }
    set({ id, state: "running" });
    if (id === "questionArises" && !question && input.ensureQuestion) {
      try {
        question = (await input.ensureQuestion()).trim();
      } catch {
        question = "";
      }
    }
    if (id === "questionArises" && !question) {
      set({ id, state: "fail", reason: MISSING_QUESTION });
      return { checks: snapshot(), passed: false, question };
    }
    const answer = await answerGate({
      batched: batched.get(id),
      prompt: () =>
        buildTerritoryPassPrompt({
          id,
          statement: input.statement,
          parentStatement: input.parentStatement,
          audience: input.audience,
          question,
        }),
      ask: input.ask,
    });
    if (!answer.pass) {
      set({ id, state: "fail", reason: answer.reason });
      return { checks: snapshot(), passed: false, question };
    }
    set({ id, state: "pass" });
  }
  return { checks: snapshot(), passed: true, question };
}

/** The two Generate checks of a new name. */
export async function runTerritoryAdmissionChecks(
  input: Omit<TerritoryRunInput, "question" | "ensureQuestion">,
): Promise<{ checks: TerritoryPassCheck[]; passed: boolean }> {
  const { checks, passed } = await runTerritoryChain(input, TERRITORY_GENERATE_PASS_IDS, territoryAdmissionChecks());
  return { checks, passed };
}

/** The four checks of one name. The two Generate passes carried for this exact name are not asked again. */
export async function runTerritoryIndividualChecks(
  input: TerritoryRunInput & { carried?: readonly TerritoryGeneratePass[] },
): Promise<TerritoryRun> {
  const carried = new Set(readTerritoryGeneratePasses(input.carried));
  const skip = new Set<string>(input.skip ?? []);
  const checks = emptyPassChecklist().map((check) =>
    carried.has(check.id as TerritoryGeneratePass) || skip.has(check.id) ? { id: check.id, state: "pass" as const } : check,
  );
  return runTerritoryChain(input, INDIVIDUAL_PASS_CHECK_IDS, checks);
}

/** Re-ask the checks that failed or have not run. Checks that already passed stay passed. */
export async function runTerritoryOpenChecks(
  input: TerritoryRunInput & { prior: readonly TerritoryPassCheck[] },
): Promise<TerritoryRun> {
  const checks: TerritoryPassCheck[] = emptyPassChecklist().map((check) => {
    const previous = input.prior.find((item) => item.id === check.id);
    return previous?.state === "pass" || input.skip?.includes(check.id)
      ? { id: check.id, state: "pass" as const }
      : { id: check.id, state: "pending" as const };
  });
  return runTerritoryChain(input, INDIVIDUAL_PASS_CHECK_IDS, checks);
}

// Runs the five Territory checks on one name, in order, and stops at the first one that does not pass.
// The same runner serves Generate, a manual edit, Revise, Audit of cards never checked, and the MCP server.
// Relative imports only: the MCP server loads this file.
import {
  SWITCHED_OFF_REASON,
  UNDECIDED_REASON,
  answerGate,
  askBatchGates,
  buildBatchGatePrompt,
  parseGateAnswer,
  type GateAnswer,
} from "../shared/batchGates";
import { sameWording } from "../shared/distinct";
import {
  TERRITORY_ACTIVITY_REASON,
  TERRITORY_NAME_LENGTH_REASON,
  territoryNameIsActivity,
  territoryNameTooLong,
} from "./generate";

/** The five Territory checks, in the order they run. */
export const TERRITORY_PASS_CHECK_IDS = [
  "partOfBigThought",
  "audienceLanguage",
  "questionArises",
  "wideEnough",
  "siblingsDistinct",
] as const;

export type TerritoryPassCheckId = (typeof TERRITORY_PASS_CHECK_IDS)[number];

/** A stored check id, or null for anything else. */
export function readTerritoryCheckId(value: unknown): TerritoryPassCheckId | null {
  return typeof value === "string" && (TERRITORY_PASS_CHECK_IDS as readonly string[]).includes(value)
    ? (value as TerritoryPassCheckId)
    : null;
}

export type TerritoryPassCheckState = "pending" | "running" | "pass" | "fail";

export type TerritoryPassCheck = {
  id: TerritoryPassCheckId;
  state: TerritoryPassCheckState;
  reason?: string;
};

/** Another Territory of the same Big Thought that already passed (or is locked). */
export type TerritoryPeer = { code: string; statement: string };

const UNDECIDED = UNDECIDED_REASON;
const MISSING_QUESTION = "The question this Big Thought answers did not come back.";

export function emptyPassChecklist(): TerritoryPassCheck[] {
  return TERRITORY_PASS_CHECK_IDS.map((id) => ({ id, state: "pending" }));
}

/**
 * The checklist a card shows after refresh, before a live run replaces it.
 * Passed: every check passed. A stored failure: the checks before it passed, the rest wait. Neither: not checked yet.
 */
export function territoryChecksFromStored(input: {
  gateFailure?: { gate: TerritoryPassCheckId; reason: string } | null;
  passed?: boolean;
}): TerritoryPassCheck[] {
  if (input.passed) return TERRITORY_PASS_CHECK_IDS.map((id) => ({ id, state: "pass" }));
  const gate = input.gateFailure ? readTerritoryCheckId(input.gateFailure.gate) : null;
  if (!gate) return [];
  const failIndex = TERRITORY_PASS_CHECK_IDS.indexOf(gate);
  return TERRITORY_PASS_CHECK_IDS.map((id, index) => {
    if (id === gate) return { id, state: "fail", reason: input.gateFailure?.reason ?? "" };
    return index < failIndex ? { id, state: "pass" } : { id, state: "pending" };
  });
}

/** The first failed check of a run, or null when every check passed. */
export function firstTerritoryFailure(
  checks: readonly TerritoryPassCheck[],
): { gate: TerritoryPassCheckId; reason: string } | null {
  const failed = checks.find((check) => check.state === "fail");
  return failed ? { gate: failed.id, reason: failed.reason?.trim() || UNDECIDED } : null;
}

/** The rule text of one Territory check, shared by the one-check and the batched prompts. */
export function territoryGateRules(id: TerritoryPassCheckId, audience?: string, question?: string): string[] {
  if (id === "siblingsDistinct") {
    return [
      "pass is true when this Territory is a different area from every other Territory listed below.",
      "pass is false only when it names the same area as one of them in other words, or one of them already covers its area.",
      "Areas that share a topic or a word are not a repeat while each still holds its own observations. When pass is false, the reason names the code of the Territory it repeats or that covers it.",
    ];
  }
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

function territoryDecisionHint(id: TerritoryPassCheckId): string {
  return id === "partOfBigThought"
      ? "When the only doubt is a shared word, return pass true. When the Big Thought's reason is not actually met in that area, or you cannot decide whether it names an area at all, do not return pass true."
      : id === "wideEnough"
        ? "When you cannot name two different observations there besides the Big Thought's answer, do not return pass true. When the name itself is already one observation or one claim, do not return pass true."
        : "When you cannot decide, do not return pass true.";
}

type CheckContext = {
  statement: string;
  parentStatement: string;
  audience?: string;
  question?: string;
  peers?: readonly TerritoryPeer[];
};

function peerLines(peers: readonly TerritoryPeer[]): string[] {
  return ["Other Territories of this Big Thought that already passed:", ...peers.map((peer) => `${peer.code}: ${peer.statement}`)];
}

function extraFor(id: TerritoryPassCheckId, input: CheckContext): string[] {
  return id === "siblingsDistinct"
    ? [territoryDecisionHint(id), ...peerLines(input.peers ?? [])]
    : [territoryDecisionHint(id)];
}

function contextLines(input: CheckContext): string[] {
  return [`Territory: ${input.statement.trim()}`, "Big Thought:", input.parentStatement.trim()];
}

/** Every open Territory check of one name in one prompt. */
export function buildTerritoryBatchPrompt(input: CheckContext & { ids: readonly TerritoryPassCheckId[] }): string {
  return buildBatchGatePrompt({
    item: "Territory",
    language: "Big Thought",
    gates: input.ids.map((id) => ({
      id,
      rules: territoryGateRules(id, input.audience, input.question),
      extra: extraFor(id, input),
    })),
    context: contextLines(input),
  });
}

export function buildTerritoryPassPrompt(input: CheckContext & { id: TerritoryPassCheckId }): string {
  return [
    "Decide one Territory pass check. Do not rewrite the name.",
    ...territoryGateRules(input.id, input.audience, input.question),
    "When pass is false, reason says why in the same language as the Big Thought.",
    ...extraFor(input.id, input),
    'Return JSON only: {"pass":true,"reason":""} or {"pass":false,"reason":"..."}',
    "",
    ...contextLines(input),
  ].join("\n");
}

/** A missing or undecided answer fails the check. */
export const parseTerritoryPassCheck = parseGateAnswer;

/**
 * A check decided without a model: a name that is too long or an activity, the same name as a passed
 * Territory, or no passed Territory to compare with.
 */
function decidedInCode(id: TerritoryPassCheckId, input: CheckContext): GateAnswer | null {
  if (id === "partOfBigThought") {
    if (territoryNameTooLong(input.statement)) return { pass: false, reason: TERRITORY_NAME_LENGTH_REASON };
    if (territoryNameIsActivity(input.statement)) return { pass: false, reason: TERRITORY_ACTIVITY_REASON };
  }
  if (id === "siblingsDistinct") {
    const peers = input.peers ?? [];
    if (peers.length === 0) return { pass: true, reason: "" };
    const repeated = peers.find((peer) => sameWording(peer.statement, input.statement));
    if (repeated) return { pass: false, reason: `${repeated.code}: ${repeated.statement}` };
  }
  return null;
}

export type TerritoryCheckRun = { checks: TerritoryPassCheck[]; passed: boolean; question: string };

/**
 * Runs the five checks in order and stops at the first one that does not pass.
 * A check switched OFF, or kept from an earlier pass on this card, is not asked.
 * questionArises needs the question the Big Thought answers; ensureQuestion fetches it when it is missing.
 */
export async function runTerritoryChecks(
  input: CheckContext & {
    ensureQuestion?: () => Promise<string>;
    /** Checks switched OFF for this organization: treated as passed, never asked. */
    skip?: readonly string[];
    /** Checks that already passed on this exact card; they stay passed. */
    keep?: readonly TerritoryPassCheckId[];
    ask: (prompt: string) => Promise<string | null>;
    onStep?: (checks: TerritoryPassCheck[]) => void;
  },
): Promise<TerritoryCheckRun> {
  const skip = new Set(input.skip ?? []);
  const keep = new Set(input.keep ?? []);
  const checks = emptyPassChecklist();
  const snapshot = () => checks.map((check) => ({ ...check }));
  const set = (next: TerritoryPassCheck) => {
    checks[TERRITORY_PASS_CHECK_IDS.indexOf(next.id)] = next;
    input.onStep?.(snapshot());
  };
  input.onStep?.(snapshot());
  let question = input.question?.trim() ?? "";
  const context = () => ({ ...input, question });
  const open = TERRITORY_PASS_CHECK_IDS.filter((id) => !skip.has(id) && !keep.has(id));
  // The run stops at the first check decided as a fail in code, so no check after it is asked.
  const stop = TERRITORY_PASS_CHECK_IDS.findIndex((id) => open.includes(id) && decidedInCode(id, input)?.pass === false);
  // questionArises joins the batch only when its question is already known.
  const byModel = open.filter(
    (id) =>
      (stop < 0 || TERRITORY_PASS_CHECK_IDS.indexOf(id) < stop) &&
      !decidedInCode(id, input) &&
      (id !== "questionArises" || Boolean(question)),
  );
  const batched =
    byModel.length > 1
      ? ((await askBatchGates({ prompt: buildTerritoryBatchPrompt({ ...context(), ids: byModel }), ids: byModel, ask: input.ask })) ??
        new Map<string, GateAnswer>())
      : new Map<string, GateAnswer>();
  for (const id of TERRITORY_PASS_CHECK_IDS) {
    if (skip.has(id)) {
      set({ id, state: "pass", reason: SWITCHED_OFF_REASON });
      continue;
    }
    if (keep.has(id)) {
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
    const answer =
      decidedInCode(id, input) ??
      (await answerGate({ batched: batched.get(id), prompt: () => buildTerritoryPassPrompt({ ...context(), id }), ask: input.ask }));
    if (!answer.pass) {
      set({ id, state: "fail", reason: answer.reason || UNDECIDED });
      return { checks: snapshot(), passed: false, question };
    }
    set({ id, state: "pass" });
  }
  return { checks: snapshot(), passed: true, question };
}

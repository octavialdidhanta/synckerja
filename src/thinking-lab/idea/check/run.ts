// Runs the seven Idea checks on one sentence, in order, and stops at the first one that does not pass.
// A check switched OFF for the organization passes without a model call.
// Relative imports only: the MCP server loads this file.
import { askBatchGates, buildBatchGatePrompt, isUndecided, type GateAnswer } from "../../shared/batchGates";
import { parseModelJson } from "../../shared/parseModelJson";
import type { IdeaMechanismKey } from "../facts";
import {
  announcedConclusionReason,
  distinctFailCounts,
  hasHowIfOpening,
  ideaAnnouncesConclusion,
  inAngleLanguage,
  proposalFailCounts,
  resultFailCounts,
  watchableFailCounts,
} from "./guards";
import { IDEA_CHECK_IDS, type IdeaCheckId } from "./ids";
import { sameStatement, type FailureMemoryItem, type IdeaPeer } from "./memory";
import { blankCriterion, notProposalReason, sealValidation, type IdeaCriterion, type IdeaValidation } from "./record";
import { IDEA_CHECK_RULES } from "./rules";

export type IdeaCheckStep = {
  id: IdeaCheckId;
  state: "pending" | "running" | "pass" | "fail";
  reason?: string;
};

type IdeaCheckInput = {
  statement: string;
  title?: string;
  concept?: string;
  mechanism?: string;
  value?: string;
  mechanismKeys?: readonly IdeaMechanismKey[];
  angle: string;
  territory: string;
  bigThought: string;
  masterThought: string;
  masterSubject?: string;
  audience?: string;
  priorBelief?: string;
  rootBelief?: string;
  /** Sentences that already failed; the same sentence fails the same check again without a model call. */
  failures: readonly FailureMemoryItem[];
  /** Ideas that passed, including locked ones. The current Idea must not be in this list. */
  peers: readonly IdeaPeer[];
  /** false when the stored Ideas could not be loaded, so the distinct check cannot be completed. */
  historyAvailable: boolean;
  /** Checks that passed on this card before a revision; they stay passed. */
  keptPasses?: readonly IdeaCriterion[];
  /** Checks switched OFF for this organization. */
  skip?: readonly string[];
  ask: (prompt: string) => Promise<string | null>;
  onStep?: (steps: IdeaCheckStep[]) => void;
};

const UNDECIDED = "This check could not be decided.";
const SWITCHED_OFF = "Dimatikan untuk organisasi ini.";

function keyLines(keys: readonly IdeaMechanismKey[] | undefined): string[] {
  const rows = (keys ?? []).filter((key) => key.otherExplanation.trim() && key.close.trim());
  if (rows.length === 0) return ["Kunci: (belum ditulis)"];
  return ["Kunci:", ...rows.map((key) => `- ${key.otherExplanation.trim()} / ${key.close.trim()}`)];
}

function peerLines(peers: readonly IdeaPeer[]): string[] {
  if (peers.length === 0) return ["Idea lain yang sudah lolos: (none)"];
  return [
    "Idea lain yang sudah lolos. Sebut kodenya jika gagal:",
    ...peers.map((peer) => `${peer.code}: ${peer.statement}${peer.mechanism ? `\nMekanisme: ${peer.mechanism}` : ""}`),
  ];
}

/** The lines one check needs besides the Idea, the chain, and its rule. */
function extraFor(id: IdeaCheckId, input: IdeaCheckInput): string[] {
  if (id === "causeLock") return [`Subjek Master Thought: ${input.masterSubject?.trim()}`, ...keyLines(input.mechanismKeys)];
  if (id === "watchable") {
    return [
      `Audiens: ${input.audience?.trim() || "(not stored)"}`,
      `Keyakinan lama: ${input.priorBelief?.trim() || "(not stored)"}`,
      `Keyakinan dasar: ${input.rootBelief?.trim() || "(not stored)"}`,
    ];
  }
  if (id === "distinct") return peerLines(input.peers);
  return [];
}

function chainLines(input: IdeaCheckInput): string[] {
  return [
    `Idea: ${input.statement.trim()}`,
    ...(input.mechanism?.trim() ? [`Mekanisme: ${input.mechanism.trim()}`] : []),
    `Angle: ${input.angle.trim() || "(missing)"}`,
    `Territory: ${input.territory.trim() || "(missing)"}`,
    `Big Thought: ${input.bigThought.trim() || "(missing)"}`,
    `Master Thought: ${input.masterThought.trim() || "(missing)"}`,
  ];
}

export function buildIdeaCheckPrompt(id: IdeaCheckId, input: IdeaCheckInput): string {
  return [
    `Decide the Idea check ${id}. Do not rewrite the Idea.`,
    ...IDEA_CHECK_RULES[id],
    ...extraFor(id, input),
    "When pass is false, reason is one sentence in the same language as the Angle.",
    "When you cannot decide, do not return pass true.",
    'Return JSON only: {"pass":true,"reason":""} or {"pass":false,"reason":"..."}',
    "",
    ...chainLines(input),
  ].join("\n");
}

function buildIdeaChecksBatchPrompt(ids: readonly IdeaCheckId[], input: IdeaCheckInput): string {
  return buildBatchGatePrompt({
    item: "Idea",
    language: "Angle",
    gates: ids.map((id) => ({ id, rules: [...IDEA_CHECK_RULES[id]], extra: extraFor(id, input) })),
    context: chainLines(input),
  });
}

function parseIdeaCheckAnswer(script: string | null): GateAnswer {
  const parsed = script?.trim() ? parseModelJson(script) : null;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { pass: false, reason: UNDECIDED };
  const row = parsed as { pass?: unknown; reason?: unknown };
  const reason = typeof row.reason === "string" ? row.reason.trim() : "";
  if (row.pass === true) return { pass: true, reason: "" };
  if (row.pass === false) return { pass: false, reason: reason || UNDECIDED };
  return { pass: false, reason: UNDECIDED };
}

/** A check decided in code: a criterion, or null when the model has to decide it. */
function decidedInCode(id: IdeaCheckId, input: IdeaCheckInput): IdeaCriterion | null {
  if (id === "proposal" && !hasHowIfOpening(input.statement, input.angle)) {
    return blankCriterion(id, "FAIL", notProposalReason(input.angle));
  }
  if (id === "result" && ideaAnnouncesConclusion(input.statement)) {
    return blankCriterion(id, "FAIL", announcedConclusionReason(input.statement));
  }
  if (id === "causeLock" && !input.masterSubject?.trim()) {
    return blankCriterion(
      id,
      "FAIL",
      inAngleLanguage(input.angle, "Subjek Master Thought belum ditulis.", "The Master Thought subject was not named."),
    );
  }
  if (id === "distinct" && !input.historyAvailable) {
    return blankCriterion(
      id,
      "BELUM_TERVERIFIKASI",
      inAngleLanguage(input.angle, "Idea yang tersimpan tidak terbaca, jadi perbandingannya belum lengkap.", "The stored Ideas could not be loaded, so the comparison is not complete."),
    );
  }
  if (id === "distinct" && input.peers.length === 0) {
    return blankCriterion(id, "PASS", inAngleLanguage(input.angle, "Belum ada Idea lain yang lolos untuk dibandingkan.", "No other Idea has passed yet."));
  }
  return null;
}

/** A model failure that does not meet the check's own rule does not count. */
function failCounts(id: IdeaCheckId, reason: string, input: IdeaCheckInput): boolean {
  if (id === "proposal") return proposalFailCounts(reason);
  if (id === "result") return resultFailCounts(reason);
  if (id === "watchable") return watchableFailCounts(reason);
  if (id === "distinct") return distinctFailCounts(reason, input.peers, { statement: input.statement, mechanism: input.mechanism });
  return true;
}

function storedFailure(input: IdeaCheckInput, open: ReadonlySet<IdeaCheckId>): IdeaCriterion | null {
  const prior = input.failures.find((item) => sameStatement(item.statement, input.statement));
  const failed = prior?.failed.find((row) => open.has(row.id));
  return failed ? blankCriterion(failed.id, "FAIL", failed.reason) : null;
}

export async function runIdeaChecks(input: IdeaCheckInput): Promise<IdeaValidation> {
  const validatedAt = new Date().toISOString();
  const skip = new Set(input.skip ?? []);
  const kept = new Set((input.keptPasses ?? []).filter((row) => row.status === "PASS").map((row) => row.id));
  const criteria: IdeaCriterion[] = [];
  const steps: IdeaCheckStep[] = IDEA_CHECK_IDS.map((id) => ({ id, state: "pending" }));
  const publish = () => input.onStep?.(steps.map((step) => ({ ...step })));
  const settle = (criterion: IdeaCriterion) => {
    criteria.push(criterion);
    const index = IDEA_CHECK_IDS.indexOf(criterion.id);
    steps[index] = {
      id: criterion.id,
      state: criterion.status === "PASS" ? "pass" : "fail",
      ...(criterion.reason && criterion.status !== "PASS" ? { reason: criterion.reason } : {}),
    };
    publish();
  };
  const seal = () =>
    sealValidation(
      { criteria, statement: input.statement, title: input.title, concept: input.concept, mechanism: input.mechanism, value: input.value },
      validatedAt,
    );
  publish();

  const open = new Set(IDEA_CHECK_IDS.filter((id) => !skip.has(id) && !kept.has(id)));
  const repeated = storedFailure(input, open);
  // The run stops at the first check that fails without a model call, so nothing after it is asked.
  const stop = IDEA_CHECK_IDS.findIndex(
    (id) => open.has(id) && (repeated?.id === id || (decidedInCode(id, input)?.status ?? "PASS") !== "PASS"),
  );
  const byModel = IDEA_CHECK_IDS.filter(
    (id, index) => open.has(id) && (stop < 0 || index < stop) && !decidedInCode(id, input),
  );
  const batched =
    byModel.length > 1
      ? ((await askBatchGates({ prompt: buildIdeaChecksBatchPrompt(byModel, input), ids: byModel, ask: input.ask })) ?? new Map<string, GateAnswer>())
      : new Map<string, GateAnswer>();

  for (const id of IDEA_CHECK_IDS) {
    if (skip.has(id)) {
      settle(blankCriterion(id, "PASS", SWITCHED_OFF));
      continue;
    }
    if (kept.has(id)) {
      settle(input.keptPasses?.find((row) => row.id === id) ?? blankCriterion(id, "PASS"));
      continue;
    }
    steps[IDEA_CHECK_IDS.indexOf(id)] = { id, state: "running" };
    publish();
    if (repeated?.id === id) {
      settle(repeated);
      return seal();
    }
    const coded = decidedInCode(id, input);
    if (coded) {
      settle(coded);
      if (coded.status !== "PASS") return seal();
      continue;
    }
    let answer = batched.get(id);
    if (!answer || isUndecided(answer)) answer = parseIdeaCheckAnswer(await input.ask(buildIdeaCheckPrompt(id, input)));
    if (isUndecided(answer)) answer = parseIdeaCheckAnswer(await input.ask(buildIdeaCheckPrompt(id, input)));
    if (isUndecided(answer)) {
      settle(blankCriterion(id, "BELUM_TERVERIFIKASI", UNDECIDED));
      return seal();
    }
    if (!answer.pass && failCounts(id, answer.reason, input)) {
      settle(blankCriterion(id, "FAIL", answer.reason));
      return seal();
    }
    settle(blankCriterion(id, "PASS"));
  }
  return seal();
}

// Runs the seven Idea checks on one sentence, in order, and stops at the first one that does not pass.
// A check switched OFF for the organization passes without a model call.
// Relative imports only: the MCP server loads this file.
import { SWITCHED_OFF_REASON, UNDECIDED_REASON, buildBatchGatePrompt, isUndecided, type GateAnswer } from "../../shared/batchGates";
import { runGateChain } from "../../shared/gateChain";
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

const UNDECIDED = UNDECIDED_REASON;
const SWITCHED_OFF = SWITCHED_OFF_REASON;

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
  const keptRows = (input.keptPasses ?? []).filter((row) => row.status === "PASS");
  const kept = new Set(keptRows.map((row) => row.id));
  const open = new Set(IDEA_CHECK_IDS.filter((id) => !skip.has(id) && !kept.has(id)));
  const repeated = storedFailure(input, open);
  // A check decided in code as "not verified" stops the run like a fail, but is stored as BELUM_TERVERIFIKASI.
  const unverified = new Map<IdeaCheckId, string>();
  const decided = (id: IdeaCheckId): GateAnswer | null => {
    if (repeated?.id === id) return { pass: false, reason: repeated.reason };
    const coded = decidedInCode(id, input);
    if (!coded) return null;
    if (coded.status === "BELUM_TERVERIFIKASI") unverified.set(id, coded.reason);
    return { pass: coded.status === "PASS", reason: coded.reason };
  };
  const run = await runGateChain({
    ids: IDEA_CHECK_IDS,
    skip: input.skip,
    keep: [...kept],
    decided,
    batchPrompt: (ids) => buildIdeaChecksBatchPrompt(ids, input),
    prompt: (id) => buildIdeaCheckPrompt(id, input),
    settle: (id, answer) =>
      answer.pass || isUndecided(answer) || failCounts(id, answer.reason, input) ? answer : { pass: true, reason: "" },
    ask: input.ask,
    onStep: (steps) =>
      input.onStep?.(
        steps.map((step) => (step.state === "pass" ? { id: step.id, state: step.state } : { ...step })),
      ),
  });
  const criteria: IdeaCriterion[] = run.checks.flatMap((step): IdeaCriterion[] => {
    if (step.state === "pass") {
      if (skip.has(step.id)) return [blankCriterion(step.id, "PASS", SWITCHED_OFF)];
      if (kept.has(step.id)) return [keptRows.find((row) => row.id === step.id) ?? blankCriterion(step.id, "PASS")];
      const coded = repeated?.id === step.id ? null : decidedInCode(step.id, input);
      return [coded ?? blankCriterion(step.id, "PASS")];
    }
    if (step.state !== "fail") return [];
    if (repeated?.id === step.id) return [repeated];
    const reason = step.reason ?? UNDECIDED;
    const notVerified = unverified.has(step.id) || reason === UNDECIDED;
    return [blankCriterion(step.id, notVerified ? "BELUM_TERVERIFIKASI" : "FAIL", notVerified ? unverified.get(step.id) ?? UNDECIDED : reason)];
  });
  return sealValidation(
    { criteria, statement: input.statement, title: input.title, concept: input.concept, mechanism: input.mechanism, value: input.value },
    validatedAt,
  );
}

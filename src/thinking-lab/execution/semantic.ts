import { parseModelJson } from "@/thinking-lab/shared/ai";
import { ancestorStakeBlock, type AncestorStake } from "@/thinking-lab/shared/ancestorStake";
import { EXECUTION_PASS_CHECK_IDS } from "@/thinking-lab/execution/passChecklist";
import { IMAGE_EXTRA_CHECK_IDS } from "@/thinking-lab/execution/imageChecklist";
import { pillarNeedsRecommendation } from "@/thinking-lab/execution/recommend";
import {
  executionPillarLabel,
  isFailedMeaningAudit,
  type ExecutionAuditLesson,
  type ExecutionMeaningAudit,
  type ExecutionPassCheckId,
  type ExecutionRelation,
  type ExecutionSemanticFacts,
  type ExecutionStoredPassCheck,
  type ExecutionTriState,
  type PillarRecommendation,
} from "@/thinking-lab/execution/types";

const CLIMBS = ["CLIMBS", "OTHER", "NEGATIVE", "UNRESOLVED"] as const;
const MATCHES = ["MATCH", "OTHER", "UNRESOLVED"] as const;

type CanonicalInput = Pick<
  ExecutionSemanticFacts,
  "pillar" | "messageAdded" | "mechanismVisible" | "pillarOutside" | "masterSells" | "viewerClimb" | "subjectMatch"
>;

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asReasons(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((row) => asText(row)).filter(Boolean);
}

function tokensOf(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [value];
}

function readTriState(value: unknown): { value: ExecutionTriState; contradictory: boolean } {
  if (value == null || value === "") return { value: "unresolved", contradictory: false };
  const tokens = tokensOf(value);
  const recognized = tokens.flatMap((token): ExecutionTriState[] => {
    if (token === true || token === false) return [token];
    if (typeof token !== "string") return [];
    const normalized = token.trim().toLowerCase();
    if (normalized === "true") return [true];
    if (normalized === "false") return [false];
    if (normalized === "unresolved") return ["unresolved"];
    return [];
  });
  const unique = [...new Set(recognized)];
  if (unique.length > 1) return { value: "unresolved", contradictory: true };
  return { value: unique[0] ?? "unresolved", contradictory: false };
}

function readPillar(value: unknown): { value: string; contradictory: boolean } {
  if (value == null || value === "") return { value: "UNRESOLVED", contradictory: false };
  const tokens = tokensOf(value).map((token) => (typeof token === "string" ? token.trim() : ""));
  const recognized = tokens.filter((token) => token.length > 0);
  const unique = [...new Set(recognized)];
  if (unique.length > 1) return { value: "UNRESOLVED", contradictory: true };
  const pillar = unique[0] ?? "UNRESOLVED";
  if (pillar.toUpperCase() === "UNRESOLVED") return { value: "UNRESOLVED", contradictory: false };
  return { value: pillar, contradictory: false };
}

function pillarReady(pillar: string): boolean {
  return pillar.trim() !== "" && pillar !== "UNRESOLVED";
}

function readToken<T extends string>(value: unknown, allowed: readonly T[]): { value: T; contradictory: boolean } {
  const fallback = allowed[allowed.length - 1] as T;
  if (value == null || value === "") return { value: fallback, contradictory: false };
  const tokens = tokensOf(value).map((token) => (typeof token === "string" ? token.trim() : ""));
  const recognized = tokens.filter((token): token is T => allowed.some((item) => item === token));
  const unique = [...new Set(recognized)];
  if (unique.length > 1) return { value: fallback, contradictory: true };
  return { value: unique[0] ?? fallback, contradictory: false };
}

function unresolvedExecution(reason: string, pillar = "UNRESOLVED"): ExecutionSemanticFacts {
  return {
    pillar,
    whatItSays: "",
    relationToParent: "UNRESOLVED",
    messageAdded: "unresolved",
    mechanismVisible: "unresolved",
    pillarOutside: "unresolved",
    masterSells: "unresolved",
    viewerClimb: "UNRESOLVED",
    subjectMatch: "UNRESOLVED",
    resolution: "UNRESOLVED",
    unresolvedReasons: [reason],
  };
}

export function deriveExecutionRelation(facts: CanonicalInput): ExecutionRelation {
  if (!pillarReady(facts.pillar)) return "UNRESOLVED";
  if (facts.pillarOutside === true) return "PILLAR_OUTSIDE";
  if (facts.messageAdded === true) return "MESSAGE_ADDED";
  if (facts.mechanismVisible === false) return "MECHANISM_HIDDEN";
  if (facts.messageAdded !== false) return "UNRESOLVED";
  if (facts.mechanismVisible !== true) return "UNRESOLVED";
  if (facts.pillarOutside !== false) return "UNRESOLVED";
  if (facts.viewerClimb === "OTHER" || facts.viewerClimb === "NEGATIVE") return "CLIMB_MISSED";
  if (facts.viewerClimb !== "CLIMBS") return "UNRESOLVED";
  return "VALID_EXECUTION";
}

function unresolvedFactReasons(facts: CanonicalInput): string[] {
  const reasons: string[] = [];
  if (!pillarReady(facts.pillar)) reasons.push("PILLAR_UNRESOLVED");
  if (facts.messageAdded === "unresolved") reasons.push("MESSAGE_ADDED_UNRESOLVED");
  if (facts.mechanismVisible === "unresolved") reasons.push("MECHANISM_VISIBLE_UNRESOLVED");
  if (facts.pillarOutside === "unresolved") reasons.push("PILLAR_OUTSIDE_UNRESOLVED");
  if (facts.viewerClimb === "UNRESOLVED") reasons.push("VIEWER_CLIMB_UNRESOLVED");
  return reasons;
}

export function normalizeExecutionFacts(raw: unknown, fallbackPillar = "UNRESOLVED"): ExecutionSemanticFacts {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return unresolvedExecution("JUDGE_UNPARSEABLE", fallbackPillar);
  const row = raw as Record<string, unknown>;
  const pillar = readPillar(row.pillar ?? fallbackPillar);
  const messageAdded = readTriState(row.messageAdded);
  const mechanismVisible = readTriState(row.mechanismVisible);
  const pillarOutside = readTriState(row.pillarOutside);
  const masterSells = readTriState(row.masterSells);
  const viewerClimb = readToken(row.viewerClimb, CLIMBS);
  const subjectMatch = readToken(row.subjectMatch, MATCHES);
  const contradictory =
    pillar.contradictory ||
    messageAdded.contradictory ||
    mechanismVisible.contradictory ||
    pillarOutside.contradictory ||
    masterSells.contradictory ||
    viewerClimb.contradictory ||
    subjectMatch.contradictory;
  const canonical: CanonicalInput = {
    pillar: pillar.value,
    messageAdded: messageAdded.value,
    mechanismVisible: mechanismVisible.value,
    pillarOutside: pillarOutside.value,
    masterSells: masterSells.value,
    viewerClimb: viewerClimb.value,
    subjectMatch: subjectMatch.value,
  };
  const meaningAudit = readMeaningAudit(row.meaningAudit);
  const auditLessons = readAuditLessons(row.auditLessons);
  const passChecks = readPassChecks(row.passChecks);
  const storedRelation = readRelation(row.relationToParent);
  const relationToParent = meaningAudit
    ? (storedRelation ?? (isFailedMeaningAudit(meaningAudit) ? "UNRESOLVED" : "VALID_EXECUTION"))
    : storedRelation === "PILLAR_NOT_SELLING" || storedRelation === "SUBJECT_MISMATCH"
      ? storedRelation
      : contradictory
        ? "UNRESOLVED"
        : deriveExecutionRelation(canonical);
  return {
    ...canonical,
    whatItSays: asText(row.whatItSays),
    relationToParent,
    resolution: relationToParent === "UNRESOLVED" ? "UNRESOLVED" : "RESOLVED",
    unresolvedReasons:
      meaningAudit || relationToParent !== "UNRESOLVED"
        ? relationToParent === "UNRESOLVED"
          ? asReasons(row.unresolvedReasons)
          : []
        : contradictory
          ? ["CONTRADICTORY_CANONICAL_FACTS"]
          : [...new Set([...asReasons(row.unresolvedReasons), ...unresolvedFactReasons(canonical)])],
    ...readStoredRecommendation(row.recommendation, relationToParent),
    ...(meaningAudit ? { meaningAudit } : {}),
    ...(auditLessons.length > 0 ? { auditLessons } : {}),
    ...(passChecks ? { passChecks } : {}),
  };
}

const RELATIONS: readonly ExecutionRelation[] = [
  "VALID_EXECUTION",
  "MESSAGE_ADDED",
  "MECHANISM_HIDDEN",
  "PILLAR_OUTSIDE",
  "PILLAR_NOT_SELLING",
  "CLIMB_MISSED",
  "SUBJECT_MISMATCH",
  "CAUSE_BROKEN",
  "PERSON_MISSED",
  "HOOK_MISSED",
  "SPEECH_STIFF",
  "SLANG_MISSED",
  "FORMAT_MISSED",
  "UNRESOLVED",
];

function knownPassCheckId(id: string): id is ExecutionPassCheckId {
  return (
    id === "imageCopy" ||
    EXECUTION_PASS_CHECK_IDS.some((check) => check === id) ||
    IMAGE_EXTRA_CHECK_IDS.some((check) => check === id)
  );
}

function readRelation(value: unknown): ExecutionRelation | null {
  return RELATIONS.find((relation) => relation === value) ?? null;
}

function readMeaningAudit(value: unknown): ExecutionMeaningAudit | null {
  const row = asRecord(value);
  if (!row) return null;
  if (row.cleared === true) return { cleared: true };
  const id = asText(row.id);
  if (id === "conclusionLands") return { cleared: true };
  if (!knownPassCheckId(id)) return null;
  const reason = asText(row.reason);
  if (!reason) return null;
  const lineIds = Array.isArray(row.lineIds) ? row.lineIds.map((item) => asText(item)).filter(Boolean) : [];
  return { id: id as ExecutionPassCheckId, reason, lineIds };
}

function readPassChecks(value: unknown): ExecutionStoredPassCheck[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const checks = value.flatMap((item) => {
    const row = asRecord(item);
    if (!row) return [];
    const id = asText(row.id);
    if (!knownPassCheckId(id)) return [];
    const state = row.state === "pass" || row.state === "fail" || row.state === "pending" ? row.state : "pending";
    const enabled = row.enabled !== false;
    const reason = asText(row.reason);
    const lineIds = Array.isArray(row.lineIds) ? row.lineIds.map((line) => asText(line)).filter(Boolean) : [];
    return [
      {
        id,
        enabled,
        state: enabled ? state : "pass",
        ...(enabled && state === "fail" && reason ? { reason, ...(lineIds.length > 0 ? { lineIds } : {}) } : {}),
      },
    ];
  });
  return checks.length > 0 ? checks : undefined;
}

function readAuditLessons(value: unknown): ExecutionAuditLesson[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const row = asRecord(item);
    if (!row) return [];
    const checkId = asText(row.checkId);
    const reason = asText(row.reason);
    if (checkId === "imageCopy" || !knownPassCheckId(checkId) || !reason) return [];
    const lines = Array.isArray(row.lines) ? row.lines.map((line) => asText(line)).filter(Boolean) : [];
    return [{ checkId: checkId as ExecutionPassCheckId, reason, lines }];
  });
}

function readStoredRecommendation(
  value: unknown,
  relation: ExecutionRelation,
): { recommendation: PillarRecommendation } | Record<string, never> {
  if (!pillarNeedsRecommendation(relation)) return {};
  const row = asRecord(value);
  const choices = Array.isArray(row?.choices)
    ? row.choices.flatMap((item) => {
        const choice = asRecord(item);
        const pillarName = asText(choice?.pillarName ?? choice?.pillar).slice(0, 120);
        const reason = asText(choice?.reason).slice(0, 500);
        return pillarName && reason ? [{ pillarName, reason }] : [];
      })
    : [];
  const pillarName = asText(row?.pillarName ?? row?.pillar).slice(0, 120) || choices[0]?.pillarName || "";
  const reason = asText(row?.reason).slice(0, 500) || choices[0]?.reason || "";
  if (!pillarName || !reason) return {};
  return { recommendation: { pillarName, reason, ...(choices.length > 0 ? { choices } : {}) } };
}

export function parseExecutionJudge(script: string | null, pillar: string, _subjectSealed = true): ExecutionSemanticFacts {
  if (!script?.trim()) return unresolvedExecution("JUDGE_UNAVAILABLE", pillar);
  const parsed = parseModelJson(script);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return unresolvedExecution("JUDGE_UNPARSEABLE", pillar);
  const row = parsed as Record<string, unknown>;
  return normalizeExecutionFacts({ ...row, pillar }, pillar);
}

export function buildExecutionJudgePrompt(input: {
  masterStatement: string;
  masterSubject?: string;
  ideaStatement: string;
  pillar: string;
  ancestors?: AncestorStake[];
  candidate: string;
}): string {
  const pillarLabel = executionPillarLabel(input.pillar);
  return [
    "You are the canonical semantic judge for one Execution.",
    "One piece of content is one Idea plus one pillar. The pillar is a format menu, not a new meaning level.",
    "The content must not add a claim the Idea does not already carry.",
    "The pillar's image, label, and way of speaking are not a new claim.",
    "The Idea's mechanism must be visible to the audience.",
    "A viewer who sees only this content must climb from the Idea's mechanism to the Master Thought.",
    "The content does not have to say a brand name. A brand name is spoken only when the video settings ask for it.",
    "Reject a pillar that forces a message outside the Idea.",
    "Do not decide relationToParent. Any relation you include is ignored.",
    "messageAdded is true when the content adds a new claim. false when the message stays the Idea's message. unresolved when that cannot be decided.",
    "mechanismVisible is true when a viewer can see the Idea's mechanism. false when the format hides it. unresolved when that cannot be decided.",
    "pillarOutside is true when this pillar forces a message the Idea does not contain. false when the pillar only realizes the Idea. unresolved when that cannot be decided.",
    "masterSells is true when the Master Thought is selling something. false when it is not. unresolved when that cannot be decided.",
    "viewerClimb is CLIMBS when that viewer reaches the Idea's mechanism and then this Master Thought. OTHER when they reach a different conclusion. NEGATIVE when they reach an unwanted negative conclusion. UNRESOLVED when that cannot be decided.",
    "whatItSays is the explanation of this decision, in the same language as the Idea.",
    "When a check fails, name the specific message, missing mechanism, or wrong conclusion in this script, and say how it parts from the Idea.",
    "Use one or two sentences. Do not answer with only the verdict.",
    "Do not use examples from any specific industry, belief system, or brand.",
    "Return JSON only:",
    JSON.stringify({
      pillar: input.pillar,
      whatItSays: "",
      messageAdded: "unresolved",
      mechanismVisible: "unresolved",
      pillarOutside: "unresolved",
      masterSells: "unresolved",
      viewerClimb: "UNRESOLVED",
      unresolvedReasons: [],
    }),
    "",
    "Master Thought:",
    input.masterStatement.trim(),
    ...ancestorStakeBlock(input.ancestors),
    "",
    "Idea:",
    input.ideaStatement.trim(),
    "",
    "Pillar:",
    `${input.pillar}: ${pillarLabel}`,
    "",
    "Candidate content:",
    input.candidate.trim(),
  ].join("\n");
}

export async function judgeExecution(
  input: {
    masterStatement: string;
    masterSubject?: string;
    ideaStatement: string;
    pillar: string;
    ancestors?: AncestorStake[];
    candidate: string;
  },
  ask: (prompt: string) => Promise<string | null>,
): Promise<ExecutionSemanticFacts> {
  const script = await ask(buildExecutionJudgePrompt(input));
  return parseExecutionJudge(script, input.pillar, Boolean(input.masterSubject?.trim()));
}

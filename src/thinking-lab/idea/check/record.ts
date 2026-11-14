// The result of the Idea checks, as stored on each Idea row (thinking_lab_ideas.validation).
// Relative imports only: the MCP server loads this file.
import type { IndividualAdmission } from "../../shared/verdict";
import { hasHowIfOpening, inAngleLanguage } from "./guards";
import { IDEA_CHECK_IDS, LEGACY_IDEA_CRITERIA, isIdeaCheckId, type IdeaCheckId } from "./ids";

export type IdeaCheckStatus = "PASS" | "FAIL" | "BELUM_TERVERIFIKASI";
export type IdeaValidationDecision = "LOLOS" | "DITOLAK" | "BELUM_TERVERIFIKASI";

const IDEA_VALIDATION_SCHEMA = "thinking-lab/idea-validation/v1";
const IDEA_CHECKS_VERSION = "idea-checks/v2";
const LEGACY_K_VERSION = "idea-k1k7/v1";
const LEGACY_PASS = "Lolos dengan aturan lama (K1–K7).";

/** One check's outcome. reason is one sentence; it is empty for a pass the model did not explain. */
export type IdeaCriterion = {
  id: IdeaCheckId;
  status: IdeaCheckStatus;
  reason: string;
};

type IdeaAuditSnapshot = {
  statement: string;
  criteria: IdeaCriterion[];
  decision: IdeaValidationDecision;
  validatedAt: string;
};

export type IdeaValidation = {
  schema: typeof IDEA_VALIDATION_SCHEMA;
  generatorVersion: typeof IDEA_CHECKS_VERSION;
  criteria: IdeaCriterion[];
  decision: IdeaValidationDecision;
  decisionReason: string;
  title: string;
  concept: string;
  mechanism: string;
  value: string;
  statement: string;
  validatedAt: string;
  /** Earlier results of this card, newest first. Their count is how many times the card was revised. */
  auditHistory: IdeaAuditSnapshot[];
};

export function admissionForDecision(decision: IdeaValidationDecision): IndividualAdmission {
  if (decision === "LOLOS") return "GENERATE_VALID";
  if (decision === "DITOLAK") return "GENERATE_REJECT";
  return "UNRESOLVED";
}

function decideCriteria(criteria: readonly IdeaCriterion[]): IdeaValidationDecision {
  if (criteria.some((criterion) => criterion.status === "FAIL")) return "DITOLAK";
  if (criteria.some((criterion) => criterion.status === "BELUM_TERVERIFIKASI")) return "BELUM_TERVERIFIKASI";
  return "LOLOS";
}

function decisionReason(criteria: readonly IdeaCriterion[], decision: IdeaValidationDecision): string {
  if (decision === "LOLOS") return "";
  const open = criteria.filter((criterion) => criterion.status === (decision === "DITOLAK" ? "FAIL" : "BELUM_TERVERIFIKASI"));
  return open.map((criterion) => (criterion.reason ? `${criterion.id}: ${criterion.reason}` : criterion.id)).join("\n");
}

export function blankCriterion(id: IdeaCheckId, status: IdeaCheckStatus = "BELUM_TERVERIFIKASI", reason = ""): IdeaCriterion {
  return { id, status, reason };
}

/** Every check in order; a check that did not run stays BELUM_TERVERIFIKASI. */
export function sealValidation(
  input: {
    criteria: readonly IdeaCriterion[];
    statement: string;
    title?: string;
    concept?: string;
    mechanism?: string;
    value?: string;
    auditHistory?: IdeaAuditSnapshot[];
    decision?: IdeaValidationDecision;
  },
  validatedAt: string,
): IdeaValidation {
  const criteria = IDEA_CHECK_IDS.map((id) => input.criteria.find((criterion) => criterion.id === id) ?? blankCriterion(id));
  const decision = input.decision ?? decideCriteria(criteria);
  return {
    schema: IDEA_VALIDATION_SCHEMA,
    generatorVersion: IDEA_CHECKS_VERSION,
    criteria,
    decision,
    decisionReason: decisionReason(criteria, decision),
    title: input.title?.trim() ?? "",
    concept: input.concept?.trim() ?? "",
    mechanism: input.mechanism?.trim() ?? "",
    value: input.value?.trim() ?? "",
    statement: input.statement.trim(),
    validatedAt,
    auditHistory: input.auditHistory ?? [],
  };
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readStatus(value: unknown): IdeaCheckStatus | null {
  if (typeof value !== "string") return null;
  const token = value.trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (token === "PASS") return "PASS";
  if (token === "FAIL") return "FAIL";
  if (token === "BELUM_TERVERIFIKASI" || token === "UNVERIFIED") return "BELUM_TERVERIFIKASI";
  return null;
}

function readDecision(value: unknown): IdeaValidationDecision | null {
  return value === "LOLOS" || value === "DITOLAK" || value === "BELUM_TERVERIFIKASI" ? value : null;
}

/** The one sentence of a stored K1-K7 reason, which was written as STATUS / BUKTI / PENJELASAN / KELEMAHAN. */
function legacySentence(row: Record<string, unknown>): string {
  const explanation = text(row.explanation);
  if (explanation) return explanation;
  const reason = text(row.reason);
  const match = reason.match(/PENJELASAN:\s*([\s\S]*?)(?:\nKELEMAHAN:|$)/);
  if (match?.[1]?.trim()) return match[1].trim();
  return reason.startsWith("STATUS:") ? "" : reason;
}

const STATUS_WEIGHT: Record<IdeaCheckStatus, number> = { PASS: 0, BELUM_TERVERIFIKASI: 1, FAIL: 2 };

/** Reads both shapes: the seven checks, and the K1-K7 results stored before them. */
function readCriteria(value: unknown, legacy: boolean, decision: IdeaValidationDecision | null): IdeaCriterion[] {
  const found = new Map<IdeaCheckId, IdeaCriterion>();
  for (const item of Array.isArray(value) ? value : []) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    const rawId = text(row.id);
    const id = legacy ? LEGACY_IDEA_CRITERIA[rawId.toUpperCase()] : isIdeaCheckId(rawId) ? rawId : undefined;
    const status = readStatus(row.status);
    if (!id || !status) continue;
    const reason = legacy ? legacySentence(row) : text(row.reason);
    const previous = found.get(id);
    if (!previous || STATUS_WEIGHT[status] > STATUS_WEIGHT[previous.status]) found.set(id, { id, status, reason });
  }
  return IDEA_CHECK_IDS.map((id) => {
    const criterion = found.get(id);
    if (legacy && decision === "LOLOS") return { id, status: "PASS", reason: criterion?.reason || LEGACY_PASS };
    return criterion ?? blankCriterion(id);
  });
}

function readAuditHistory(value: unknown, legacy: boolean): IdeaAuditSnapshot[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const row = item as Record<string, unknown>;
    const stored = readDecision(row.decision);
    const criteria = readCriteria(row.criteria, legacy, stored);
    return [{ statement: text(row.statement), criteria, decision: stored ?? decideCriteria(criteria), validatedAt: text(row.validatedAt) }];
  });
}

/** A stored result, or null when the row holds none. A K1-K7 result keeps its decision. */
export function readIdeaValidation(raw: unknown): IdeaValidation | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  if (row.schema !== IDEA_VALIDATION_SCHEMA) return null;
  const legacy = row.generatorVersion === LEGACY_K_VERSION;
  if (!legacy && row.generatorVersion !== IDEA_CHECKS_VERSION) return null;
  const stored = readDecision(row.decision);
  return sealValidation(
    {
      criteria: readCriteria(row.criteria, legacy, stored),
      statement: text(row.statement),
      title: text(row.title),
      concept: text(row.concept),
      mechanism: text(row.mechanism),
      value: text(row.value),
      auditHistory: readAuditHistory(row.auditHistory, legacy),
      ...(legacy && stored ? { decision: stored } : {}),
    },
    text(row.validatedAt) || new Date(0).toISOString(),
  );
}

/** An Idea saved before any check ran: only its sentence form can be read from the sentence. */
export function uncheckedIdeaValidation(statement: string, angleStatement: string): IdeaValidation {
  const formed = hasHowIfOpening(statement, angleStatement);
  return sealValidation(
    {
      criteria: formed ? [] : [blankCriterion("proposal", "FAIL", notProposalReason(angleStatement))],
      statement,
    },
    new Date().toISOString(),
  );
}

export function notProposalReason(angleStatement: string): string {
  return inAngleLanguage(
    angleStatement,
    "Kalimatnya belum berbentuk \"Kita … sehingga …\".",
    "The sentence is not written as \"We … so that …\".",
  );
}

/** Each check as the card's checklist shows it. */
export function checksFromValidation(validation: IdeaValidation): Array<{ id: IdeaCheckId; state: "pass" | "fail" | "pending"; reason?: string }> {
  return validation.criteria.map((criterion) => ({
    id: criterion.id,
    state: criterion.status === "PASS" ? "pass" : criterion.status === "FAIL" || criterion.reason ? "fail" : "pending",
    ...(criterion.reason && criterion.status !== "PASS" ? { reason: criterion.reason } : {}),
  }));
}

/** Keeps the previous result and links the new one. The latest decision stays on the Idea row. */
export function withAuditHistory(previous: IdeaValidation | null, next: IdeaValidation): IdeaValidation {
  if (!previous) return next;
  const snapshot: IdeaAuditSnapshot = {
    statement: previous.statement,
    criteria: previous.criteria.map((criterion) => ({ ...criterion })),
    decision: previous.decision,
    validatedAt: previous.validatedAt,
  };
  const older = previous.auditHistory.filter((item) => item.validatedAt !== snapshot.validatedAt);
  return { ...next, auditHistory: [snapshot, ...older] };
}

export function ideaHistorySummary(validations: readonly IdeaValidation[]): {
  passed: number;
  rejected: number;
  unverified: number;
  topFailed: IdeaCheckId | null;
} {
  const counts = new Map<IdeaCheckId, number>();
  let passed = 0;
  let rejected = 0;
  let unverified = 0;
  for (const validation of validations) {
    if (validation.decision === "LOLOS") passed += 1;
    else if (validation.decision === "DITOLAK") rejected += 1;
    else unverified += 1;
    for (const criterion of validation.criteria) {
      if (criterion.status === "FAIL") counts.set(criterion.id, (counts.get(criterion.id) ?? 0) + 1);
    }
  }
  let topFailed: IdeaCheckId | null = null;
  let best = 0;
  for (const id of IDEA_CHECK_IDS) {
    const count = counts.get(id) ?? 0;
    if (count > best) {
      best = count;
      topFailed = id;
    }
  }
  return { passed, rejected, unverified, topFailed };
}

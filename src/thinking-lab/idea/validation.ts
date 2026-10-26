import { parseModelJson } from "@/thinking-lab/shared/ai";
import type { IndividualAdmission } from "@/thinking-lab/shared/verdict";

export const IDEA_CRITERIA = ["K1", "K2", "K3", "K4", "K5", "K6", "K7"] as const;
export type IdeaCriterionId = (typeof IDEA_CRITERIA)[number];
export type IdeaCriterionStatus = "PASS" | "FAIL" | "BELUM_TERVERIFIKASI";
export type IdeaValidationDecision = "LOLOS" | "DITOLAK" | "BELUM_TERVERIFIKASI";

export const IDEA_VALIDATION_SCHEMA = "thinking-lab/idea-validation/v1";
export const IDEA_GENERATOR_VERSION = "idea-k1k7/v1";
export const IDEA_VALIDATOR_VERSION = "idea-audit/v2";
export const IDEA_REVISION_CAP = 3;

export const IDEA_K2_RULE =
  "PASS only when the mechanism is a specific action people already do in ordinary life. The how-if may change how that action is used. FAIL when the mechanism only works by creating a product, an automatic analysis, or a capability that is not part of ordinary life. A vague claim such as becoming more aware is not a mechanism. A reason that only restates the proposed product is not evidence.";

export const IDEA_K7_RULE =
  "PASS only when the mechanism fits the stored audience's needs, conditions, ability, time, and behavior, and it does not have to replace its own substance to be realized. The evidence names what this audience already does and what is still missing. FAIL when the missing piece is a product, system, or capability this audience does not have and cannot prepare from their current conditions. A claim that there is no new habit, or that the idea fits an existing routine, is not evidence. When the idea proposes a new habit, PASS only when a realistic way to adopt that habit is present. A short action inside time this audience already spends is a realistic way to adopt it. Do not treat the idea's own boundary as the obstacle. The boundary is the part the how-if deliberately does not do. FAIL when that new habit has no existing moment in which it can happen. A habit that is not yet common is not automatically unrealistic. Distinguish a habit the audience is not yet used to, a habit that is difficult but possible, and a habit that is unrealistic for this audience. FAIL when the idea depends on unrealistic audience behavior, needs an unreasonable commitment, time, or resources with no way through that barrier, cannot be developed without creating another idea, or is only attractive in theory. Do not return BELUM_TERVERIFIKASI only because the audience field is empty when the Master Thought statement, the prior belief, or the root belief already names who is addressed. Do not invent an audience from the idea, the Territory, the Angle, or the Big Thought. When none of those stored Master Thought texts name who is addressed, return BELUM_TERVERIFIKASI and say that the Master Thought audience needs to be filled.";

export type IdeaCriterion = {
  id: IdeaCriterionId;
  status: IdeaCriterionStatus;
  reason: string;
  evidence: string;
  explanation: string;
  weakness: string;
};

export type StrategicContext = {
  masterThought: string;
  bigThought: string;
  territory: string;
  angle: string;
};

export type IdeaAuditSnapshot = {
  statement: string;
  criteria: IdeaCriterion[];
  decision: IdeaValidationDecision;
  classification: string;
  duplicate: DuplicateConceptRecord | null;
  validatorVersion: string;
  validatedAt: string;
};

export type DuplicateConceptRecord = {
  code: "DUPLICATE_CONCEPT";
  comparedIdeaId: string;
  comparedCode: string;
  comparedStatement: string;
  sameConcept: string;
  overlappingMechanism: string;
  overlappingValue: string;
  reason: string;
};

export type IdeaValidation = {
  schema: typeof IDEA_VALIDATION_SCHEMA;
  criteria: IdeaCriterion[];
  decision: IdeaValidationDecision;
  decisionReason: string;
  recommendation: string;
  classification: string;
  title: string;
  concept: string;
  mechanism: string;
  value: string;
  generatorVersion: typeof IDEA_GENERATOR_VERSION;
  validatorVersion: string;
  validatedAt: string;
  statement: string;
  duplicate: DuplicateConceptRecord | null;
  crossIdea: "PASS" | "FAIL" | "BELUM_TERVERIFIKASI";
  strategicContext: StrategicContext;
  auditHistory: IdeaAuditSnapshot[];
};

export type FailureMemoryItem = {
  code: string;
  statement: string;
  angleId: string;
  sameAngle: boolean;
  failed: Array<{ id: IdeaCriterionId; reason: string }>;
  unverified?: Array<{ id: IdeaCriterionId; reason: string }>;
  duplicate?: DuplicateConceptRecord | null;
};

export type RelevantIdea = {
  code: string;
  statement: string;
  concept: string;
  mechanism: string;
  value: string;
  decision: IdeaValidationDecision;
  sameAngle?: boolean;
};

const ID_HINT =
  /\b(yang|dan|untuk|dengan|dari|ini|tidak|agar|pada|dalam|adalah|atau|para|sebuah|karyawan|kinerja)\b/gi;
const EN_HINT = /\b(the|and|with|from|this|that|without|when|because|employee|performance|does|into)\b/gi;
const INDONESIAN_OPENING = /^\s*bagaimana\s+jika\b/i;
const ENGLISH_OPENING = /^\s*what\s+if\b/i;
const ANY_OPENING = /^\s*(bagaimana\s+jika|what\s+if|et\s+si|was\s+wäre\s+wenn|e\s+se|y\s+si|如果)\b/i;

export function angleLanguage(statement: string): "id" | "en" | "other" {
  const indonesian = statement.match(ID_HINT)?.length ?? 0;
  const english = statement.match(EN_HINT)?.length ?? 0;
  if (indonesian > english) return "id";
  if (english > indonesian) return "en";
  return "other";
}

export function hasHowIfOpening(statement: string, angleStatement: string): boolean {
  const language = angleLanguage(angleStatement);
  if (language === "id") return INDONESIAN_OPENING.test(statement);
  if (language === "en") return ENGLISH_OPENING.test(statement);
  return ANY_OPENING.test(statement);
}

export function howIfInstruction(angleStatement: string): string {
  const language = angleLanguage(angleStatement);
  if (language === "id") return 'Begin the statement with "Bagaimana jika".';
  if (language === "en") return 'Begin the statement with "What if".';
  return 'Begin the statement with the words for "what if" in the Angle\'s language.';
}

export function admissionForDecision(decision: IdeaValidationDecision): IndividualAdmission {
  if (decision === "LOLOS") return "GENERATE_VALID";
  if (decision === "DITOLAK") return "GENERATE_REJECT";
  return "UNRESOLVED";
}

export function decideCriteria(criteria: readonly IdeaCriterion[]): IdeaValidationDecision {
  if (criteria.some((criterion) => criterion.status === "FAIL")) return "DITOLAK";
  if (criteria.some((criterion) => criterion.status === "BELUM_TERVERIFIKASI")) return "BELUM_TERVERIFIKASI";
  return "LOLOS";
}

function decisionReason(criteria: readonly IdeaCriterion[], decision: IdeaValidationDecision): string {
  if (decision === "LOLOS") return "";
  if (decision === "DITOLAK") {
    return criteria
      .filter((criterion) => criterion.status === "FAIL")
      .map((criterion) => `${criterion.id}: ${criterion.reason}`.trim())
      .join("\n");
  }
  return criteria
    .filter((criterion) => criterion.status === "BELUM_TERVERIFIKASI")
    .map((criterion) => criterion.id)
    .join(", ");
}

function blankCriterion(id: IdeaCriterionId, status: IdeaCriterionStatus = "BELUM_TERVERIFIKASI", reason = ""): IdeaCriterion {
  return { id, status, reason, evidence: "", explanation: "", weakness: "" };
}

function blankCriteria(): IdeaCriterion[] {
  return IDEA_CRITERIA.map((id) => blankCriterion(id));
}

export function formatAuditReason(input: {
  status: IdeaCriterionStatus;
  evidence: string;
  explanation: string;
  weakness: string;
}): string {
  return [
    `STATUS: ${input.status}`,
    `BUKTI: ${input.evidence.trim()}`,
    `PENJELASAN: ${input.explanation.trim()}`,
    `KELEMAHAN: ${input.weakness.trim()}`,
  ].join("\n");
}

/** The one sentence a checklist and the next generate round show. */
export function lessonSentence(criterion: { reason?: string; explanation?: string }): string {
  const explanation = criterion.explanation?.trim() ?? "";
  if (explanation) return explanation;
  const reason = criterion.reason?.trim() ?? "";
  const match = reason.match(/PENJELASAN:\s*([\s\S]*?)(?:\nKELEMAHAN:|$)/);
  if (match?.[1]?.trim()) return match[1].trim();
  if (reason.startsWith("STATUS:")) return "";
  return reason;
}

function inAngleLanguage(angle: string, indonesian: string, english: string): string {
  return angleLanguage(angle) === "id" ? indonesian : english;
}

function contentWords(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3);
}

/** A stored sentence is shown only when the answer repeats a real piece of it. */
export function storedTextShown(stored: string, answer: string): boolean {
  const words = contentWords(stored);
  if (words.length === 0) return false;
  const haystack = contentWords(answer).join(" ");
  if (!haystack) return false;
  if (words.length < 3) return words.every((word) => haystack.includes(word));
  for (let index = 0; index <= words.length - 3; index += 1) {
    if (haystack.includes(words.slice(index, index + 3).join(" "))) return true;
  }
  return false;
}

function ideasOnThisAngle(peers: readonly RelevantIdea[]): RelevantIdea[] {
  return peers.filter((peer) => peer.sameAngle !== false);
}

export function comparisonGap(reason: string, peers: readonly RelevantIdea[], angle: string): string | null {
  const passed = ideasOnThisAngle(peers).filter((peer) => peer.decision === "LOLOS");
  if (passed.length === 0) return null;
  const shown = passed.some((peer) => {
    if (peer.code && new RegExp(`\\b${peer.code}\\b`, "i").test(reason)) return true;
    return [peer.statement, peer.concept, peer.mechanism, peer.value].some((part) => part.trim() && storedTextShown(part, reason));
  });
  if (shown) return null;
  return inAngleLanguage(
    angle,
    "Tidak ada bukti perbandingan dengan ide yang sudah lolos.",
    "The comparison with a passed idea was not shown.",
  );
}

export function strategicContextGap(input: {
  masterThought: string;
  bigThought: string;
  territory: string;
  masterThoughtLink: string;
  bigThoughtLink: string;
  territoryLink: string;
  angle: string;
}): string | null {
  const shown =
    storedTextShown(input.masterThought, input.masterThoughtLink) &&
    storedTextShown(input.bigThought, input.bigThoughtLink) &&
    storedTextShown(input.territory, input.territoryLink);
  if (shown) return null;
  return inAngleLanguage(
    input.angle,
    "Hubungan ke Master Thought, Big Thought, dan Territory disebut, tetapi isi tersimpan masing-masing tidak ditunjukkan.",
    "The answer names Master Thought, Big Thought, and Territory, but it does not show the stored text of each one.",
  );
}

function emptyContext(): StrategicContext {
  return { masterThought: "", bigThought: "", territory: "", angle: "" };
}

function evidenced(criteria: IdeaCriterion[]): IdeaCriterion[] {
  return criteria.map((criterion) =>
    criterion.status === "PASS" && !criterion.reason.trim()
      ? { ...criterion, status: "BELUM_TERVERIFIKASI", reason: "" }
      : criterion,
  );
}

function seal(
  input: {
    criteria: IdeaCriterion[];
    recommendation?: string;
    classification?: string;
    title?: string;
    concept?: string;
    mechanism?: string;
    value?: string;
    duplicate?: DuplicateConceptRecord | null;
    crossIdea?: IdeaValidation["crossIdea"];
    statement?: string;
    validatorVersion?: string;
    strategicContext?: StrategicContext;
    auditHistory?: IdeaAuditSnapshot[];
  },
  validatedAt: string,
): IdeaValidation {
  const criteria = evidenced(
    IDEA_CRITERIA.map((id) => {
      const found = input.criteria.find((criterion) => criterion.id === id);
      return found
        ? {
            ...blankCriterion(id),
            ...found,
            evidence: found.evidence ?? "",
            explanation: found.explanation ?? "",
            weakness: found.weakness ?? "",
          }
        : blankCriterion(id);
    }),
  );
  const decision = decideCriteria(criteria);
  return {
    schema: IDEA_VALIDATION_SCHEMA,
    criteria,
    decision,
    decisionReason: decisionReason(criteria, decision),
    recommendation: input.recommendation?.trim() ?? "",
    classification: input.classification?.trim() ?? "",
    title: input.title?.trim() ?? "",
    concept: input.concept?.trim() ?? "",
    mechanism: input.mechanism?.trim() ?? "",
    value: input.value?.trim() ?? "",
    generatorVersion: IDEA_GENERATOR_VERSION,
    validatorVersion: input.validatorVersion || IDEA_VALIDATOR_VERSION,
    validatedAt,
    statement: input.statement?.trim() ?? "",
    duplicate: input.duplicate ?? null,
    crossIdea: input.crossIdea ?? "BELUM_TERVERIFIKASI",
    strategicContext: input.strategicContext ?? emptyContext(),
    auditHistory: input.auditHistory ?? [],
  };
}

export function classifyLegacyIdea(statement: string, angleStatement: string, validatedAt = new Date().toISOString()): IdeaValidation {
  const opening = hasHowIfOpening(statement, angleStatement);
  return seal(
    {
      criteria: IDEA_CRITERIA.map((id) =>
        !opening && id === "K1"
          ? {
              ...blankCriterion(id, "FAIL", formatAuditReason({
                status: "FAIL",
                evidence: statement.trim(),
                explanation: "This is not a how-if proposal.",
                weakness: "The opening does not make a how-if proposal.",
              })),
              evidence: statement.trim(),
              explanation: "This is not a how-if proposal.",
              weakness: "The opening does not make a how-if proposal.",
            }
          : blankCriterion(id),
      ),
      classification: opening ? "" : "not-how-if",
      statement,
    },
    validatedAt,
  );
}

function readStatus(value: unknown): IdeaCriterionStatus | null {
  if (typeof value !== "string") return null;
  const token = value.trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (token === "PASS") return "PASS";
  if (token === "FAIL") return "FAIL";
  if (token === "BELUM_TERVERIFIKASI" || token === "UNVERIFIED") return "BELUM_TERVERIFIKASI";
  return null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readDuplicate(value: unknown): DuplicateConceptRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (row.code !== "DUPLICATE_CONCEPT") return null;
  const comparedCode = text(row.comparedCode);
  const comparedStatement = text(row.comparedStatement);
  const sameConcept = text(row.sameConcept);
  const overlappingMechanism = text(row.overlappingMechanism);
  const overlappingValue = text(row.overlappingValue);
  const reason = text(row.reason);
  if (!comparedCode || !comparedStatement || !sameConcept || !overlappingMechanism || !overlappingValue || !reason) return null;
  return {
    code: "DUPLICATE_CONCEPT",
    comparedIdeaId: text(row.comparedIdeaId),
    comparedCode,
    comparedStatement,
    sameConcept,
    overlappingMechanism,
    overlappingValue,
    reason,
  };
}

function readCross(value: unknown): IdeaValidation["crossIdea"] {
  return value === "PASS" || value === "FAIL" || value === "BELUM_TERVERIFIKASI" ? value : "BELUM_TERVERIFIKASI";
}

function readContext(value: unknown): StrategicContext {
  if (!value || typeof value !== "object" || Array.isArray(value)) return emptyContext();
  const row = value as Record<string, unknown>;
  return {
    masterThought: text(row.masterThought),
    bigThought: text(row.bigThought),
    territory: text(row.territory),
    angle: text(row.angle),
  };
}

function readDecision(value: unknown): IdeaValidationDecision | null {
  if (value === "LOLOS" || value === "DITOLAK" || value === "BELUM_TERVERIFIKASI") return value;
  return null;
}

function readAuditHistory(value: unknown): IdeaAuditSnapshot[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const row = item as Record<string, unknown>;
    if (!Array.isArray(row.criteria)) return [];
    const criteria = blankCriteria();
    for (const criterion of row.criteria) {
      if (!criterion || typeof criterion !== "object") continue;
      const id = text((criterion as { id?: unknown }).id).toUpperCase();
      const status = readStatus((criterion as { status?: unknown }).status);
      const slot = criteria.find((entry) => entry.id === id);
      if (!slot || !status) continue;
      slot.status = status;
      slot.reason = text((criterion as { reason?: unknown }).reason);
      slot.evidence = text((criterion as { evidence?: unknown }).evidence);
      slot.explanation = text((criterion as { explanation?: unknown }).explanation);
      slot.weakness = text((criterion as { weakness?: unknown }).weakness);
    }
    return [
      {
        statement: text(row.statement),
        criteria,
        decision: readDecision(row.decision) ?? decideCriteria(criteria),
        classification: text(row.classification),
        duplicate: readDuplicate(row.duplicate),
        validatorVersion: text(row.validatorVersion) || IDEA_GENERATOR_VERSION,
        validatedAt: text(row.validatedAt),
      },
    ];
  });
}

export function parseIdeaValidation(raw: unknown, validatedAt = new Date().toISOString()): IdeaValidation | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as {
    criteria?: unknown;
    recommendation?: unknown;
    classification?: unknown;
    title?: unknown;
    concept?: unknown;
    mechanism?: unknown;
    value?: unknown;
    duplicate?: unknown;
    crossIdea?: unknown;
  };
  if (!Array.isArray(row.criteria)) return null;
  const criteria = blankCriteria();
  for (const item of row.criteria) {
    if (!item || typeof item !== "object") continue;
    const id = text((item as { id?: unknown }).id).toUpperCase();
    const status = readStatus((item as { status?: unknown }).status);
    if (!IDEA_CRITERIA.includes(id as IdeaCriterionId) || !status) continue;
    const slot = criteria.find((criterion) => criterion.id === id);
    if (!slot) continue;
    slot.status = status;
    slot.reason = text((item as { reason?: unknown }).reason);
    slot.evidence = text((item as { evidence?: unknown }).evidence);
    slot.explanation = text((item as { explanation?: unknown }).explanation);
    slot.weakness = text((item as { weakness?: unknown }).weakness);
  }
  const stored = raw as {
    statement?: unknown;
    validatorVersion?: unknown;
    strategicContext?: unknown;
    auditHistory?: unknown;
  };
  return seal(
    {
      criteria,
      recommendation: text(row.recommendation),
      classification: text(row.classification),
      title: text(row.title),
      concept: text(row.concept),
      mechanism: text(row.mechanism),
      value: text(row.value),
      duplicate: readDuplicate(row.duplicate),
      crossIdea: readCross(row.crossIdea),
      statement: text(stored.statement),
      validatorVersion: text(stored.validatorVersion) || IDEA_GENERATOR_VERSION,
      strategicContext: readContext(stored.strategicContext),
      auditHistory: readAuditHistory(stored.auditHistory),
    },
    validatedAt,
  );
}

export function readIdeaValidation(raw: unknown): IdeaValidation | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as { schema?: unknown; criteria?: unknown; generatorVersion?: unknown };
  if (row.schema !== IDEA_VALIDATION_SCHEMA || row.generatorVersion !== IDEA_GENERATOR_VERSION) return null;
  const parsed = parseIdeaValidation(raw, text((raw as { validatedAt?: unknown }).validatedAt) || new Date(0).toISOString());
  if (!parsed) return null;
  if (!text((raw as { validatorVersion?: unknown }).validatorVersion)) {
    return { ...parsed, validatorVersion: IDEA_GENERATOR_VERSION };
  }
  return parsed;
}

function forceCriterion(criteria: IdeaCriterion[], id: IdeaCriterionId, status: IdeaCriterionStatus, reason: string): IdeaCriterion[] {
  return criteria.map((criterion) => (criterion.id === id ? { ...criterion, status, reason } : criterion));
}

/** Opening is decided from the statement. K6 stays unverified when Master Thought, Big Thought, or Territory is missing or cannot be checked. */
export function applyContextRules(
  validation: IdeaValidation,
  input: { statement: string; angle: string; territory: string; bigThought: string; masterThought?: string },
): IdeaValidation {
  let criteria = validation.criteria.map((criterion) => ({ ...criterion }));
  if (!hasHowIfOpening(input.statement, input.angle)) {
    const current = criteria.find((criterion) => criterion.id === "K1");
    criteria = forceCriterion(
      criteria,
      "K1",
      "FAIL",
      current?.status === "FAIL" && current.reason.trim()
        ? current.reason
        : formatAuditReason({
            status: "FAIL",
            evidence: input.statement.trim(),
            explanation: "This is not a how-if proposal.",
            weakness: "The opening does not make a how-if proposal.",
          }),
    );
  }
  const missing = [
    !input.masterThought?.trim() ? "Master Thought" : "",
    !input.bigThought.trim() ? "Big Thought" : "",
    !input.territory.trim() ? "Territory" : "",
  ].filter(Boolean);
  if (missing.length > 0) {
    criteria = forceCriterion(
      criteria,
      "K6",
      "BELUM_TERVERIFIKASI",
      formatAuditReason({
        status: "BELUM_TERVERIFIKASI",
        evidence: "",
        explanation: `${missing.join(", ")} is not available, so the link was not checked.`,
        weakness: "A missing Master Thought, Big Thought, or Territory cannot be assumed.",
      }),
    );
  }
  return seal(
    {
      ...validation,
      criteria,
      statement: validation.statement || input.statement,
      strategicContext: {
        masterThought: input.masterThought?.trim() ?? "",
        bigThought: input.bigThought.trim(),
        territory: input.territory.trim(),
        angle: input.angle.trim(),
      },
    },
    validation.validatedAt,
  );
}

function sameStatement(left: string, right: string): boolean {
  return left.trim().toLowerCase().replace(/\s+/g, " ") === right.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Exact substance already stored as a failure. Similar words are left to the model. */
export function applyStoredSubstance(validation: IdeaValidation, statement: string, history: readonly FailureMemoryItem[]): IdeaValidation {
  const prior = history.find((item) => sameStatement(item.statement, statement));
  if (!prior || prior.failed.length === 0) return validation;
  const criteria = validation.criteria.map((criterion) => {
    const failed = prior.failed.find((item) => item.id === criterion.id);
    if (!failed) return criterion;
    return { ...criterion, status: "FAIL" as const, reason: failed.reason.trim() || criterion.reason };
  });
  return seal({ ...validation, criteria }, validation.validatedAt);
}

export function checksFromValidation(validation: IdeaValidation): Array<{
  id: IdeaCriterionId;
  state: "pass" | "fail" | "pending";
  reason?: string;
}> {
  return validation.criteria.map((criterion) => {
    const sentence = lessonSentence(criterion);
    const blocked = criterion.status === "FAIL" || Boolean(sentence);
    return {
      id: criterion.id,
      state: criterion.status === "PASS" ? "pass" : blocked ? "fail" : "pending",
      ...(sentence ? { reason: sentence } : {}),
    };
  });
}

function rememberedFailure(input: {
  code: string;
  statement: string;
  angleId: string;
  sameAngle?: boolean;
  decision: IdeaValidationDecision;
  criteria: readonly IdeaCriterion[];
  duplicate?: DuplicateConceptRecord | null;
}): FailureMemoryItem | null {
  if (input.decision === "LOLOS") return null;
  const failed = input.criteria
    .filter((criterion) => criterion.status === "FAIL")
    .map((criterion) => ({ id: criterion.id, reason: lessonSentence(criterion) || criterion.reason.trim() }))
    .filter((item) => item.reason);
  const unverified = input.criteria
    .filter((criterion) => criterion.status === "BELUM_TERVERIFIKASI")
    .map((criterion) => ({ id: criterion.id, reason: lessonSentence(criterion) }))
    .filter((item) => item.reason);
  if (input.decision === "DITOLAK" && failed.length === 0 && !input.duplicate) return null;
  if (input.decision === "BELUM_TERVERIFIKASI" && unverified.length === 0 && !input.duplicate) return null;
  return {
    code: input.code,
    statement: input.statement,
    angleId: input.angleId,
    sameAngle: input.sameAngle !== false,
    failed,
    unverified,
    duplicate: input.duplicate ?? null,
  };
}

export function failureMemoryFromValidation(input: {
  code: string;
  statement: string;
  angleId: string;
  sameAngle?: boolean;
  validation: IdeaValidation;
}): FailureMemoryItem | null {
  return rememberedFailure({
    code: input.code,
    statement: input.statement,
    angleId: input.angleId,
    sameAngle: input.sameAngle,
    decision: input.validation.decision,
    criteria: input.validation.criteria,
    duplicate: input.validation.duplicate,
  });
}

export function ideaHistorySummary(validations: readonly IdeaValidation[]): {
  passed: number;
  rejected: number;
  unverified: number;
  topFailed: IdeaCriterionId | null;
} {
  const counts = Object.fromEntries(IDEA_CRITERIA.map((id) => [id, 0])) as Record<IdeaCriterionId, number>;
  let passed = 0;
  let rejected = 0;
  let unverified = 0;
  for (const validation of validations) {
    if (validation.decision === "LOLOS") passed += 1;
    else if (validation.decision === "DITOLAK") rejected += 1;
    else unverified += 1;
    for (const criterion of validation.criteria) {
      if (criterion.status === "FAIL") counts[criterion.id] += 1;
    }
  }
  let topFailed: IdeaCriterionId | null = null;
  let best = 0;
  for (const id of IDEA_CRITERIA) {
    if (counts[id] > best) {
      best = counts[id];
      topFailed = id;
    }
  }
  return { passed, rejected, unverified, topFailed };
}

export function rankFailureMemory<T extends { angleId: string }>(rows: readonly T[], angleId: string): T[] {
  return [...rows.filter((row) => row.angleId === angleId), ...rows.filter((row) => row.angleId !== angleId)];
}

export function failureItemsFromIdeas(
  rows: ReadonlyArray<{
    code: string;
    statement: string;
    angleId: string;
    admission: string;
    validation: IdeaValidation | null;
  }>,
  angleId: string,
): FailureMemoryItem[] {
  const remembered = rows.flatMap((row) => {
    if (!row.validation) return [];
    const current = failureMemoryFromValidation({
      code: row.code,
      statement: row.statement,
      angleId: row.angleId,
      sameAngle: row.angleId === angleId,
      validation: row.validation,
    });
    const past = (row.validation.auditHistory ?? []).flatMap((snapshot) => {
      const item = rememberedFailure({
        code: row.code,
        statement: snapshot.statement || row.statement,
        angleId: row.angleId,
        sameAngle: row.angleId === angleId,
        decision: snapshot.decision,
        criteria: snapshot.criteria,
        duplicate: snapshot.duplicate,
      });
      return item ? [item] : [];
    });
    return [...(current ? [current] : []), ...past];
  });
  const seen = new Set<string>();
  const unique = remembered.filter((item) => {
    const key = [
      item.statement.trim().toLowerCase(),
      ...item.failed.map((failed) => `${failed.id}:${failed.reason}`),
      ...(item.unverified ?? []).map((open) => `${open.id}:${open.reason}`),
    ].join("\0");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return rankFailureMemory(unique, angleId);
}

export function formatFailureMemory(items: readonly FailureMemoryItem[]): string {
  const lineFor = (item: FailureMemoryItem) => {
    const reasons = [
      ...item.failed.map((failed) => `${failed.id} FAIL: ${lessonSentence({ reason: failed.reason })}`.trim()),
      ...(item.unverified ?? []).map((open) => `${open.id} BELUM_TERVERIFIKASI: ${lessonSentence({ reason: open.reason })}`.trim()),
    ];
    const reasonText = reasons.length ? reasons.join("\n") : "Failed criterion: (not stored)";
    const duplicate = item.duplicate
      ? [
          "DUPLICATE_CONCEPT",
          `Compared with ${item.duplicate.comparedCode}${item.duplicate.comparedIdeaId ? ` (${item.duplicate.comparedIdeaId})` : ""}: ${item.duplicate.comparedStatement}`,
          `Same concept: ${item.duplicate.sameConcept}`,
          `Overlapping mechanism: ${item.duplicate.overlappingMechanism}`,
          `Overlapping value: ${item.duplicate.overlappingValue}`,
          item.duplicate.reason,
        ].join("\n")
      : "";
    return `${item.code}: ${item.statement}\n${reasonText}${duplicate ? `\n${duplicate}` : ""}`;
  };
  const same = items.filter((item) => item.sameAngle);
  const siblings = items.filter((item) => !item.sameAngle);
  return [
    "Ideas that failed or could not be verified on this Angle:",
    same.length ? same.map(lineFor).join("\n") : "(none)",
    "",
    "Ideas that failed or could not be verified on sibling Angles in this Territory:",
    siblings.length ? siblings.map(lineFor).join("\n") : "(none)",
    "",
    "Similar words alone are not a repeat. When the substance is the same as a failed idea, fail the same criterion.",
    "A new title, wording, visualization, or delivery format is still that idea when the concept, the working principle, and the value stay the same.",
  ].join("\n");
}

function formatRelevantIdeas(peers: readonly RelevantIdea[]): string {
  const lines = peers.map(
    (peer) =>
      `${peer.code} (${peer.decision}): ${peer.statement}\nConcept: ${peer.concept || "(none)"}\nMechanism: ${peer.mechanism || "(none)"}\nValue: ${peer.value || "(none)"}`,
  );
  return ["Ideas already passed, rejected, or in this batch:", lines.length ? lines.join("\n") : "(none)"].join("\n");
}

export function ideaRootId(id: string, rows: ReadonlyArray<{ id: string; parentIdeaId: string | null }>): string {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const seen = new Set<string>();
  let current = id;
  while (!seen.has(current)) {
    seen.add(current);
    const parentId = byId.get(current)?.parentIdeaId;
    if (!parentId || !byId.has(parentId)) return current;
    current = parentId;
  }
  return current;
}

export function revisionCount(id: string, rows: ReadonlyArray<{ id: string; parentIdeaId: string | null }>): number {
  const root = ideaRootId(id, rows);
  return rows.filter((row) => row.id !== root && ideaRootId(row.id, rows) === root).length;
}

export function canReviseIdea(
  row: { id: string; parentIdeaId: string | null },
  rows: ReadonlyArray<{ id: string; parentIdeaId: string | null }>,
  decision: IdeaValidationDecision,
  storedRevisions = 0,
): boolean {
  const used = Math.max(revisionCount(row.id, rows), storedRevisions);
  return (decision === "DITOLAK" || decision === "BELUM_TERVERIFIKASI") && used < IDEA_REVISION_CAP;
}

export function buildIdeaValidationPrompt(input: {
  statement: string;
  title: string;
  concept: string;
  mechanism: string;
  value: string;
  angle: string;
  territory: string;
  bigThought: string;
  masterThought: string;
  audience?: string;
  priorBelief?: string;
  rootBelief?: string;
  failures: readonly FailureMemoryItem[];
  peers?: readonly RelevantIdea[];
}): string {
  return [
    "Validate one Idea. You are the auditor, not the author. Look for reasons to reject.",
    "The Belief Target is the locked Big Thought. The Angle is not the Territory and not the Big Thought.",
    howIfInstruction(input.angle),
    "Identify the main claim. Look for weakness in the idea, the mechanism, and the value.",
    "The title, concept, mechanism, and value are the generator's claims. They are not proof.",
    "PASS only when the evidence supports the requirement. A long explanation is not a better idea.",
    "Do not change a FAIL into a PASS to fill a quota.",
    "Judge only K1 through K7. Do not average them. One FAIL makes the idea rejected.",
    "A missing context is BELUM_TERVERIFIKASI. Do not invent a Big Thought, Territory, or reason.",
    "K6. The idea links to the stored Master Thought, Big Thought, and Territory. If one of those is missing or the link cannot be checked, K6 is BELUM_TERVERIFIKASI. Do not pass it from an assumption.",
    "K1. The statement is one specific how-if proposal. Fail it when the substance is only a fact, insight, problem, goal, proposition, general strategy, consequence scenario, activity, or technique.",
    "Containing one of those is allowed. It must not be the whole substance.",
    `K2. ${IDEA_K2_RULE}`,
    "K3. PASS when the proposed mechanism can logically produce the stated value. FAIL when the result does not follow from the mechanism or a basic contradiction is present.",
    "K4. PASS when a beneficiary is clear, a relevant problem or need is clear, and the reason this mechanism could deliver that benefit is clear.",
    "K4 FAIL when the value is only a general claim, such as increasing effectiveness, providing transparency, or helping the business, with no concrete link to the mechanism.",
    "Do not pass K4 only because the idea discusses a problem that matches the Angle or the Big Thought.",
    "K5. PASS only when the core concept, the working principle, or the value produced is meaningfully different from other relevant ideas.",
    "K5 FAIL with DUPLICATE_CONCEPT when the idea repeats another idea's core concept, or when only the title, the wording, the visualization, or the emphasis of the communication changes.",
    "K5 FAIL when a different mechanism still produces the same experience and main value.",
    "Compare passed ideas, rejected ideas, relevant ideas that are not yet verified, and the other ideas in this batch.",
    "When the idea differs only in part but the mechanism and the value are meaningfully new, name that difference explicitly.",
    "The same topic or the same Big Thought is not a K5 failure.",
    "If the comparison history was not loaded, K5 stays BELUM_TERVERIFIKASI. Do not claim the comparison was complete.",
    "K6 names the stored Master Thought, the stored Big Thought, and the stored Territory, and the relationship to each one.",
    "Angle, Territory, and Big Thought are different. Do not treat them as the same thing.",
    "K6 stays BELUM_TERVERIFIKASI when the stored Master Thought, Big Thought, or Territory is missing or the link cannot be checked. Do not pass K6 from an assumption.",
    `K7. ${IDEA_K7_RULE}`,
    "A PASS without a specific evidence reason is not a pass. Write that evidence in the Angle's language.",
    "Return JSON only:",
    '{"criteria":[{"id":"K1","status":"PASS","reason":""}],"classification":"","recommendation":"","title":"","concept":"","mechanism":"","value":""}',
    "",
    `Angle: ${input.angle.trim() || "(missing)"}`,
    `Territory: ${input.territory.trim() || "(missing)"}`,
    `Big Thought: ${input.bigThought.trim() || "(missing)"}`,
    `Master Thought: ${input.masterThought.trim() || "(missing)"}`,
    `Title: ${input.title.trim() || "(none)"}`,
    `Statement: ${input.statement.trim()}`,
    `Concept: ${input.concept.trim() || "(none)"}`,
    `Mechanism: ${input.mechanism.trim() || "(none)"}`,
    `Value: ${input.value.trim() || "(none)"}`,
    "",
    formatFailureMemory(input.failures),
    "",
    formatRelevantIdeas(input.peers ?? []),
  ].join("\n");
}

export function buildIdeaRevisionPrompt(input: {
  angle: string;
  statement: string;
  failed: readonly { id: IdeaCriterionId; reason: string }[];
  passed?: readonly { id: IdeaCriterionId; reason: string }[];
  revision: number;
}): string {
  const failed = input.failed.length
    ? input.failed.map((item) => `${item.id}: ${item.reason}`).join("\n")
    : "(none)";
  const passed = (input.passed ?? []).length
    ? (input.passed ?? []).map((item) => `${item.id}: ${item.reason}`).join("\n")
    : "(none)";
  return [
    "Repair this same Idea. Do not create a different idea and do not add another card.",
    howIfInstruction(input.angle),
    "Change only the wording the failed requirements need. Keep every passed requirement true.",
    "The failed requirements are the lesson for this repair and for the next round.",
    "Do not turn it into only a fact, insight, problem, goal, proposition, general strategy, consequence, activity, or technique.",
    "Return one JSON object: {\"ideas\":[{\"title\":\"...\",\"statement\":\"...\",\"concept\":\"...\",\"mechanism\":\"...\",\"value\":\"...\"}]}",
    `This is repair ${input.revision} of 3 on the same card.`,
    "",
    `Angle: ${input.angle.trim()}`,
    "Idea on this card:",
    input.statement.trim(),
    "",
    "Passed requirements that must stay true:",
    passed,
    "",
    "Failed requirements to repair:",
    failed,
  ].join("\n");
}

export async function judgeIdeaValidation(input: {
  statement: string;
  title?: string;
  concept?: string;
  mechanism?: string;
  value?: string;
  angle: string;
  territory: string;
  bigThought: string;
  masterThought: string;
  failures: readonly FailureMemoryItem[];
  peers?: readonly RelevantIdea[];
  ask: (prompt: string) => Promise<string | null>;
  validatedAt?: string;
}): Promise<IdeaValidation> {
  const validatedAt = input.validatedAt ?? new Date().toISOString();
  const script = await input.ask(
    buildIdeaValidationPrompt({
      statement: input.statement,
      title: input.title ?? "",
      concept: input.concept ?? "",
      mechanism: input.mechanism ?? "",
      value: input.value ?? "",
      angle: input.angle,
      territory: input.territory,
      bigThought: input.bigThought,
      masterThought: input.masterThought,
      failures: input.failures,
      peers: input.peers,
    }),
  );
  const parsed = script?.trim() ? parseIdeaValidation(parseModelJson(script), validatedAt) : null;
  if (!parsed) {
    const shell = classifyLegacyIdea(input.statement, input.angle, validatedAt);
    return applyStoredSubstance(shell, input.statement, input.failures);
  }
  const ruled = applyContextRules(parsed, {
    statement: input.statement,
    angle: input.angle,
    territory: input.territory,
    bigThought: input.bigThought,
    masterThought: input.masterThought,
  });
  const titled = seal(
    {
      ...ruled,
      title: ruled.title || input.title || "",
      concept: ruled.concept || input.concept || "",
      mechanism: ruled.mechanism || input.mechanism || "",
      value: ruled.value || input.value || "",
      statement: input.statement,
      validatorVersion: IDEA_VALIDATOR_VERSION,
    },
    validatedAt,
  );
  return applyStoredSubstance(titled, input.statement, input.failures);
}

export type IdeaPassStep = {
  id: IdeaCriterionId;
  state: "pending" | "running" | "pass" | "fail";
  reason?: string;
};

const AUDITOR_STANCE = [
  "You are the auditor, not the author. Look for reasons to reject. Do not defend the generator.",
  "Identify the main claim. Look for weakness in the idea, the mechanism, and the value.",
  "Test that claim against the PASS rule and the FAIL rule.",
  "PASS only when the evidence supports it. A long explanation is not a better idea.",
  "The title, concept, mechanism, and value are the generator's claims. They are not proof.",
  "Do not change a FAIL into a PASS to fill a quota.",
  "The Angle, the Territory, and the Big Thought are different. Do not treat them as the same thing.",
].join(" ");

const CRITERION_RULE: Record<IdeaCriterionId, string> = {
  K1: "pass is true only when the statement is one specific how-if proposal. pass is false when the substance is only a fact, an insight, a problem, a goal, a proposition, a general strategy, a consequence scenario, an activity, or a technique. Those may appear inside the proposal. They must not be the whole substance.",
  K2: IDEA_K2_RULE,
  K3: "PASS only when the proposed mechanism can logically produce the stated value. FAIL when the result does not follow from the mechanism, or a basic contradiction is present.",
  K4: "PASS only when a beneficiary is clear, a relevant problem or need is clear, and the reason this mechanism could deliver that benefit is clear. FAIL when the value is only a general claim such as increasing effectiveness, providing transparency, or helping the business, with no concrete link to the mechanism. Do not pass only because the idea discusses a problem that matches the Angle or the Big Thought.",
  K5: "PASS only when the core concept, the mechanism principle, or the produced value is meaningfully different. Compare ideas that already passed, ideas that were rejected, relevant ideas that are not yet verified, and the other ideas in this batch. A comparison with failed ideas alone is not complete. When a relevant idea exists, name that idea in the reason. A claim that this idea is unique, without naming the passed, rejected, or unverified idea it was compared with, is BELUM_TERVERIFIKASI. FAIL with DUPLICATE_CONCEPT when the only difference is the title, the wording, the visualization, or the emphasis of the communication. FAIL when a different mechanism still produces the same experience and the same main value. When the idea differs only in part but the mechanism and the value are meaningfully new, name that difference explicitly. The same topic or the same Big Thought is not a failure. If the comparison history was not loaded, return BELUM_TERVERIFIKASI and do not claim the comparison was complete.",
  K6: "PASS only when the relationship to the stored Master Thought, the stored Big Thought, and the stored Territory is shown separately. Quote the stored text of each one and say how that text supports the idea. Naming Master Thought, Big Thought, or Territory, without showing the stored text, is BELUM_TERVERIFIKASI. If one of those is missing, or the link cannot be checked, return status BELUM_TERVERIFIKASI. Do not pass from an assumption. The Angle is not the Territory and not the Big Thought.",
  K7: IDEA_K7_RULE,
};

export function emptyIdeaPassSteps(): IdeaPassStep[] {
  return IDEA_CRITERIA.map((id) => ({ id, state: "pending" }));
}

export function buildIdeaCriterionPrompt(input: {
  id: IdeaCriterionId;
  statement: string;
  title: string;
  concept: string;
  mechanism: string;
  value: string;
  angle: string;
  territory: string;
  bigThought: string;
  masterThought: string;
  audience?: string;
  priorBelief?: string;
  rootBelief?: string;
  failures: readonly FailureMemoryItem[];
  peers?: readonly RelevantIdea[];
  historyAvailable?: boolean;
}): string {
  return [
    `Decide check ${input.id}. Do not rewrite the idea.`,
    AUDITOR_STANCE,
    howIfInstruction(input.angle),
    CRITERION_RULE[input.id],
    "When pass is false, reason is one sentence in the Angle's language.",
    "When you cannot decide, do not return pass true. Reason is one sentence that says why.",
    "A long explanation is not a better answer.",
    input.id === "K6"
      ? 'Return JSON only: {"pass":true,"reason":"one sentence","masterThoughtLink":"quote the stored Master Thought and how it supports the idea","bigThoughtLink":"quote the stored Big Thought and how it supports the idea","territoryLink":"quote the stored Territory and how it supports the idea"} or {"status":"BELUM_TERVERIFIKASI","reason":"one sentence"}'
      : 'Return JSON only: {"pass":true,"reason":"one sentence"} or {"pass":false,"reason":"one sentence"} or {"status":"BELUM_TERVERIFIKASI","reason":"one sentence"}',
    input.historyAvailable === false ? "The comparison history was not loaded. Do not claim this comparison is complete." : "",
    "",
    `Angle: ${input.angle.trim() || "(missing)"}`,
    `Territory: ${input.territory.trim() || "(missing)"}`,
    `Big Thought: ${input.bigThought.trim() || "(missing)"}`,
    `Master Thought: ${input.masterThought.trim() || "(missing)"}`,
    ...(input.id === "K7"
      ? [
          `Audience: ${input.audience?.trim() || "(not stored)"}`,
          `Prior belief: ${input.priorBelief?.trim() || "(not stored)"}`,
          `Root belief: ${input.rootBelief?.trim() || "(not stored)"}`,
          "Use only these stored Master Thought texts to identify the audience.",
        ]
      : []),
    `Title: ${input.title.trim() || "(none)"}`,
    `Statement: ${input.statement.trim()}`,
    `Concept: ${input.concept.trim() || "(none)"}`,
    `Mechanism: ${input.mechanism.trim() || "(none)"}`,
    `Value: ${input.value.trim() || "(none)"}`,
    "",
    formatFailureMemory(input.failures),
    ...(input.id === "K5"
      ? [
          "",
          formatRelevantIdeas(ideasOnThisAngle(input.peers ?? [])),
          "An empty list means the stored history loaded and no comparable idea was found.",
        ]
      : []),
  ].join("\n");
}

function sameText(left: string, right: string): boolean {
  return left.trim().toLowerCase().replace(/\s+/g, " ") === right.trim().toLowerCase().replace(/\s+/g, " ");
}

export function parseIdeaCriterion(
  script: string | null,
  input: { statement?: string; requireContextLinks?: boolean } = {},
): IdeaCriterion & { masterThoughtLink: string; bigThoughtLink: string; territoryLink: string; undecided: boolean } {
  const undecided = {
    ...blankCriterion("K1", "BELUM_TERVERIFIKASI"),
    masterThoughtLink: "",
    bigThoughtLink: "",
    territoryLink: "",
    undecided: true,
  };
  if (!script?.trim()) return undecided;
  const parsed = parseModelJson(script);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return undecided;
  const row = parsed as {
    pass?: unknown;
    status?: unknown;
    reason?: unknown;
    evidence?: unknown;
    explanation?: unknown;
    weakness?: unknown;
    masterThoughtLink?: unknown;
    bigThoughtLink?: unknown;
    territoryLink?: unknown;
  };
  const evidence = text(row.evidence);
  const explanation = text(row.explanation) || text(row.reason);
  const weakness = text(row.weakness);
  const masterThoughtLink = text(row.masterThoughtLink);
  const bigThoughtLink = text(row.bigThoughtLink);
  const territoryLink = text(row.territoryLink);
  const status = readStatus(row.status) ?? (row.pass === true ? "PASS" : row.pass === false ? "FAIL" : null);
  const pack = (
    next: IdeaCriterionStatus,
    fields: { evidence: string; explanation: string; weakness: string },
    open = false,
  ) => ({
    id: "K1" as const,
    status: next,
    evidence: fields.evidence,
    explanation: fields.explanation,
    weakness: fields.weakness,
    reason: formatAuditReason({ status: next, ...fields }),
    masterThoughtLink,
    bigThoughtLink,
    territoryLink,
    undecided: open,
  });
  if (!status && !explanation && !evidence && !weakness) return undecided;
  if (status === "FAIL") {
    const sentence = explanation || "This check did not pass.";
    return pack("FAIL", {
      evidence: evidence || sentence,
      explanation: sentence,
      weakness: weakness || sentence,
    });
  }
  if (status === "PASS") {
    const sentence = explanation;
    const copiedStatement = Boolean(
      input.statement &&
        ((evidence && sameText(evidence, input.statement)) || (!evidence && sentence && sameText(sentence, input.statement))),
    );
    const missingContextLink = input.requireContextLinks && (!masterThoughtLink || !bigThoughtLink || !territoryLink);
    if (copiedStatement) {
      return pack("BELUM_TERVERIFIKASI", {
        evidence: evidence || sentence,
        explanation: "The evidence only repeats the idea sentence.",
        weakness: weakness || "A repeated sentence is not evidence.",
      });
    }
    if (missingContextLink) {
      return pack("BELUM_TERVERIFIKASI", {
        evidence: evidence || sentence,
        explanation: "The relationship to Master Thought, Big Thought, and Territory was not shown separately.",
        weakness: "A link that is not shown cannot be assumed.",
      });
    }
    const shownExplanation = (sentenceText: string) =>
      input.requireContextLinks
        ? [sentenceText, `Master Thought link: ${masterThoughtLink}`, `Big Thought link: ${bigThoughtLink}`, `Territory link: ${territoryLink}`]
            .filter((line) => line.trim() && !line.endsWith(": "))
            .join("\n")
        : sentenceText;
    if (evidence && explanation && weakness) {
      return pack("PASS", { evidence, explanation: shownExplanation(explanation), weakness });
    }
    if (!sentence) {
      return pack("BELUM_TERVERIFIKASI", {
        evidence: "",
        explanation: "A pass needs one sentence of evidence.",
        weakness: "A pass without a reason was not accepted.",
      });
    }
    return pack("PASS", { evidence: sentence, explanation: shownExplanation(sentence), weakness: sentence });
  }
  return pack("BELUM_TERVERIFIKASI", {
    evidence: evidence || explanation,
    explanation: explanation || "This check is not verified.",
    weakness: weakness || "The evidence is not enough.",
  });
}

function stepState(status: IdeaCriterionStatus): IdeaPassStep["state"] {
  if (status === "PASS") return "pass";
  return "fail";
}

/** Shows each requirement, then checks it, the same way an Angle is checked. */
export async function runIdeaPassChecks(input: {
  statement: string;
  title?: string;
  concept?: string;
  mechanism?: string;
  value?: string;
  angle: string;
  territory: string;
  bigThought: string;
  masterThought: string;
  audience?: string;
  priorBelief?: string;
  rootBelief?: string;
  failures: readonly FailureMemoryItem[];
  peers?: readonly RelevantIdea[];
  historyAvailable?: boolean;
  keptPasses?: readonly IdeaCriterion[];
  ask: (prompt: string) => Promise<string | null>;
  onStep?: (checks: IdeaPassStep[]) => void;
  validatedAt?: string;
}): Promise<IdeaValidation> {
  const validatedAt = input.validatedAt ?? new Date().toISOString();
  const checks = emptyIdeaPassSteps();
  const criteria = blankCriteria();
  const publish = () => input.onStep?.(checks.map((check) => ({ ...check })));
  const show = (id: IdeaCriterionId, status: IdeaCriterionStatus, sentence: string) => {
    const index = checks.findIndex((check) => check.id === id);
    checks[index] = { id, state: stepState(status), ...(sentence ? { reason: sentence } : {}) };
    publish();
  };
  publish();
  const prior = input.failures.find((item) => sameStatement(item.statement, input.statement));
  const storedFail = prior?.failed[0];
  const storedOpen = storedFail ? undefined : prior?.unverified?.[0];
  const stored = storedFail ?? storedOpen;
  if (stored) {
    const slot = criteria.find((criterion) => criterion.id === stored.id);
    if (slot) {
      const status: IdeaCriterionStatus = storedFail ? "FAIL" : "BELUM_TERVERIFIKASI";
      const sentence = lessonSentence({ reason: stored.reason }) || stored.reason;
      slot.status = status;
      slot.evidence = sentence;
      slot.explanation = sentence;
      slot.weakness = sentence;
      slot.reason = formatAuditReason(slot);
      show(stored.id, status, sentence);
      return seal(
        {
          criteria,
          title: input.title,
          concept: input.concept,
          mechanism: input.mechanism,
          value: input.value,
          statement: input.statement,
          strategicContext: {
            masterThought: input.masterThought.trim(),
            bigThought: input.bigThought.trim(),
            territory: input.territory.trim(),
            angle: input.angle.trim(),
          },
          classification: stored.id === "K1" && status === "FAIL" ? "not-how-if" : "",
        },
        validatedAt,
      );
    }
  }
  for (const id of IDEA_CRITERIA) {
    const index = checks.findIndex((check) => check.id === id);
    const slot = criteria.find((criterion) => criterion.id === id);
    if (!slot) continue;
    const kept = input.keptPasses?.find((criterion) => criterion.id === id && criterion.status === "PASS");
    if (kept && (kept.explanation.trim() || kept.reason.trim())) {
      slot.status = "PASS";
      slot.reason = kept.reason;
      slot.evidence = kept.evidence;
      slot.explanation = kept.explanation;
      slot.weakness = kept.weakness;
      show(id, "PASS", lessonSentence(slot));
      continue;
    }
    checks[index] = { id, state: "running" };
    publish();
    if (id === "K1" && !hasHowIfOpening(input.statement, input.angle)) {
      slot.status = "FAIL";
      slot.evidence = input.statement.trim();
      slot.explanation = "This is not a how-if proposal.";
      slot.weakness = "The opening does not make a how-if proposal.";
      slot.reason = formatAuditReason(slot);
      show(id, "FAIL", slot.explanation);
      break;
    }
    const hold = (sentence: string) => {
      slot.status = "BELUM_TERVERIFIKASI";
      slot.evidence = sentence;
      slot.explanation = sentence;
      slot.weakness = sentence;
      slot.reason = formatAuditReason(slot);
      show(id, "BELUM_TERVERIFIKASI", sentence);
    };
    if (id === "K5" && input.historyAvailable === false) {
      slot.status = "BELUM_TERVERIFIKASI";
      slot.evidence = "";
      slot.explanation = "The comparison history could not be loaded, so this check is not complete.";
      slot.weakness = "Passed, rejected, and unverified ideas could not be compared.";
      slot.reason = formatAuditReason(slot);
      show(id, "BELUM_TERVERIFIKASI", slot.explanation);
      break;
    }
    if (id === "K5" && !ideasOnThisAngle(input.peers ?? []).some((peer) => peer.decision === "LOLOS")) {
      const sentence = inAngleLanguage(
        input.angle,
        "Belum ada ide yang lolos, jadi perbandingan ini belum berlaku.",
        "No idea has passed yet, so this comparison does not apply.",
      );
      slot.status = "PASS";
      slot.evidence = sentence;
      slot.explanation = sentence;
      slot.weakness = "";
      slot.reason = formatAuditReason(slot);
      show(id, "PASS", sentence);
      continue;
    }
    if (id === "K6" && (!input.territory.trim() || !input.bigThought.trim() || !input.masterThought.trim())) {
      const missing = [
        !input.masterThought.trim() ? "Master Thought" : "",
        !input.bigThought.trim() ? "Big Thought" : "",
        !input.territory.trim() ? "Territory" : "",
      ].filter(Boolean);
      slot.status = "BELUM_TERVERIFIKASI";
      slot.evidence = "";
      slot.explanation = `${missing.join(", ")} is not available, so the link was not checked.`;
      slot.weakness = "A missing Master Thought, Big Thought, or Territory cannot be assumed.";
      slot.reason = formatAuditReason(slot);
      show(id, "BELUM_TERVERIFIKASI", slot.explanation);
      break;
    }
    const prompt = buildIdeaCriterionPrompt({
      id,
      statement: input.statement,
      title: input.title ?? "",
      concept: input.concept ?? "",
      mechanism: input.mechanism ?? "",
      value: input.value ?? "",
      angle: input.angle,
      territory: input.territory,
      bigThought: input.bigThought,
      masterThought: input.masterThought,
      audience: input.audience,
      priorBelief: input.priorBelief,
      rootBelief: input.rootBelief,
      failures: input.failures,
      peers: input.peers,
      historyAvailable: input.historyAvailable,
    });
    const askCriterion = () => parseIdeaCriterion(null, { statement: input.statement, requireContextLinks: id === "K6" });
    let parsed = parseIdeaCriterion(await input.ask(prompt), { statement: input.statement, requireContextLinks: id === "K6" });
    if (parsed.undecided) {
      parsed = parseIdeaCriterion(await input.ask(prompt), { statement: input.statement, requireContextLinks: id === "K6" });
    }
    if (parsed.undecided) {
      parsed = {
        ...askCriterion(),
        undecided: false,
        explanation: "This check could not be decided.",
        evidence: "This check could not be decided.",
        weakness: "The answer could not be read.",
        reason: formatAuditReason({
          status: "BELUM_TERVERIFIKASI",
          evidence: "This check could not be decided.",
          explanation: "This check could not be decided.",
          weakness: "The answer could not be read.",
        }),
        status: "BELUM_TERVERIFIKASI",
      };
    }
    slot.status = parsed.status;
    slot.evidence = parsed.evidence;
    slot.explanation = parsed.explanation;
    slot.weakness = parsed.weakness;
    slot.reason = parsed.reason;
    if (parsed.status === "PASS" && id === "K5") {
      const gap = comparisonGap(`${parsed.explanation}\n${parsed.evidence}`, input.peers ?? [], input.angle);
      if (gap) {
        hold(gap);
        break;
      }
    }
    if (id === "K6" && parsed.status !== "FAIL") {
      const gap = strategicContextGap({
        masterThought: input.masterThought,
        bigThought: input.bigThought,
        territory: input.territory,
        masterThoughtLink: parsed.masterThoughtLink,
        bigThoughtLink: parsed.bigThoughtLink,
        territoryLink: parsed.territoryLink,
        angle: input.angle,
      });
      const genericLink = parsed.explanation.startsWith("The relationship to Master Thought, Big Thought, and Territory was not shown separately.");
      if (gap && (parsed.status === "PASS" || genericLink)) {
        hold(gap);
        break;
      }
    }
    show(id, parsed.status, lessonSentence(slot));
    if (parsed.status !== "PASS") break;
  }
  return seal(
    {
      criteria,
      title: input.title,
      concept: input.concept,
      mechanism: input.mechanism,
      value: input.value,
      statement: input.statement,
      strategicContext: {
        masterThought: input.masterThought.trim(),
        bigThought: input.bigThought.trim(),
        territory: input.territory.trim(),
        angle: input.angle.trim(),
      },
      classification: criteria.find((criterion) => criterion.id === "K1")?.status === "FAIL" ? "not-how-if" : "",
    },
    validatedAt,
  );
}

export type CrossIdeaCandidate = {
  code: string;
  statement: string;
  concept: string;
  mechanism: string;
  value: string;
  validation: IdeaValidation;
};

export type CrossIdeaPeer = CrossIdeaCandidate & {
  id: string;
  angleId?: string;
};

export function crossPeersFromIdeas(
  rows: ReadonlyArray<{ id: string; code: string; statement: string; validation: IdeaValidation | null; angleId?: string }>,
): CrossIdeaPeer[] {
  return rows.flatMap((row) => {
    if (!row.validation) return [];
    if (row.validation.decision !== "LOLOS" && row.validation.decision !== "DITOLAK" && row.validation.decision !== "BELUM_TERVERIFIKASI") return [];
    return [
      {
        id: row.id,
        code: row.code,
        statement: row.statement,
        concept: row.validation.concept,
        mechanism: row.validation.mechanism,
        value: row.validation.value,
        validation: row.validation,
        ...(row.angleId ? { angleId: row.angleId } : {}),
      },
    ];
  });
}

export function relevantFromPeer(peer: CrossIdeaPeer, angleId?: string): RelevantIdea {
  return {
    code: peer.code,
    statement: peer.statement,
    concept: peer.concept,
    mechanism: peer.mechanism,
    value: peer.value,
    decision: peer.validation.decision,
    sameAngle: peer.angleId && angleId ? peer.angleId === angleId : true,
  };
}

export function withComparedIdeaId(validation: IdeaValidation, ids: ReadonlyMap<string, string>): IdeaValidation {
  const duplicate = validation.duplicate;
  if (!duplicate || duplicate.comparedIdeaId) return validation;
  const comparedIdeaId = ids.get(duplicate.comparedCode.toUpperCase());
  if (!comparedIdeaId) return validation;
  return { ...validation, duplicate: { ...duplicate, comparedIdeaId } };
}

export function applyCrossStatus(
  validation: IdeaValidation,
  crossIdea: IdeaValidation["crossIdea"],
  decisionReasonText = "The comparison across ideas could not be checked.",
): IdeaValidation {
  if (crossIdea === "PASS") return { ...validation, crossIdea: "PASS" };
  if (validation.decision === "DITOLAK") return { ...validation, crossIdea };
  if (crossIdea === "BELUM_TERVERIFIKASI" && validation.decision === "LOLOS") {
    return {
      ...validation,
      crossIdea,
      decision: "BELUM_TERVERIFIKASI",
      decisionReason: decisionReasonText,
    };
  }
  return { ...validation, crossIdea };
}

export function rejectAsDuplicate(validation: IdeaValidation, duplicate: DuplicateConceptRecord): IdeaValidation {
  const evidence = `${duplicate.comparedCode}: ${duplicate.comparedStatement}`;
  const explanation = [
    "DUPLICATE_CONCEPT",
    duplicate.reason,
    `Same concept: ${duplicate.sameConcept}.`,
    `Overlapping mechanism: ${duplicate.overlappingMechanism}.`,
    `Overlapping value: ${duplicate.overlappingValue}.`,
  ].join(" ");
  const weakness = "The difference does not change the concept, the mechanism, or the value.";
  const reason = formatAuditReason({ status: "FAIL", evidence, explanation, weakness });
  const criteria = validation.criteria.map((criterion) =>
    criterion.id === "K5"
      ? { ...criterion, status: "FAIL" as const, reason, evidence, explanation, weakness }
      : criterion,
  );
  return seal(
    {
      ...validation,
      criteria,
      classification: "DUPLICATE_CONCEPT",
      duplicate,
      crossIdea: "FAIL",
    },
    validation.validatedAt,
  );
}

function duplicateFrom(raw: unknown, peers: readonly Array<{ id: string; code: string; statement: string }>): DuplicateConceptRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as {
    code?: unknown;
    comparedCode?: unknown;
    sameConcept?: unknown;
    overlappingMechanism?: unknown;
    overlappingValue?: unknown;
    reason?: unknown;
  };
  const comparedCode = text(row.comparedCode);
  const sameConcept = text(row.sameConcept);
  const overlappingMechanism = text(row.overlappingMechanism);
  const overlappingValue = text(row.overlappingValue);
  const reason = text(row.reason);
  if (!text(row.code) || !comparedCode || !sameConcept || !overlappingMechanism || !overlappingValue || !reason) return null;
  const peer = peers.find((item) => item.code.toUpperCase() === comparedCode.toUpperCase());
  if (!peer) return null;
  return {
    code: "DUPLICATE_CONCEPT",
    comparedIdeaId: peer.id,
    comparedCode: peer.code,
    comparedStatement: peer.statement,
    sameConcept,
    overlappingMechanism,
    overlappingValue,
    reason,
  };
}

export function buildCrossIdeaPrompt(candidates: readonly CrossIdeaCandidate[], peers: readonly CrossIdeaPeer[]): string {
  const line = (row: { code: string; statement: string; concept: string; mechanism: string; value: string }) =>
    `${row.code}: ${row.statement}\nConcept: ${row.concept || "(none)"}\nMechanism: ${row.mechanism || "(none)"}\nValue: ${row.value || "(none)"}`;
  return [
    "Compare ideas by substance. Do this after each idea has already been checked on K1 through K7.",
    "Group only ideas that share the same core concept. The same topic or the same Big Thought is not the same concept.",
    "Compare passed ideas, rejected ideas, and relevant ideas that are not yet verified.",
    "A different title, wording, visualization, delivery format, or emphasis of the communication is not a substantive difference. Mark that DUPLICATE_CONCEPT.",
    "When an idea differs only in part but its mechanism and its value are meaningfully new, leave it out of the group and the keeper's note must name that difference.",
    "A different mechanism is a substantive difference only when it changes how the idea works or the value it produces.",
    "From each group, keep the one strongest idea by completeness and strategic relevance.",
    "Mark the others as duplicates of that keeper.",
    "Every duplicate needs the same core concept, the overlapping mechanism, the overlapping value, and a specific reason.",
    "Do not invent a duplicate. If the substance differs, leave it out of every group.",
    'Return JSON only: {"groups":[{"keeperCode":"ID01","duplicates":[{"code":"ID02","comparedCode":"ID01","sameConcept":"...","overlappingMechanism":"...","overlappingValue":"...","reason":"..."}]}]}',
    "When nothing shares a core concept, return {\"groups\":[]}.",
    "",
    "Candidates in this batch:",
    candidates.length ? candidates.map(line).join("\n\n") : "(none)",
    "",
    "Ideas already passed or rejected:",
    peers.length ? peers.map(line).join("\n\n") : "(none)",
  ].join("\n");
}

export function applyCrossIdeaGroups(
  candidates: readonly CrossIdeaCandidate[],
  peers: readonly CrossIdeaPeer[],
  raw: unknown,
): CrossIdeaCandidate[] | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const groups = (raw as { groups?: unknown }).groups;
  if (!Array.isArray(groups)) return null;
  const catalog = [
    ...candidates.map((row) => ({ id: "", code: row.code, statement: row.statement })),
    ...peers.map((row) => ({ id: row.id, code: row.code, statement: row.statement })),
  ];
  const next = candidates.map((candidate) => ({
    ...candidate,
    validation: applyCrossStatus(candidate.validation, "PASS"),
  }));
  for (const group of groups) {
    if (!group || typeof group !== "object") continue;
    const keeperCode = text((group as { keeperCode?: unknown }).keeperCode);
    const members = (group as { duplicates?: unknown }).duplicates;
    if (!keeperCode || !catalog.some((item) => item.code.toUpperCase() === keeperCode.toUpperCase()) || !Array.isArray(members)) continue;
    for (const member of members) {
      const duplicate = duplicateFrom(member, catalog);
      const code = text((member as { code?: unknown })?.code);
      if (!duplicate || code.toUpperCase() === keeperCode.toUpperCase()) continue;
      const index = next.findIndex((candidate) => candidate.code.toUpperCase() === code.toUpperCase());
      if (index < 0) continue;
      next[index] = { ...next[index], validation: rejectAsDuplicate(next[index].validation, duplicate) };
    }
  }
  return next;
}

export async function judgeCrossIdeas(input: {
  candidates: readonly CrossIdeaCandidate[];
  peers: readonly CrossIdeaPeer[];
  historyAvailable?: boolean;
  ask: (prompt: string) => Promise<string | null>;
}): Promise<CrossIdeaCandidate[]> {
  if (input.candidates.length === 0) return [];
  if (input.historyAvailable === false) {
    return input.candidates.map((candidate) => ({
      ...candidate,
      validation: applyCrossStatus(
        candidate.validation,
        "BELUM_TERVERIFIKASI",
        "The comparison history could not be loaded, so this check is not complete.",
      ),
    }));
  }
  const script = await input.ask(buildCrossIdeaPrompt(input.candidates, input.peers));
  const applied = applyCrossIdeaGroups(input.candidates, input.peers, script ? parseModelJson(script) : null);
  if (!applied) return input.candidates.map((candidate) => ({ ...candidate, validation: applyCrossStatus(candidate.validation, "BELUM_TERVERIFIKASI") }));
  return applied;
}

export function auditVerdictForValidation(validation: IdeaValidation): "AUDIT_PASS" | "AUDIT_FAIL" | "UNRESOLVED" {
  if (validation.decision === "DITOLAK" || validation.criteria.some((criterion) => criterion.status === "FAIL")) return "AUDIT_FAIL";
  const passed = IDEA_CRITERIA.every((id) => validation.criteria.find((criterion) => criterion.id === id)?.status === "PASS");
  if (passed && validation.decision === "LOLOS") return "AUDIT_PASS";
  return "UNRESOLVED";
}

export function auditSnapshot(validation: IdeaValidation): IdeaAuditSnapshot {
  return {
    statement: validation.statement,
    criteria: validation.criteria.map((criterion) => ({ ...criterion })),
    decision: validation.decision,
    classification: validation.classification,
    duplicate: validation.duplicate,
    validatorVersion: validation.validatorVersion,
    validatedAt: validation.validatedAt,
  };
}

/** Keeps the previous audit and links the new one. The latest decision stays on the idea row. */
export function withAuditHistory(previous: IdeaValidation | null, next: IdeaValidation): IdeaValidation {
  if (!previous) return { ...next, auditHistory: next.auditHistory ?? [] };
  const older = previous.auditHistory ?? [];
  const snapshot = auditSnapshot(previous);
  const history = [snapshot, ...older.filter((item) => item.validatedAt !== snapshot.validatedAt)];
  return { ...next, auditHistory: history };
}

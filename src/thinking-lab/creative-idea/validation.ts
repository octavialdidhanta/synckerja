import { hasHowIfOpening } from "@/thinking-lab/idea/validation";
import { parseModelJson } from "@/thinking-lab/shared/ai";
import type {
  CreativeCriterion,
  CreativeCriterionId,
  CreativeCriterionStatus,
  CreativeDecision,
  CreativeDraft,
  CreativeFormat,
  CreativeValidation,
} from "@/thinking-lab/creative-idea/types";
import {
  CREATIVE_CRITERIA,
  CREATIVE_GENERATOR_VERSION,
  CREATIVE_VALIDATION_SCHEMA,
  CREATIVE_VALIDATOR_VERSION,
} from "@/thinking-lab/creative-idea/types";

const RULES: Record<CreativeCriterionId, string> = {
  CK1: "PASS when the creative idea keeps the substance of the conceptual idea. FAIL when it replaces, blurs, or contradicts that core.",
  CK2: "PASS when the creative mechanism fits the selected pillar and can work in the selected format. FAIL when the pillar is only a label, or the format is forced so the idea loses its strength.",
  CK3: "PASS when a specific creative mechanism produces an audience experience and the statement opens as a how-if. FAIL when it is only a topic, premise, hook, title, production activity, or delivery technique without a core idea.",
  CK4: "PASS when the idea is understandable and has a plausible behavior or situation for the stored audience. FAIL when it depends on behavior too far from that audience without enough context. Do not fail fiction, metaphor, or imagination only because it is not literal. Use only the stored Master Thought texts to identify the audience. Do not invent one.",
  CK5: "PASS when the idea can become content in the selected format with resources that exist or can reasonably be prepared. FAIL when execution cannot be made without replacing the core idea.",
};

export type CreativePeer = {
  code: string;
  statement: string;
  concept: string;
  mechanism: string;
  value: string;
  decision: CreativeDecision | null;
};

export type CreativeFailureItem = {
  code: string;
  statement: string;
  decision: CreativeDecision;
  failed: Array<{ id: CreativeCriterionId; reason: string }>;
};

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function clip(value: string, limit: number): string {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > limit ? text.slice(0, limit) : text;
}

function substanceKey(parts: { concept: string; mechanism: string; value: string }): string {
  return [parts.concept, parts.mechanism, parts.value].map((part) => part.trim().toLowerCase()).join("|");
}

export function sameCreativeSubstance(
  left: { concept: string; mechanism: string; value: string },
  right: { concept: string; mechanism: string; value: string },
): boolean {
  const key = substanceKey(left);
  return key !== "||" && key === substanceKey(right);
}

export function decideCreativeChecks(
  checks: ReadonlyArray<{ id: CreativeCriterionId; status: CreativeCriterionStatus }>,
): CreativeDecision {
  const byId = new Map(checks.map((check) => [check.id, check.status]));
  const ck1 = byId.get("CK1") ?? "BELUM_TERVERIFIKASI";
  const ck2 = byId.get("CK2") ?? "BELUM_TERVERIFIKASI";
  if (ck1 === "FAIL" || ck2 === "FAIL") return "REJECTED";
  if (ck1 !== "PASS" || ck2 !== "PASS") return "NOT_VERIFIED";
  const passed = CREATIVE_CRITERIA.filter((id) => byId.get(id) === "PASS").length;
  if (passed >= 5) return "READY";
  if (passed === 4) return "NEEDS_REFINEMENT";
  return "REVISE";
}

export function canEnterExecution(decision: CreativeDecision | null | undefined): boolean {
  return decision === "READY";
}

function readStatus(value: unknown): CreativeCriterionStatus | null {
  const text = asText(value).toUpperCase().replace(/[\s-]+/g, "_");
  if (text === "PASS" || text === "LOLOS") return "PASS";
  if (text === "FAIL" || text === "DITOLAK") return "FAIL";
  if (text === "BELUM_TERVERIFIKASI" || text === "BELUM" || text === "UNVERIFIED" || text === "NOT_VERIFIED") {
    return "BELUM_TERVERIFIKASI";
  }
  return null;
}

export function criteriaFromModel(raw: unknown): CreativeCriterion[] | null {
  const row = asRecord(raw);
  const list = Array.isArray(raw) ? raw : Array.isArray(row?.criteria) ? row.criteria : null;
  if (!list) return null;
  const found = new Map<CreativeCriterionId, CreativeCriterion>();
  for (const item of list) {
    const entry = asRecord(item);
    if (!entry) continue;
    const id = asText(entry.id).toUpperCase() as CreativeCriterionId;
    if (!CREATIVE_CRITERIA.includes(id) || found.has(id)) continue;
    const status = readStatus(entry.status);
    const reason = clip(asText(entry.reason), 500);
    if (!status || (status !== "BELUM_TERVERIFIKASI" && !reason)) {
      found.set(id, { id, status: "BELUM_TERVERIFIKASI", reason: reason || "This check could not be decided." });
      continue;
    }
    found.set(id, { id, status, reason: reason || "This check could not be decided." });
  }
  if (found.size === 0) return null;
  return CREATIVE_CRITERIA.map(
    (id) => found.get(id) ?? { id, status: "BELUM_TERVERIFIKASI", reason: "This check could not be decided." },
  );
}

export function applyCreativeGates(
  criteria: CreativeCriterion[],
  input: { statement: string; parentStatement: string; concept: string; mechanism: string; value: string; peers: readonly CreativePeer[] },
): CreativeCriterion[] {
  return criteria.map((criterion) => {
    if (criterion.id === "CK3" && !hasHowIfOpening(input.statement, input.parentStatement)) {
      return {
        id: "CK3",
        status: "FAIL",
        reason: "The creative idea does not open with a how-if, so it is not yet a creative idea.",
      };
    }
    if (
      criterion.id === "CK3" &&
      input.peers.some((peer) =>
        sameCreativeSubstance(input, { concept: peer.concept, mechanism: peer.mechanism, value: peer.value }),
      )
    ) {
      return {
        id: "CK3",
        status: "FAIL",
        reason: "This repeats a creative idea already saved for this pillar and format.",
      };
    }
    return criterion;
  });
}

export function creativeValidationFromCriteria(
  criteria: CreativeCriterion[],
  draft: CreativeDraft,
): CreativeValidation {
  const decision = decideCreativeChecks(criteria);
  const recommendation =
    decision === "READY"
      ? ""
      : criteria.find((criterion) => criterion.status !== "PASS")?.reason ?? "";
  return {
    schema: CREATIVE_VALIDATION_SCHEMA,
    criteria,
    decision,
    recommendation,
    title: draft.title.trim(),
    concept: draft.concept.trim(),
    mechanism: draft.mechanism.trim(),
    value: draft.value.trim(),
    generatorVersion: CREATIVE_GENERATOR_VERSION,
    validatorVersion: CREATIVE_VALIDATOR_VERSION,
    validatedAt: new Date().toISOString(),
    statement: draft.statement.trim(),
  };
}

export function readCreativeValidation(raw: unknown): CreativeValidation | null {
  const row = asRecord(raw);
  if (!row || row.schema !== CREATIVE_VALIDATION_SCHEMA) return null;
  const criteria = criteriaFromModel(row);
  if (!criteria) return null;
  const decision = decideCreativeChecks(criteria);
  return {
    schema: CREATIVE_VALIDATION_SCHEMA,
    criteria,
    decision,
    recommendation: asText(row.recommendation),
    title: asText(row.title),
    concept: asText(row.concept),
    mechanism: asText(row.mechanism),
    value: asText(row.value),
    generatorVersion: CREATIVE_GENERATOR_VERSION,
    validatorVersion: CREATIVE_VALIDATOR_VERSION,
    validatedAt: asText(row.validatedAt),
    statement: asText(row.statement),
  };
}

export function creativeFailureItems(
  rows: ReadonlyArray<{
    code: string;
    statement: string;
    contentPillarId: string;
    format: CreativeFormat;
    validation: CreativeValidation | null;
  }>,
  contentPillarId: string,
  format: CreativeFormat,
): CreativeFailureItem[] {
  return rows.flatMap((row) => {
    if (row.contentPillarId !== contentPillarId || row.format !== format || !row.validation) return [];
    if (row.validation.decision === "READY") return [];
    const failed = row.validation.criteria
      .filter((criterion) => criterion.status !== "PASS")
      .map((criterion) => ({ id: criterion.id, reason: criterion.reason }));
    if (failed.length === 0) return [];
    return [{ code: row.code, statement: row.statement, decision: row.validation.decision, failed }];
  });
}

export function buildCreativeValidationPrompt(input: {
  draft: CreativeDraft;
  parentStatement: string;
  parentConcept: string;
  parentMechanism: string;
  parentValue: string;
  pillarName: string;
  format: CreativeFormat;
  masterThought: string;
  audience: string;
  priorBelief: string;
  rootBelief: string;
  bigThought: string;
  territory: string;
  angle: string;
}): string {
  return [
    "Check this creative idea one criterion at a time. Do not average them.",
    "A missing or empty reason is BELUM_TERVERIFIKASI. Do not pass on an assumption.",
    "Use only the stored Master Thought texts for the audience. Do not invent an audience from the idea, Territory, Angle, or Big Thought.",
    ...CREATIVE_CRITERIA.map((id) => `${id}. ${RULES[id]}`),
    "Return JSON only:",
    JSON.stringify({ criteria: CREATIVE_CRITERIA.map((id) => ({ id, status: "PASS", reason: "" })), recommendation: "" }),
    "",
    `Pillar: ${input.pillarName.trim()}`,
    `Format: ${input.format}`,
    "",
    "Conceptual idea:",
    input.parentStatement.trim(),
    ...(input.parentConcept.trim() ? [`Concept: ${input.parentConcept.trim()}`] : []),
    ...(input.parentMechanism.trim() ? [`Mechanism: ${input.parentMechanism.trim()}`] : []),
    ...(input.parentValue.trim() ? [`Value: ${input.parentValue.trim()}`] : []),
    "",
    "Master Thought:",
    input.masterThought.trim() || "(not stored)",
    `Audience: ${input.audience.trim() || "(not stored)"}`,
    `Prior belief: ${input.priorBelief.trim() || "(not stored)"}`,
    `Root belief: ${input.rootBelief.trim() || "(not stored)"}`,
    `Big Thought: ${input.bigThought.trim() || "(not stored)"}`,
    `Territory: ${input.territory.trim() || "(not stored)"}`,
    `Angle: ${input.angle.trim() || "(not stored)"}`,
    "",
    "Creative idea:",
    input.draft.statement.trim(),
    ...(input.draft.title.trim() ? [`Title: ${input.draft.title.trim()}`] : []),
    ...(input.draft.concept.trim() ? [`Concept: ${input.draft.concept.trim()}`] : []),
    ...(input.draft.mechanism.trim() ? [`Mechanism: ${input.draft.mechanism.trim()}`] : []),
    ...(input.draft.value.trim() ? [`Value: ${input.draft.value.trim()}`] : []),
  ].join("\n");
}

export function sealCreativeValidation(
  raw: unknown,
  draft: CreativeDraft,
  gate: { statement: string; parentStatement: string; concept: string; mechanism: string; value: string; peers: readonly CreativePeer[] },
): CreativeValidation | null {
  const criteria = criteriaFromModel(raw);
  if (!criteria) return null;
  return creativeValidationFromCriteria(applyCreativeGates(criteria, { ...gate, statement: draft.statement }), draft);
}

export async function judgeCreativeDraft(input: {
  draft: CreativeDraft;
  parentStatement: string;
  parentConcept: string;
  parentMechanism: string;
  parentValue: string;
  pillarName: string;
  format: CreativeFormat;
  masterThought: string;
  audience: string;
  priorBelief: string;
  rootBelief: string;
  bigThought: string;
  territory: string;
  angle: string;
  peers: readonly CreativePeer[];
  ask: (prompt: string) => Promise<string | null>;
}): Promise<CreativeValidation> {
  const prompt = buildCreativeValidationPrompt(input);
  const gate = {
    statement: input.draft.statement,
    parentStatement: input.parentStatement,
    concept: input.draft.concept,
    mechanism: input.draft.mechanism,
    value: input.draft.value,
    peers: input.peers,
  };
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const raw = await input.ask(prompt);
    const sealed = sealCreativeValidation(raw ? parseModelJson(raw) : null, input.draft, gate);
    if (sealed) return sealed;
  }
  return creativeValidationFromCriteria(
    applyCreativeGates(
      CREATIVE_CRITERIA.map((id) => ({ id, status: "BELUM_TERVERIFIKASI", reason: "This check could not be decided." })),
      gate,
    ),
    input.draft,
  );
}

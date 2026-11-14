import { readGateFailure } from "./checklist";
import type { Resolution, TriState } from "../shared/verdict";
import type { BigThoughtFacts, ParentRelation } from "./types";

const RELATIONS = new Set<ParentRelation>([
  "DISTINCT_MATERIAL_SUPPORT",
  "RESTATEMENT",
  "ELABORATION",
  "OUTCOME",
  "CONSEQUENCE",
  "METHOD",
  "CRITERION",
  "EXAMPLE",
  "TACTIC",
  "EXECUTION",
  "DUPLICATE",
  "UNSUPPORTED_PREMISE",
  "UNRESOLVED",
]);

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asTri(value: unknown): TriState {
  if (value === true || value === false) return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return "unresolved";
}

function asResolution(value: unknown): Resolution {
  return value === "RESOLVED" || value === "UNRESOLVED" ? value : "UNRESOLVED";
}

function asReasons(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((row) => asText(row)).filter(Boolean);
}

function asRelation(value: unknown): ParentRelation {
  return typeof value === "string" && RELATIONS.has(value as ParentRelation)
    ? (value as ParentRelation)
    : "UNRESOLVED";
}

export function unresolvedBigThought(code: string, reason: string): BigThoughtFacts {
  return {
    code,
    whatItSays: "",
    relationToParent: "UNRESOLVED",
    explainsWhyParentIsTrue: "unresolved",
    introducesUnsupportedPremise: "unresolved",
    duplicateOfCode: null,
    resolution: "UNRESOLVED",
    unresolvedReasons: [reason],
  };
}

export function normalizeBigThoughtFacts(raw: unknown, fallbackCode = ""): BigThoughtFacts {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return unresolvedBigThought(fallbackCode, "JUDGE_UNPARSEABLE");
  }
  const row = raw as Record<string, unknown>;
  const code = asText(row.code) || fallbackCode;
  const rawRelation = asText(row.relationToParent);
  const legacyPositive = rawRelation === "DISTINCT_FOUNDATIONAL_WHY";
  const facts: BigThoughtFacts = {
    code,
    whatItSays: asText(row.whatItSays),
    relationToParent: legacyPositive ? "UNRESOLVED" : asRelation(rawRelation),
    explainsWhyParentIsTrue: legacyPositive ? "unresolved" : asTri(row.explainsWhyParentIsTrue),
    introducesUnsupportedPremise: asTri(row.introducesUnsupportedPremise),
    duplicateOfCode: asText(row.duplicateOfCode) || null,
    resolution: asResolution(row.resolution),
    unresolvedReasons: asReasons(row.unresolvedReasons),
  };
  const answeredQuestion = asText(row.answeredQuestion);
  if (answeredQuestion) facts.answeredQuestion = answeredQuestion;
  const answeredQuestionVersion = row.answeredQuestionVersion;
  if (typeof answeredQuestionVersion === "number" && Number.isFinite(answeredQuestionVersion)) {
    facts.answeredQuestionVersion = answeredQuestionVersion;
  }
  const gateFailure = readGateFailure(row.gateFailure);
  if (gateFailure) facts.gateFailure = gateFailure;
  else if (row.passConfirmed === true) facts.passConfirmed = true;
  if (legacyPositive) {
    facts.resolution = "UNRESOLVED";
    if (!facts.unresolvedReasons.includes("LEGACY_POSITIVE_RELATION")) {
      facts.unresolvedReasons = [...facts.unresolvedReasons, "LEGACY_POSITIVE_RELATION"];
    }
  }
  if (facts.resolution === "RESOLVED" && facts.relationToParent === "UNRESOLVED") {
    facts.resolution = "UNRESOLVED";
    facts.unresolvedReasons = [...facts.unresolvedReasons, "RELATION_UNRESOLVED"];
  }
  if (facts.resolution !== "RESOLVED" || facts.relationToParent === "UNRESOLVED") {
    facts.introducesUnsupportedPremise = "unresolved";
  } else if (facts.relationToParent === "UNSUPPORTED_PREMISE") {
    facts.introducesUnsupportedPremise = true;
  }
  return facts;
}

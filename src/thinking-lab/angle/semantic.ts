import { readAngleGeneratePasses } from "./passChecklist";
import { normalizeAngleExample } from "./example";
import { normalizeAngleSubject } from "./subject";
import type {
  AngleBoundedness,
  AngleConceptualForm,
  AngleIdeaGenerativity,
  AngleJobForm,
  AngleRelation,
  AngleResolution,
  AngleSemanticFacts,
  AngleTriState,
} from "./types";

const CONCEPTUAL_FORMS = [
  "ANGLE_PROPOSITION",
  "TERRITORY_LIKE",
  "BIG_THOUGHT_LIKE",
  "IDEA_LIKE",
  "EXECUTION_LIKE",
  "UNRESOLVED",
] as const satisfies readonly AngleConceptualForm[];

const IDEA_GENERATIVITY = ["SUFFICIENT", "INSUFFICIENT", "UNRESOLVED"] as const satisfies readonly AngleIdeaGenerativity[];

const BOUNDEDNESS = ["BOUNDED", "UNBOUNDED", "UNRESOLVED"] as const satisfies readonly AngleBoundedness[];

const JOB_FORMS = ["OBSERVATION", "REASON", "TERRITORY_SUMMARY", "UNRESOLVED"] as const satisfies readonly AngleJobForm[];

type CanonicalInput = Pick<
  AngleSemanticFacts,
  "parentFit" | "conceptualForm" | "ideaGenerativity" | "boundedness" | "jobForm"
>;

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asConfidence(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asReasons(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((row) => asText(row)).filter(Boolean);
}

function tokensOf(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [value];
}

function exclusiveMatch<T extends string>(value: unknown, allowed: readonly T[]): { value: T | null; contradictory: boolean } {
  if (value == null || value === "") return { value: null, contradictory: false };
  const tokens = tokensOf(value);
  const recognized = tokens.flatMap((token) => {
    if (typeof token !== "string") return [];
    const match = allowed.find((item) => item === token.trim());
    return match ? [match] : [];
  });
  const unique = [...new Set(recognized)];
  if (unique.length > 1) return { value: null, contradictory: true };
  const hasUnknown = tokens.some((token) => {
    if (typeof token !== "string") return true;
    return !allowed.some((item) => item === token.trim());
  });
  if (hasUnknown) return { value: null, contradictory: false };
  return { value: unique[0] ?? null, contradictory: false };
}

function readTriState(value: unknown): { value: AngleTriState; contradictory: boolean } {
  if (value == null || value === "") return { value: "unresolved", contradictory: false };
  const tokens = tokensOf(value);
  const recognized = tokens.flatMap((token): AngleTriState[] => {
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
  const hasUnknown = tokens.some((token) => {
    if (token === true || token === false) return false;
    if (typeof token !== "string") return true;
    const normalized = token.trim().toLowerCase();
    return normalized !== "true" && normalized !== "false" && normalized !== "unresolved";
  });
  if (hasUnknown) return { value: "unresolved", contradictory: false };
  return { value: unique[0] ?? "unresolved", contradictory: false };
}

function unresolvedAngle(code: string, reason: string): AngleSemanticFacts {
  return {
    code,
    whatItSays: "",
    relationToParent: "UNRESOLVED",
    parentFit: "unresolved",
    conceptualForm: "UNRESOLVED",
    ideaGenerativity: "UNRESOLVED",
    boundedness: "UNRESOLVED",
    jobForm: "UNRESOLVED",
    resolution: "UNRESOLVED",
    unresolvedReasons: [reason],
    subject: "",
    example: "",
  };
}

type FactState<T> = { value: T; contradictory: boolean };

type AngleFactStates = {
  parentFit: FactState<AngleTriState>;
  conceptualForm: FactState<AngleConceptualForm>;
  ideaGenerativity: FactState<AngleIdeaGenerativity>;
  boundedness: FactState<AngleBoundedness>;
  jobForm: FactState<AngleJobForm>;
};

function deriveAngleGates(states: AngleFactStates): { relation: AngleRelation; blockedByContradiction: boolean } {
  const unresolved = { relation: "UNRESOLVED" as const, blockedByContradiction: false };
  const contradicted = { relation: "UNRESOLVED" as const, blockedByContradiction: true };
  if (states.parentFit.contradictory) return contradicted;
  if (states.parentFit.value === false) return { relation: "OUT_OF_PARENT_SCOPE", blockedByContradiction: false };
  if (states.parentFit.value !== true) return unresolved;
  if (states.conceptualForm.contradictory) return contradicted;
  if (states.conceptualForm.value === "BIG_THOUGHT_LIKE") return { relation: "BIG_THOUGHT_LIKE", blockedByContradiction: false };
  if (states.conceptualForm.value === "TERRITORY_LIKE") return { relation: "TERRITORY_LIKE", blockedByContradiction: false };
  if (states.conceptualForm.value === "IDEA_LIKE") return { relation: "IDEA_LIKE", blockedByContradiction: false };
  if (states.conceptualForm.value === "EXECUTION_LIKE") return { relation: "EXECUTION_LIKE", blockedByContradiction: false };
  if (states.conceptualForm.value !== "ANGLE_PROPOSITION") return unresolved;
  if (states.ideaGenerativity.contradictory) return contradicted;
  if (states.ideaGenerativity.value === "INSUFFICIENT") {
    return { relation: "INSUFFICIENT_IDEA_GENERATIVITY", blockedByContradiction: false };
  }
  if (states.ideaGenerativity.value !== "SUFFICIENT") return unresolved;
  if (states.boundedness.contradictory) return contradicted;
  if (states.boundedness.value === "UNBOUNDED") return { relation: "UNBOUNDED_ANGLE", blockedByContradiction: false };
  if (states.boundedness.value !== "BOUNDED") return unresolved;
  if (states.jobForm.contradictory) return contradicted;
  if (states.jobForm.value === "REASON") return { relation: "BIG_THOUGHT_LIKE", blockedByContradiction: false };
  if (states.jobForm.value === "TERRITORY_SUMMARY") return { relation: "TERRITORY_LIKE", blockedByContradiction: false };
  if (states.jobForm.value !== "OBSERVATION") return unresolved;
  return { relation: "VALID_ANGLE", blockedByContradiction: false };
}

export function deriveAngleRelation(facts: CanonicalInput): AngleRelation {
  return deriveAngleGates({
    parentFit: { value: facts.parentFit, contradictory: false },
    conceptualForm: { value: facts.conceptualForm, contradictory: false },
    ideaGenerativity: { value: facts.ideaGenerativity, contradictory: false },
    boundedness: { value: facts.boundedness, contradictory: false },
    jobForm: { value: facts.jobForm, contradictory: false },
  }).relation;
}

function unresolvedFactReasons(facts: CanonicalInput): string[] {
  const reasons: string[] = [];
  if (facts.parentFit === "unresolved") reasons.push("PARENT_FIT_UNRESOLVED");
  if (facts.conceptualForm === "UNRESOLVED") reasons.push("CONCEPTUAL_FORM_UNRESOLVED");
  if (facts.ideaGenerativity === "UNRESOLVED") reasons.push("IDEA_GENERATIVITY_UNRESOLVED");
  if (facts.boundedness === "UNRESOLVED") reasons.push("BOUNDEDNESS_UNRESOLVED");
  if (facts.jobForm === "UNRESOLVED") reasons.push("JOB_FORM_UNRESOLVED");
  return reasons;
}

function resolutionFor(relation: AngleRelation): AngleResolution {
  return relation === "UNRESOLVED" ? "UNRESOLVED" : "RESOLVED";
}

export function normalizeAngleFacts(raw: unknown, fallbackCode = ""): AngleSemanticFacts {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return unresolvedAngle(fallbackCode, "JUDGE_UNPARSEABLE");
  }
  const row = raw as Record<string, unknown>;
  const code = asText(row.code) || fallbackCode;
  const whatItSays = asText(row.whatItSays);
  const confidence = asConfidence(row.confidence);
  const parentFit = readTriState(row.parentFit);
  const conceptualForm = exclusiveMatch(row.conceptualForm, CONCEPTUAL_FORMS);
  const ideaGenerativity = exclusiveMatch(row.ideaGenerativity, IDEA_GENERATIVITY);
  const boundedness = exclusiveMatch(row.boundedness, BOUNDEDNESS);
  const jobForm = exclusiveMatch(row.jobForm, JOB_FORMS);
  const canonical: CanonicalInput = {
    parentFit: parentFit.value,
    conceptualForm: conceptualForm.value ?? "UNRESOLVED",
    ideaGenerativity: ideaGenerativity.value ?? "UNRESOLVED",
    boundedness: boundedness.value ?? "UNRESOLVED",
    jobForm: jobForm.value ?? "UNRESOLVED",
  };
  const derived = deriveAngleGates({
    parentFit,
    conceptualForm: { value: canonical.conceptualForm, contradictory: conceptualForm.contradictory },
    ideaGenerativity: { value: canonical.ideaGenerativity, contradictory: ideaGenerativity.contradictory },
    boundedness: { value: canonical.boundedness, contradictory: boundedness.contradictory },
    jobForm: { value: canonical.jobForm, contradictory: jobForm.contradictory },
  });
  const relationToParent = derived.relation;
  const facts: AngleSemanticFacts = {
    code,
    whatItSays,
    relationToParent,
    ...canonical,
    resolution: resolutionFor(relationToParent),
    unresolvedReasons:
      relationToParent !== "UNRESOLVED"
        ? []
        : derived.blockedByContradiction
          ? [...new Set(["CONTRADICTORY_CANONICAL_FACTS", ...asReasons(row.unresolvedReasons)])]
          : [...new Set([...asReasons(row.unresolvedReasons), ...unresolvedFactReasons(canonical)])],
    subject: normalizeAngleSubject(asText(row.subject)),
    example: normalizeAngleExample(asText(row.example)),
  };
  if (confidence !== undefined) facts.confidence = confidence;
  const generatePasses = readAngleGeneratePasses(row.generatePasses);
  if (generatePasses.length > 0) facts.generatePasses = generatePasses;
  return facts;
}

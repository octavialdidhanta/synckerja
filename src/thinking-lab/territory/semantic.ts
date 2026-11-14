import { readTerritoryGeneratePasses } from "./passChecklist";
import type {
  TerritoryAudienceLanguage,
  TerritoryBoundedness,
  TerritoryConceptualForm,
  TerritoryGenerativity,
  TerritoryNominalForm,
  TerritoryRelation,
  TerritoryResolution,
  TerritorySemanticFacts,
  TerritoryTriState,
} from "./types";

const CONCEPTUAL_FORMS = [
  "TERRITORY_SPACE",
  "BIG_THOUGHT_LIKE",
  "ANGLE_LIKE",
  "DOWNSTREAM_EXECUTION_LIKE",
  "UNRESOLVED",
] as const satisfies readonly TerritoryConceptualForm[];

const GENERATIVITY = ["SUFFICIENT", "INSUFFICIENT", "UNRESOLVED"] as const satisfies readonly TerritoryGenerativity[];

const BOUNDEDNESS = ["BOUNDED", "UNBOUNDED", "UNRESOLVED"] as const satisfies readonly TerritoryBoundedness[];

const NOMINAL_FORMS = ["NOMINAL", "CLAIM", "UNRESOLVED"] as const satisfies readonly TerritoryNominalForm[];

const AUDIENCE_LANGUAGES = ["AUDIENCE", "INTERNAL", "UNRESOLVED"] as const satisfies readonly TerritoryAudienceLanguage[];

type CanonicalInput = Pick<
  TerritorySemanticFacts,
  | "parentFit"
  | "conceptualForm"
  | "parentScopeDuplication"
  | "generativity"
  | "boundedness"
  | "nominalForm"
  | "audienceLanguage"
  | "livedQuestion"
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

function readTriState(value: unknown): { value: TerritoryTriState; contradictory: boolean } {
  if (value == null || value === "") return { value: "unresolved", contradictory: false };
  const tokens = tokensOf(value);
  const recognized = tokens.flatMap((token): TerritoryTriState[] => {
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

function unresolvedTerritory(code: string, reason: string): TerritorySemanticFacts {
  return {
    code,
    whatItSays: "",
    relationToParent: "UNRESOLVED",
    parentFit: "unresolved",
    conceptualForm: "UNRESOLVED",
    parentScopeDuplication: "unresolved",
    generativity: "UNRESOLVED",
    boundedness: "UNRESOLVED",
    nominalForm: "UNRESOLVED",
    audienceLanguage: "UNRESOLVED",
    livedQuestion: "unresolved",
    resolution: "UNRESOLVED",
    unresolvedReasons: [reason],
  };
}

type FactState<T> = { value: T; contradictory: boolean };

type TerritoryFactStates = {
  parentFit: FactState<TerritoryTriState>;
  conceptualForm: FactState<TerritoryConceptualForm>;
  parentScopeDuplication: FactState<TerritoryTriState>;
  generativity: FactState<TerritoryGenerativity>;
  boundedness: FactState<TerritoryBoundedness>;
  nominalForm: FactState<TerritoryNominalForm>;
  audienceLanguage: FactState<TerritoryAudienceLanguage>;
  livedQuestion: FactState<TerritoryTriState>;
};

function deriveTerritoryGates(states: TerritoryFactStates): { relation: TerritoryRelation; blockedByContradiction: boolean } {
  const unresolved = { relation: "UNRESOLVED" as const, blockedByContradiction: false };
  const contradicted = { relation: "UNRESOLVED" as const, blockedByContradiction: true };
  if (states.parentFit.contradictory) return contradicted;
  if (states.parentFit.value === false) return { relation: "OUT_OF_PARENT_SCOPE", blockedByContradiction: false };
  if (states.parentFit.value !== true) return unresolved;
  if (states.conceptualForm.contradictory) return contradicted;
  if (states.conceptualForm.value === "BIG_THOUGHT_LIKE") return { relation: "BIG_THOUGHT_LIKE", blockedByContradiction: false };
  if (states.conceptualForm.value === "ANGLE_LIKE") return { relation: "ANGLE_LIKE", blockedByContradiction: false };
  if (states.conceptualForm.value === "DOWNSTREAM_EXECUTION_LIKE") {
    return { relation: "DOWNSTREAM_EXECUTION_LIKE", blockedByContradiction: false };
  }
  if (states.conceptualForm.value !== "TERRITORY_SPACE") return unresolved;
  if (states.parentScopeDuplication.contradictory) return contradicted;
  if (states.parentScopeDuplication.value === true) return { relation: "PARENT_SCOPE_DUPLICATION", blockedByContradiction: false };
  if (states.parentScopeDuplication.value !== false) return unresolved;
  if (states.generativity.contradictory) return contradicted;
  if (states.generativity.value === "INSUFFICIENT") return { relation: "INSUFFICIENT_GENERATIVITY", blockedByContradiction: false };
  if (states.generativity.value !== "SUFFICIENT") return unresolved;
  if (states.boundedness.contradictory) return contradicted;
  if (states.boundedness.value === "UNBOUNDED") return { relation: "UNBOUNDED_SPACE", blockedByContradiction: false };
  if (states.boundedness.value !== "BOUNDED") return unresolved;
  if (states.nominalForm.contradictory) return contradicted;
  if (states.nominalForm.value === "CLAIM") return { relation: "CLAIM_BEARING", blockedByContradiction: false };
  if (states.nominalForm.value !== "NOMINAL") return unresolved;
  if (states.audienceLanguage.contradictory) return contradicted;
  if (states.audienceLanguage.value === "INTERNAL") return { relation: "INTERNAL_LANGUAGE", blockedByContradiction: false };
  if (states.audienceLanguage.value !== "AUDIENCE") return unresolved;
  if (states.livedQuestion.contradictory) return contradicted;
  if (states.livedQuestion.value === false) return { relation: "QUESTION_NOT_LIVED", blockedByContradiction: false };
  if (states.livedQuestion.value !== true) return unresolved;
  return { relation: "VALID_TERRITORY", blockedByContradiction: false };
}

export function deriveTerritoryRelation(facts: CanonicalInput): TerritoryRelation {
  return deriveTerritoryGates({
    parentFit: { value: facts.parentFit, contradictory: false },
    conceptualForm: { value: facts.conceptualForm, contradictory: false },
    parentScopeDuplication: { value: facts.parentScopeDuplication, contradictory: false },
    generativity: { value: facts.generativity, contradictory: false },
    boundedness: { value: facts.boundedness, contradictory: false },
    nominalForm: { value: facts.nominalForm, contradictory: false },
    audienceLanguage: { value: facts.audienceLanguage, contradictory: false },
    livedQuestion: { value: facts.livedQuestion, contradictory: false },
  }).relation;
}

function unresolvedFactReasons(facts: CanonicalInput): string[] {
  const reasons: string[] = [];
  if (facts.parentFit === "unresolved") reasons.push("PARENT_FIT_UNRESOLVED");
  if (facts.conceptualForm === "UNRESOLVED") reasons.push("CONCEPTUAL_FORM_UNRESOLVED");
  if (facts.parentScopeDuplication === "unresolved") reasons.push("PARENT_SCOPE_DUPLICATION_UNRESOLVED");
  if (facts.generativity === "UNRESOLVED") reasons.push("GENERATIVITY_UNRESOLVED");
  if (facts.boundedness === "UNRESOLVED") reasons.push("BOUNDEDNESS_UNRESOLVED");
  if (facts.nominalForm === "UNRESOLVED") reasons.push("NOMINAL_FORM_UNRESOLVED");
  if (facts.audienceLanguage === "UNRESOLVED") reasons.push("AUDIENCE_LANGUAGE_UNRESOLVED");
  if (facts.livedQuestion === "unresolved") reasons.push("LIVED_QUESTION_UNRESOLVED");
  return reasons;
}

function resolutionFor(relation: TerritoryRelation): TerritoryResolution {
  return relation === "UNRESOLVED" ? "UNRESOLVED" : "RESOLVED";
}

export function normalizeTerritoryFacts(raw: unknown, fallbackCode = ""): TerritorySemanticFacts {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return unresolvedTerritory(fallbackCode, "JUDGE_UNPARSEABLE");
  }
  const row = raw as Record<string, unknown>;
  const code = asText(row.code) || fallbackCode;
  const whatItSays = asText(row.whatItSays);
  const confidence = asConfidence(row.confidence);
  const parentFit = readTriState(row.parentFit);
  const conceptualForm = exclusiveMatch(row.conceptualForm, CONCEPTUAL_FORMS);
  const parentScopeDuplication = readTriState(row.parentScopeDuplication);
  const generativity = exclusiveMatch(row.generativity, GENERATIVITY);
  const boundedness = exclusiveMatch(row.boundedness, BOUNDEDNESS);
  const nominalForm = exclusiveMatch(row.nominalForm, NOMINAL_FORMS);
  const audienceLanguage = exclusiveMatch(row.audienceLanguage, AUDIENCE_LANGUAGES);
  const livedQuestion = readTriState(row.livedQuestion);
  const canonical: CanonicalInput = {
    parentFit: parentFit.value,
    conceptualForm: conceptualForm.value ?? "UNRESOLVED",
    parentScopeDuplication: parentScopeDuplication.value,
    generativity: generativity.value ?? "UNRESOLVED",
    boundedness: boundedness.value ?? "UNRESOLVED",
    nominalForm: nominalForm.value ?? "UNRESOLVED",
    audienceLanguage: audienceLanguage.value ?? "UNRESOLVED",
    livedQuestion: livedQuestion.value,
  };
  const derived = deriveTerritoryGates({
    parentFit,
    conceptualForm: { value: canonical.conceptualForm, contradictory: conceptualForm.contradictory },
    parentScopeDuplication,
    generativity: { value: canonical.generativity, contradictory: generativity.contradictory },
    boundedness: { value: canonical.boundedness, contradictory: boundedness.contradictory },
    nominalForm: { value: canonical.nominalForm, contradictory: nominalForm.contradictory },
    audienceLanguage: { value: canonical.audienceLanguage, contradictory: audienceLanguage.contradictory },
    livedQuestion,
  });
  const relationToParent = derived.relation;
  const facts: TerritorySemanticFacts = {
    code,
    whatItSays,
    areaQuestion: asText(row.areaQuestion),
    relationToParent,
    ...canonical,
    resolution: resolutionFor(relationToParent),
    unresolvedReasons:
      relationToParent !== "UNRESOLVED"
        ? []
        : derived.blockedByContradiction
          ? [...new Set(["CONTRADICTORY_CANONICAL_FACTS", ...asReasons(row.unresolvedReasons)])]
          : [...new Set([...asReasons(row.unresolvedReasons), ...unresolvedFactReasons(canonical)])],
  };
  if (confidence !== undefined) facts.confidence = confidence;
  const generatePasses = readTerritoryGeneratePasses(row.generatePasses);
  if (generatePasses.length > 0) facts.generatePasses = generatePasses;
  return facts;
}

export const TERRITORY_STAKE_LINES = [
  "Name an area in the audience's world: a phenomenon, a habit, a life moment, a culture, or an everyday problem. The name is a noun or a noun phrase with no claim, no lack, and no evaluation. Kurir paket is this kind of name.",
  "Do not put the Big Thought's reason into the name. A name that would stop making sense once the Master Thought stake is removed, including the part of the belief that is not in the subject, has copied that stake.",
  "A noun the audience would use is not rejected only because that name can still be said.",
  "The question this Big Thought answers must come up in the area. The name itself stays an area after that stake is removed. A wide area stays valid when that question comes up there.",
  "The name is at most three words. A requirement is a claim, not an area. A keyword of the Big Thought is not an area.",
];

export function territoryPassLines(audience?: string): string[] {
  const named = audience?.trim() ?? "";
  return [
    "It is part of the Big Thought, not a keyword of the Big Thought.",
    "Use the audience's words, not an internal strategy term. This is a test of words, not of topic.",
    named
      ? "The question answered by the Big Thought must actually show up in that area of this audience's real life. It fails when a different question comes up there, or when the question only restates the Big Thought. Other questions coming up in that area do not make it fail. An area where this Big Thought can still be discussed stays valid when that question shows up."
      : "The question answered by the Big Thought must actually show up in that area of real life. It fails when a different question comes up there, or when the question only restates the Big Thought. Other questions coming up in that area do not make it fail.",
    "It must be wide enough for several different Angles. A narrow place still passes. The Big Thought's own answer is one future Angle, not proof that the place holds only one observation. This fails only when the name itself is already one observation, claim, or method.",
    ...(named ? [`Audience: ${named}`] : []),
  ];
}

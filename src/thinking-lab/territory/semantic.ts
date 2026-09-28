import { parseModelJson } from "@/thinking-lab/shared/ai";
import { ancestorStakeBlock, type AncestorStake } from "@/thinking-lab/shared/ancestorStake";
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
} from "@/thinking-lab/territory/types";

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
  return facts;
}

export function parseTerritoryJudge(script: string | null, code: string): TerritorySemanticFacts {
  if (!script?.trim()) return unresolvedTerritory(code, "JUDGE_UNAVAILABLE");
  const parsed = parseModelJson(script);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return unresolvedTerritory(code, "JUDGE_UNPARSEABLE");
  return normalizeTerritoryFacts(parsed, code);
}

export const TERRITORY_STAKE_LINES = [
  "The area must stop being a place to discuss the reason once the Master Thought stake is removed, including the part of the belief that is not in the subject. Staying close to the Big Thought's broader topic is not enough.",
  "A noun the audience would use is not rejected only because that name can still be said.",
];

export function territoryPassLines(audience?: string): string[] {
  const named = audience?.trim() ?? "";
  return [
    "It is part of the Big Thought, not a keyword of the Big Thought.",
    "Use the audience's words, not an internal strategy term. This is a test of words, not of topic.",
    named
      ? "The question answered by the Big Thought must actually show up in that area of this audience's real life. An area that only fits a different audience fails, even when the Big Thought's broader topic could still be discussed there."
      : "The question answered by the Big Thought must actually show up in that area of real life.",
    "It must be wide enough for several different Angles.",
    ...(named ? [`Audience: ${named}`] : []),
  ];
}

export function buildTerritoryJudgePrompt(input: {
  parentStatement: string;
  ancestors?: AncestorStake[];
  audience?: string;
  candidate: { code: string; statement: string };
}): string {
  const named = input.audience?.trim() ?? "";
  return [
    "You are the canonical semantic judge for one Territory under one direct Big Thought.",
    "A Territory names an area in the audience's world: a phenomenon, habit, life moment, culture, or everyday problem where the Big Thought's reason can be discussed.",
    "It is a noun or a noun phrase. It does not yet contain a claim.",
    ...territoryPassLines(named),
    "It is specific enough that its boundary is recognizable.",
    "Judge only this candidate against this direct parent. Do not compare sibling Territories. Do not judge overlap, containment, set distinctness, coverage, or challenger completeness.",
    "Judge semantic fit, not keyword overlap. A child Territory may introduce a new framing that the parent sentence does not already say.",
    "parentFit is false when the space would still be a place to discuss the topic after the distinctive stake of the direct Big Thought or an ancestor is removed, including the Master Thought and the part of that belief that is not in the subject, even if the topic stays close to the Big Thought. A noun the audience would use is not rejected only because that name can still be said. Otherwise true, or unresolved when that cannot be decided.",
    "Do not copy the parent or the ancestors.",
    "Return facts only. Do not decide relationToParent. Any relation you include is ignored.",
    "conceptualForm is TERRITORY_SPACE when the candidate names a place where several Angles could live.",
    "conceptualForm is BIG_THOUGHT_LIKE when its primary role is a belief, proposition, principle, premise, reason, normative claim, or broad assertion. Judge role, not grammar.",
    "conceptualForm is ANGLE_LIKE when it closes exploration around one contestable point of view, interpretation, claim, or conclusion. A sentence is not automatically an Angle.",
    "conceptualForm is DOWNSTREAM_EXECUTION_LIKE when its primary role is an action, medium, content format, scene, mechanism, implementation, experiment, or production technique.",
    "conceptualForm is UNRESOLVED when the role cannot be decided.",
    "parentScopeDuplication is true when the candidate is space-like but substantially repeats the parent's conceptual scope instead of opening a meaningful child space. It is false for a real child space, or unresolved when that cannot be decided.",
    "generativity is SUFFICIENT when the space can hold several substantively different Angles, not paraphrases. A narrow space can still be sufficient. INSUFFICIENT means it cannot. UNRESOLVED means that cannot be decided.",
    "boundedness is BOUNDED when it is reasonably clear what belongs inside and what does not. UNBOUNDED means the boundary is too broad, vague, diffuse, or unstable. UNRESOLVED means that cannot be decided.",
    "nominalForm is NOMINAL when the candidate is a noun or a noun phrase that names an area without asserting a belief. CLAIM when it asserts a belief, reason, evaluation, or proposition, and also when its main job is an impact, a requirement, or an evaluation, even when the grammar is still a noun phrase. UNRESOLVED when that cannot be decided. A one-word or short noun phrase can be NOMINAL.",
    named
      ? "audienceLanguage is AUDIENCE when the words are how the audience would name that area. INTERNAL when the words are an internal strategy term, a brand framework, or jargon the audience would not use. Judge the words of the named audience. This is a test of words, not of topic. UNRESOLVED when that cannot be decided."
      : "audienceLanguage is AUDIENCE when the words are how the audience would name that area. INTERNAL when the words are an internal strategy term, a brand framework, or jargon the audience would not use. This is a test of words, not of topic. UNRESOLVED when that cannot be decided.",
    named
      ? "livedQuestion is true when the question answered by the Big Thought actually shows up in that area of this audience's real life. false when the area does not host that question for this audience, including when the area only fits a different audience. unresolved when that cannot be decided."
      : "livedQuestion is true when the question answered by the Big Thought actually shows up in that area of real life. false when the area does not host that question. unresolved when that cannot be decided.",
    "Judge whether the candidate names a claim-free audience area that still carries the direct parent's stake.",
    "confidence is optional debug metadata. It does not decide any fact.",
    "Write whatItSays in the same language as the Big Thought.",
    "Use unresolvedReasons only when a required fact cannot be decided. Do not explain a clear rejection there.",
    "Return JSON only:",
    JSON.stringify({
      code: input.candidate.code,
      whatItSays: "",
      parentFit: "unresolved",
      conceptualForm: "UNRESOLVED",
      parentScopeDuplication: "unresolved",
      generativity: "UNRESOLVED",
      boundedness: "UNRESOLVED",
      nominalForm: "UNRESOLVED",
      audienceLanguage: "UNRESOLVED",
      livedQuestion: "unresolved",
      unresolvedReasons: [],
      confidence: 0,
    }),
    "",
    "Direct Big Thought:",
    input.parentStatement.trim(),
    ...ancestorStakeBlock(input.ancestors),
    "",
    "Candidate Territory:",
    `${input.candidate.code}: ${input.candidate.statement.trim()}`,
  ].join("\n");
}

export async function judgeTerritory(
  input: {
    parentStatement: string;
    ancestors?: AncestorStake[];
    audience?: string;
    candidate: { code: string; statement: string };
  },
  ask: (prompt: string) => Promise<string | null>,
): Promise<TerritorySemanticFacts> {
  const script = await ask(buildTerritoryJudgePrompt(input));
  return parseTerritoryJudge(script, input.candidate.code);
}

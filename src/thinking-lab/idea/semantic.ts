import { parseModelJson } from "@/thinking-lab/shared/ai";
import { ancestorStakeBlock, type AncestorStake } from "@/thinking-lab/shared/ancestorStake";
import type {
  IdeaBoundedness,
  IdeaCauseLock,
  IdeaConceptualCompleteness,
  IdeaConceptualForm,
  IdeaCreativeMechanism,
  IdeaExecutionIndependence,
  IdeaSituationForm,
  IdeaRelation,
  IdeaResolution,
  IdeaSemanticFacts,
  IdeaTriState,
} from "@/thinking-lab/idea/types";

const FORMS = [
  "IDEA_CONCEPT",
  "ANGLE_LIKE",
  "TERRITORY_LIKE",
  "BIG_THOUGHT_LIKE",
  "EXECUTION_LIKE",
  "UNRESOLVED",
] as const satisfies readonly IdeaConceptualForm[];

const COMPLETENESS = ["SUFFICIENT", "INSUFFICIENT", "UNRESOLVED"] as const satisfies readonly IdeaConceptualCompleteness[];
const INDEPENDENCE = ["INDEPENDENT", "EXECUTION_BOUND", "UNRESOLVED"] as const satisfies readonly IdeaExecutionIndependence[];
const BOUNDEDNESS = ["BOUNDED", "UNBOUNDED", "UNRESOLVED"] as const satisfies readonly IdeaBoundedness[];
const CAUSE_LOCKS = ["LOCKED", "OPEN", "UNRESOLVED"] as const satisfies readonly IdeaCauseLock[];
const SITUATION_FORMS = ["SITUATION", "VERBAL", "UNRESOLVED"] as const satisfies readonly IdeaSituationForm[];
const MECHANISMS = [
  "COMPARISON",
  "EXPERIMENT",
  "NARRATIVE",
  "METAPHOR",
  "DEMONSTRATION",
  "CHALLENGE",
  "TRANSFORMATION",
  "SIMULATION",
  "OBSERVATION",
  "REVEAL",
  "CONTRAST",
  "ROLE_REVERSAL",
  "OTHER",
  "UNRESOLVED",
] as const satisfies readonly IdeaCreativeMechanism[];

type CanonicalInput = Pick<
  IdeaSemanticFacts,
  | "parentFit"
  | "conceptualForm"
  | "conceptualCompleteness"
  | "executionIndependence"
  | "boundedness"
  | "causeLock"
  | "situationForm"
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

function readTriState(value: unknown): { value: IdeaTriState; contradictory: boolean } {
  if (value == null || value === "") return { value: "unresolved", contradictory: false };
  const tokens = tokensOf(value);
  const recognized = tokens.flatMap((token): IdeaTriState[] => {
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

function unresolvedIdea(code: string, reason: string): IdeaSemanticFacts {
  return {
    code,
    whatItSays: "",
    relationToParent: "UNRESOLVED",
    parentFit: "unresolved",
    conceptualForm: "UNRESOLVED",
    creativeMechanism: "UNRESOLVED",
    conceptualCompleteness: "UNRESOLVED",
    executionIndependence: "UNRESOLVED",
    boundedness: "UNRESOLVED",
    causeLock: "UNRESOLVED",
    situationForm: "UNRESOLVED",
    resolution: "UNRESOLVED",
    unresolvedReasons: [reason],
  };
}

type FactState<T> = { value: T; contradictory: boolean };

type IdeaFactStates = {
  parentFit: FactState<IdeaTriState>;
  conceptualForm: FactState<IdeaConceptualForm>;
  conceptualCompleteness: FactState<IdeaConceptualCompleteness>;
  executionIndependence: FactState<IdeaExecutionIndependence>;
  boundedness: FactState<IdeaBoundedness>;
  causeLock: FactState<IdeaCauseLock>;
  situationForm: FactState<IdeaSituationForm>;
};

function deriveIdeaGates(states: IdeaFactStates): { relation: IdeaRelation; blockedByContradiction: boolean } {
  const unresolved = { relation: "UNRESOLVED" as const, blockedByContradiction: false };
  const contradicted = { relation: "UNRESOLVED" as const, blockedByContradiction: true };
  if (states.parentFit.contradictory) return contradicted;
  if (states.parentFit.value === false) return { relation: "OUT_OF_PARENT_SCOPE", blockedByContradiction: false };
  if (states.parentFit.value !== true) return unresolved;
  if (states.conceptualForm.contradictory) return contradicted;
  if (states.conceptualForm.value === "BIG_THOUGHT_LIKE") return { relation: "BIG_THOUGHT_LIKE", blockedByContradiction: false };
  if (states.conceptualForm.value === "TERRITORY_LIKE") return { relation: "TERRITORY_LIKE", blockedByContradiction: false };
  if (states.conceptualForm.value === "ANGLE_LIKE") return { relation: "ANGLE_LIKE", blockedByContradiction: false };
  if (states.conceptualForm.value === "EXECUTION_LIKE") return { relation: "EXECUTION_LIKE", blockedByContradiction: false };
  if (states.conceptualForm.value !== "IDEA_CONCEPT") return unresolved;
  if (states.executionIndependence.value === "EXECUTION_BOUND") return { relation: "EXECUTION_LIKE", blockedByContradiction: false };
  if (states.conceptualCompleteness.value === "INSUFFICIENT") {
    return { relation: "UNDERDEVELOPED_CONCEPT", blockedByContradiction: false };
  }
  if (states.boundedness.value === "UNBOUNDED") return { relation: "UNBOUNDED_IDEA", blockedByContradiction: false };
  if (states.executionIndependence.contradictory || states.conceptualCompleteness.contradictory || states.boundedness.contradictory) {
    return contradicted;
  }
  if (states.conceptualCompleteness.value !== "SUFFICIENT") return unresolved;
  if (states.executionIndependence.value !== "INDEPENDENT") return unresolved;
  if (states.boundedness.value !== "BOUNDED") return unresolved;
  if (states.situationForm.contradictory || states.causeLock.contradictory) return contradicted;
  if (states.situationForm.value === "VERBAL") return { relation: "BIG_THOUGHT_LIKE", blockedByContradiction: false };
  if (states.causeLock.value === "OPEN") return { relation: "CAUSE_UNLOCKED", blockedByContradiction: false };
  if (states.situationForm.value !== "SITUATION") return unresolved;
  if (states.causeLock.value !== "LOCKED") return unresolved;
  return { relation: "VALID_IDEA", blockedByContradiction: false };
}

export function deriveIdeaRelation(facts: CanonicalInput): IdeaRelation {
  return deriveIdeaGates({
    parentFit: { value: facts.parentFit, contradictory: false },
    conceptualForm: { value: facts.conceptualForm, contradictory: false },
    conceptualCompleteness: { value: facts.conceptualCompleteness, contradictory: false },
    executionIndependence: { value: facts.executionIndependence, contradictory: false },
    boundedness: { value: facts.boundedness, contradictory: false },
    causeLock: { value: facts.causeLock, contradictory: false },
    situationForm: { value: facts.situationForm, contradictory: false },
  }).relation;
}

function unresolvedFactReasons(facts: CanonicalInput): string[] {
  const reasons: string[] = [];
  if (facts.parentFit === "unresolved") reasons.push("PARENT_FIT_UNRESOLVED");
  if (facts.conceptualForm === "UNRESOLVED") reasons.push("CONCEPTUAL_FORM_UNRESOLVED");
  if (facts.conceptualCompleteness === "UNRESOLVED") reasons.push("COMPLETENESS_UNRESOLVED");
  if (facts.executionIndependence === "UNRESOLVED") reasons.push("EXECUTION_INDEPENDENCE_UNRESOLVED");
  if (facts.boundedness === "UNRESOLVED") reasons.push("BOUNDEDNESS_UNRESOLVED");
  if (facts.situationForm === "UNRESOLVED") reasons.push("SITUATION_FORM_UNRESOLVED");
  if (facts.causeLock === "UNRESOLVED") reasons.push("CAUSE_LOCK_UNRESOLVED");
  return reasons;
}

function resolutionFor(relation: IdeaRelation): IdeaResolution {
  return relation === "UNRESOLVED" ? "UNRESOLVED" : "RESOLVED";
}

export function normalizeIdeaFacts(raw: unknown, fallbackCode = ""): IdeaSemanticFacts {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return unresolvedIdea(fallbackCode, "JUDGE_UNPARSEABLE");
  const row = raw as Record<string, unknown>;
  const code = asText(row.code) || fallbackCode;
  const whatItSays = asText(row.whatItSays);
  const confidence = asConfidence(row.confidence);
  const parentFit = readTriState(row.parentFit);
  const conceptualForm = exclusiveMatch(row.conceptualForm, FORMS);
  const conceptualCompleteness = exclusiveMatch(row.conceptualCompleteness, COMPLETENESS);
  const executionIndependence = exclusiveMatch(row.executionIndependence, INDEPENDENCE);
  const boundedness = exclusiveMatch(row.boundedness, BOUNDEDNESS);
  const causeLock = exclusiveMatch(row.causeLock, CAUSE_LOCKS);
  const situationForm = exclusiveMatch(row.situationForm, SITUATION_FORMS);
  const creativeMechanism = exclusiveMatch(row.creativeMechanism, MECHANISMS);
  const canonical: CanonicalInput = {
    parentFit: parentFit.value,
    conceptualForm: conceptualForm.value ?? "UNRESOLVED",
    conceptualCompleteness: conceptualCompleteness.value ?? "UNRESOLVED",
    executionIndependence: executionIndependence.value ?? "UNRESOLVED",
    boundedness: boundedness.value ?? "UNRESOLVED",
    causeLock: causeLock.value ?? "UNRESOLVED",
    situationForm: situationForm.value ?? "UNRESOLVED",
  };
  const derived = deriveIdeaGates({
    parentFit,
    conceptualForm: { value: canonical.conceptualForm, contradictory: conceptualForm.contradictory },
    conceptualCompleteness: { value: canonical.conceptualCompleteness, contradictory: conceptualCompleteness.contradictory },
    executionIndependence: { value: canonical.executionIndependence, contradictory: executionIndependence.contradictory },
    boundedness: { value: canonical.boundedness, contradictory: boundedness.contradictory },
    causeLock: { value: canonical.causeLock, contradictory: causeLock.contradictory },
    situationForm: { value: canonical.situationForm, contradictory: situationForm.contradictory },
  });
  const relationToParent = derived.relation;
  const facts: IdeaSemanticFacts = {
    code,
    whatItSays,
    relationToParent,
    creativeMechanism: creativeMechanism.value ?? "UNRESOLVED",
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

export function parseIdeaJudge(script: string | null, code: string): IdeaSemanticFacts {
  if (!script?.trim()) return unresolvedIdea(code, "JUDGE_UNAVAILABLE");
  const parsed = parseModelJson(script);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return unresolvedIdea(code, "JUDGE_UNPARSEABLE");
  return normalizeIdeaFacts(parsed, code);
}

export function holdCauseUntilSubject(facts: IdeaSemanticFacts, masterSubject: string): IdeaSemanticFacts {
  if (masterSubject.trim() || facts.causeLock !== "LOCKED") return facts;
  return normalizeIdeaFacts(
    {
      code: facts.code,
      whatItSays: facts.whatItSays,
      parentFit: facts.parentFit,
      conceptualForm: facts.conceptualForm,
      creativeMechanism: facts.creativeMechanism,
      conceptualCompleteness: facts.conceptualCompleteness,
      executionIndependence: facts.executionIndependence,
      boundedness: facts.boundedness,
      situationForm: facts.situationForm,
      causeLock: "UNRESOLVED",
      unresolvedReasons: ["SUBJECT_UNNAMED"],
    },
    facts.code,
  );
}

export function buildIdeaJudgePrompt(input: {
  parentStatement: string;
  masterSubject?: string;
  ancestors?: AncestorStake[];
  candidate: { code: string; statement: string };
}): string {
  const subject = input.masterSubject?.trim() || "(not sealed)";
  return [
    "You are the canonical semantic judge for one Idea under one direct Angle.",
    "An Idea creates a situation in which the Angle happens, becomes visible, or can be proved. The sentence may be tested as 'we make, invite, show, or create … so that …'. The prefix itself is not required.",
    "It must not verbally explain the Big Thought. A verbal explanation of the reason is the Big Thought's job.",
    "The mechanism must lock other explanations, so the subject of the Master Thought is the plausible cause. If another explanation stays open, the mechanism does not lock the cause.",
    "Angle determines the observation. Idea determines the situation. A later pillar chooses the production form.",
    "Judge only this candidate against this direct Angle. Do not compare sibling Ideas. Do not judge overlap, set distinctness, coverage, or challenger completeness.",
    "Judge semantic fit, not keyword overlap. Do not decide relationToParent. Any relation you include is ignored.",
    "parentFit is false when the candidate does not materially express this direct Angle, or when it would still be coherent after the distinctive stake of this Angle or an ancestor is removed. Otherwise true, or unresolved when fit cannot be decided.",
    "A new framing is allowed. Do not copy the Angle or the ancestors.",
    "conceptualForm is IDEA_CONCEPT when the candidate is a situation that makes the Angle happen. ANGLE_LIKE when it is still an observation, contradiction, or tension. TERRITORY_LIKE when it is a noun or life area. BIG_THOUGHT_LIKE when it is a reason or a verbal explanation of why the parent belief is true. EXECUTION_LIKE when it is primarily a production form, medium, shot, duration, camera, dialogue, or delivery detail. UNRESOLVED when the role cannot be decided.",
    "creativeMechanism names the dominant conceptual device: COMPARISON, EXPERIMENT, NARRATIVE, METAPHOR, DEMONSTRATION, CHALLENGE, TRANSFORMATION, SIMULATION, OBSERVATION, REVEAL, CONTRAST, ROLE_REVERSAL, OTHER, or UNRESOLVED. The mechanism describes the concept. It does not by itself decide validity.",
    "conceptualCompleteness is SUFFICIENT when another person can tell what actually happens in the concept. INSUFFICIENT when the creative mechanism is missing. UNRESOLVED when that cannot be decided.",
    "executionIndependence is INDEPENDENT when the concept can still be realized in more than one production form. EXECUTION_BOUND when the concept is defined by platform, duration, aspect ratio, camera, shot list, lighting, dialogue wording, editing, equipment, blocking, or posting format. UNRESOLVED when that cannot be decided.",
    "boundedness is BOUNDED when the concept has a recognizable boundary. UNBOUNDED when it does not define a mechanism or boundary. UNRESOLVED when that cannot be decided.",
    "situationForm is SITUATION when the candidate creates a scene the audience can enter. VERBAL when it explains the Big Thought in words instead of creating that scene. UNRESOLVED when that cannot be decided.",
    "causeLock is LOCKED only when other explanations are closed so the named Master Thought subject is the plausible cause. OPEN when another explanation remains, including a cause other than that subject. UNRESOLVED when that cannot be decided, or when no subject is named.",
    "confidence is optional debug metadata. It does not decide any fact.",
    "Write whatItSays in the same language as the Angle.",
    "Use unresolvedReasons only when a required fact cannot be decided.",
    "Do not use examples from any specific industry, belief system, or brand.",
    "Return JSON only:",
    JSON.stringify({
      code: input.candidate.code,
      whatItSays: "",
      parentFit: true,
      conceptualForm: "IDEA_CONCEPT",
      creativeMechanism: "OTHER",
      conceptualCompleteness: "SUFFICIENT",
      executionIndependence: "INDEPENDENT",
      boundedness: "BOUNDED",
      situationForm: "UNRESOLVED",
      causeLock: "UNRESOLVED",
      unresolvedReasons: [],
      confidence: 0,
    }),
    "",
    "Master Thought subject:",
    subject,
    "",
    "Direct Angle:",
    input.parentStatement.trim(),
    ...ancestorStakeBlock(input.ancestors),
    "",
    "Candidate Idea:",
    input.candidate.statement.trim(),
  ].join("\n");
}

export async function judgeIdea(
  input: {
    parentStatement: string;
    masterSubject?: string;
    ancestors?: AncestorStake[];
    candidate: { code: string; statement: string };
  },
  ask: (prompt: string) => Promise<string | null>,
): Promise<IdeaSemanticFacts> {
  const script = await ask(buildIdeaJudgePrompt(input));
  return holdCauseUntilSubject(parseIdeaJudge(script, input.candidate.code), input.masterSubject ?? "");
}

import { parseModelJson } from "@/thinking-lab/shared/ai";
import { ancestorStakeBlock, type AncestorStake } from "@/thinking-lab/shared/ancestorStake";
import { readIdeaGeneratePasses } from "@/thinking-lab/idea/generatePasses";
import { ideaNodeSummary } from "@/thinking-lab/idea/subject";
import type {
  IdeaBoundedness,
  IdeaCauseLock,
  IdeaConceptualCompleteness,
  IdeaConceptualForm,
  IdeaCreativeMechanism,
  IdeaExecutionIndependence,
  IdeaMechanismKey,
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

const IDEA_VEHICLES = ["COMPARISON", "CONTRAST", "EXPERIMENT", "DEMONSTRATION", "SIMULATION"] as const satisfies readonly IdeaCreativeMechanism[];

type CanonicalInput = Pick<
  IdeaSemanticFacts,
  | "parentFit"
  | "conceptualForm"
  | "creativeMechanism"
  | "conceptualCompleteness"
  | "executionIndependence"
  | "boundedness"
  | "causeLock"
  | "mechanismKeys"
  | "situationForm"
>;

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asConfidence(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

const VERBAL_KEY = /\b(?:menunjukkan bahwa|membuktikan bahwa|menyoroti bahwa|ini hanya menunjukkan|highlights that|shows that|proves that)\b/i;
const INDONESIAN_ANNOUNCEMENT = /\b(?:menunjukkan bahwa|membuktikan bahwa|menyoroti bahwa|ini hanya menunjukkan)\b/i;

/** The sentence announces a conclusion. Stating what the mechanism makes true does not match. */
export function ideaAnnouncesConclusion(statement: string): boolean {
  return VERBAL_KEY.test(statement);
}

export function announcedConclusionReason(statement: string): string {
  if (INDONESIAN_ANNOUNCEMENT.test(statement)) {
    return "Kalimat ini mengumumkan kesimpulannya. Tetap tulis apa yang menjadi benar, tanpa menunjukkan, membuktikan, atau menyoroti bahwa.";
  }
  return "The sentence announces the conclusion. Keep what becomes true without saying that this shows, proves, or highlights it.";
}

function clipKeyClause(raw: string): string {
  const first = raw.split(/(?:\.\.|[.!?])/)[0]?.trim() ?? "";
  const words = first.split(/\s+/).filter(Boolean).slice(0, 12);
  return words.join(" ").trim();
}

export function readMechanismKeys(value: unknown): IdeaMechanismKey[] {
  if (!Array.isArray(value)) return [];
  const keys: IdeaMechanismKey[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const record = row as { otherExplanation?: unknown; close?: unknown };
    const otherExplanation = clipKeyClause(asText(record.otherExplanation));
    const close = clipKeyClause(asText(record.close));
    if (!otherExplanation || !close) continue;
    if (VERBAL_KEY.test(otherExplanation) || VERBAL_KEY.test(close)) continue;
    keys.push({ otherExplanation, close });
  }
  return keys;
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
    subject: "",
    relationToParent: "UNRESOLVED",
    parentFit: "unresolved",
    conceptualForm: "UNRESOLVED",
    creativeMechanism: "UNRESOLVED",
    conceptualCompleteness: "UNRESOLVED",
    executionIndependence: "UNRESOLVED",
    boundedness: "UNRESOLVED",
    causeLock: "UNRESOLVED",
    mechanismKeys: [],
    situationForm: "UNRESOLVED",
    resolution: "UNRESOLVED",
    unresolvedReasons: [reason],
  };
}

type FactState<T> = { value: T; contradictory: boolean };

type IdeaFactStates = {
  parentFit: FactState<IdeaTriState>;
  conceptualForm: FactState<IdeaConceptualForm>;
  creativeMechanism: FactState<IdeaCreativeMechanism>;
  conceptualCompleteness: FactState<IdeaConceptualCompleteness>;
  executionIndependence: FactState<IdeaExecutionIndependence>;
  boundedness: FactState<IdeaBoundedness>;
  causeLock: FactState<IdeaCauseLock>;
  mechanismKeys: IdeaMechanismKey[];
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
  if (states.creativeMechanism.contradictory) return contradicted;
  if (states.creativeMechanism.value === "UNRESOLVED") return unresolved;
  if (states.creativeMechanism.value === "NARRATIVE") return { relation: "EXECUTION_LIKE", blockedByContradiction: false };
  if (states.creativeMechanism.value === "OBSERVATION") return { relation: "ANGLE_LIKE", blockedByContradiction: false };
  if (!IDEA_VEHICLES.some((vehicle) => vehicle === states.creativeMechanism.value)) {
    return { relation: "UNDERDEVELOPED_CONCEPT", blockedByContradiction: false };
  }
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
  if (states.mechanismKeys.length === 0) return { relation: "CAUSE_UNLOCKED", blockedByContradiction: false };
  return { relation: "VALID_IDEA", blockedByContradiction: false };
}

export function deriveIdeaRelation(facts: CanonicalInput): IdeaRelation {
  return deriveIdeaGates({
    parentFit: { value: facts.parentFit, contradictory: false },
    conceptualForm: { value: facts.conceptualForm, contradictory: false },
    creativeMechanism: { value: facts.creativeMechanism, contradictory: false },
    conceptualCompleteness: { value: facts.conceptualCompleteness, contradictory: false },
    executionIndependence: { value: facts.executionIndependence, contradictory: false },
    boundedness: { value: facts.boundedness, contradictory: false },
    causeLock: { value: facts.causeLock, contradictory: false },
    mechanismKeys: facts.mechanismKeys,
    situationForm: { value: facts.situationForm, contradictory: false },
  }).relation;
}

function unresolvedFactReasons(facts: CanonicalInput): string[] {
  const reasons: string[] = [];
  if (facts.parentFit === "unresolved") reasons.push("PARENT_FIT_UNRESOLVED");
  if (facts.conceptualForm === "UNRESOLVED") reasons.push("CONCEPTUAL_FORM_UNRESOLVED");
  if (facts.creativeMechanism === "UNRESOLVED") reasons.push("MECHANISM_UNRESOLVED");
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
  const subject = ideaNodeSummary(asText(row.subject));
  const confidence = asConfidence(row.confidence);
  const parentFit = readTriState(row.parentFit);
  const conceptualForm = exclusiveMatch(row.conceptualForm, FORMS);
  const conceptualCompleteness = exclusiveMatch(row.conceptualCompleteness, COMPLETENESS);
  const executionIndependence = exclusiveMatch(row.executionIndependence, INDEPENDENCE);
  const boundedness = exclusiveMatch(row.boundedness, BOUNDEDNESS);
  const causeLock = exclusiveMatch(row.causeLock, CAUSE_LOCKS);
  const situationForm = exclusiveMatch(row.situationForm, SITUATION_FORMS);
  const creativeMechanism = exclusiveMatch(row.creativeMechanism, MECHANISMS);
  const mechanismKeys = readMechanismKeys(row.mechanismKeys);
  const canonical: CanonicalInput = {
    parentFit: parentFit.value,
    conceptualForm: conceptualForm.value ?? "UNRESOLVED",
    creativeMechanism: creativeMechanism.value ?? "UNRESOLVED",
    conceptualCompleteness: conceptualCompleteness.value ?? "UNRESOLVED",
    executionIndependence: executionIndependence.value ?? "UNRESOLVED",
    boundedness: boundedness.value ?? "UNRESOLVED",
    causeLock: causeLock.value ?? "UNRESOLVED",
    mechanismKeys,
    situationForm: situationForm.value ?? "UNRESOLVED",
  };
  const derived = deriveIdeaGates({
    parentFit,
    conceptualForm: { value: canonical.conceptualForm, contradictory: conceptualForm.contradictory },
    creativeMechanism: { value: canonical.creativeMechanism, contradictory: creativeMechanism.contradictory },
    conceptualCompleteness: { value: canonical.conceptualCompleteness, contradictory: conceptualCompleteness.contradictory },
    executionIndependence: { value: canonical.executionIndependence, contradictory: executionIndependence.contradictory },
    boundedness: { value: canonical.boundedness, contradictory: boundedness.contradictory },
    causeLock: { value: canonical.causeLock, contradictory: causeLock.contradictory },
    mechanismKeys,
    situationForm: { value: canonical.situationForm, contradictory: situationForm.contradictory },
  });
  const relationToParent = derived.relation;
  const facts: IdeaSemanticFacts = {
    code,
    whatItSays,
    subject,
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
  const generatePasses = readIdeaGeneratePasses(row.generatePasses);
  if (generatePasses.length > 0) facts.generatePasses = generatePasses;
  return facts;
}

export function parseIdeaJudge(script: string | null, code: string): IdeaSemanticFacts {
  if (!script?.trim()) return unresolvedIdea(code, "JUDGE_UNAVAILABLE");
  const parsed = parseModelJson(script);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return unresolvedIdea(code, "JUDGE_UNPARSEABLE");
  return normalizeIdeaFacts(parsed, code);
}

/** An announcement is verbal even when the judge marks the mechanism as a situation. */
export function rejectAnnouncedConclusion(facts: IdeaSemanticFacts, statement: string): IdeaSemanticFacts {
  if (!ideaAnnouncesConclusion(statement) || facts.situationForm === "VERBAL") return facts;
  return normalizeIdeaFacts(
    {
      code: facts.code,
      whatItSays: facts.whatItSays,
      subject: facts.subject,
      parentFit: facts.parentFit,
      conceptualForm: facts.conceptualForm,
      creativeMechanism: facts.creativeMechanism,
      conceptualCompleteness: facts.conceptualCompleteness,
      executionIndependence: facts.executionIndependence,
      boundedness: facts.boundedness,
      causeLock: facts.causeLock,
      mechanismKeys: facts.mechanismKeys,
      situationForm: "VERBAL",
      ...(facts.confidence !== undefined ? { confidence: facts.confidence } : {}),
    },
    facts.code,
  );
}

export function holdCauseUntilSubject(facts: IdeaSemanticFacts, masterSubject: string): IdeaSemanticFacts {
  if (masterSubject.trim() || facts.causeLock !== "LOCKED") return facts;
  return normalizeIdeaFacts(
    {
      code: facts.code,
      whatItSays: facts.whatItSays,
      subject: facts.subject,
      parentFit: facts.parentFit,
      conceptualForm: facts.conceptualForm,
      creativeMechanism: facts.creativeMechanism,
      conceptualCompleteness: facts.conceptualCompleteness,
      executionIndependence: facts.executionIndependence,
      boundedness: facts.boundedness,
      situationForm: facts.situationForm,
      causeLock: "UNRESOLVED",
      mechanismKeys: facts.mechanismKeys,
      unresolvedReasons: ["SUBJECT_UNNAMED"],
    },
    facts.code,
  );
}

export function buildIdeaJudgePrompt(input: {
  parentStatement: string;
  masterSubject?: string;
  ancestors?: AncestorStake[];
  candidate: { code: string; statement: string; mechanismKeys?: IdeaMechanismKey[] };
}): string {
  const subject = input.masterSubject?.trim() || "(not sealed)";
  const keys = input.candidate.mechanismKeys ?? [];
  const keyLines =
    keys.length === 0
      ? "(none)"
      : keys.map((key) => `- ${key.otherExplanation} / ${key.close}`).join("\n");
  return [
    "You are the canonical semantic judge for one Idea under one direct Angle.",
    "An Idea is a concrete mechanism that makes the Angle happen, become visible, or be proved, through a demonstration, an experiment, a comparison, or a situation.",
    "The sentence names what is made, invited, shown, or created, then what that makes true. It proves the Angle. Naming what the mechanism makes true does not jump to the Big Thought.",
    "The statement and the keys must stay in the Angle's language. Do not treat an English wording as more valid.",
    "subject is the short name of the mechanism, at most six words, in the Angle's language. It keeps the meaning of the mechanism. It is not a cut-off sentence.",
    "Each mechanism key is two short clauses. otherExplanation names one other cause. close names how this Idea shuts that cause. A key that says this shows, proves, or highlights a conclusion is not a key.",
    "It must not verbally explain the Big Thought instead of naming what the mechanism makes true. A sentence that says this shows or highlights a conclusion is the Big Thought's job.",
    "The mechanism keys are written apart from the sentence. Each key names one other explanation a viewer might reach, and how this Idea closes it, so the named Master Thought subject is the only plausible cause.",
    "Angle determines the observation. Idea determines the mechanism. A later pillar chooses the finished form. A pillar that would force a message outside this Idea is refused later.",
    "Judge only this candidate against this direct Angle. Do not compare sibling Ideas. Do not judge overlap, set distinctness, coverage, or challenger completeness.",
    "Judge semantic fit, not keyword overlap. Do not decide relationToParent. Any relation you include is ignored.",
    "parentFit is false when the candidate does not materially express this direct Angle, or when it would still be coherent after the distinctive stake of this Angle or an ancestor is removed. Otherwise true, or unresolved when fit cannot be decided.",
    "A new framing is allowed. Do not copy the Angle or the ancestors.",
    "conceptualForm is IDEA_CONCEPT when the candidate is a mechanism that makes the Angle happen, become visible, or be proved. Naming what the mechanism makes true keeps it IDEA_CONCEPT. ANGLE_LIKE when it is still an observation, contradiction, or tension. TERRITORY_LIKE when it is a noun or life area. BIG_THOUGHT_LIKE when it is a reason or a verbal explanation of why the parent belief is true instead of naming the mechanism and what the mechanism makes true. EXECUTION_LIKE when it is a finished story, a lesson, a chart, a shot list, dialogue, or any other chosen pillar. UNRESOLVED when the role cannot be decided.",
    "creativeMechanism names the vehicle. COMPARISON or CONTRAST is a comparison. EXPERIMENT is an experiment. DEMONSTRATION is a demonstration. SIMULATION is a situation. NARRATIVE is a finished story and is not a valid Idea vehicle. OBSERVATION is still an Angle. METAPHOR, CHALLENGE, TRANSFORMATION, REVEAL, ROLE_REVERSAL, and OTHER are not Idea vehicles. UNRESOLVED when the vehicle cannot be decided. The vehicle decides whether the Idea can pass.",
    "conceptualCompleteness is SUFFICIENT when another person can tell which mechanism is set up. INSUFFICIENT when the creative mechanism is missing. UNRESOLVED when that cannot be decided.",
    "executionIndependence is INDEPENDENT when the mechanism does not require one finished pillar. EXECUTION_BOUND when the concept requires one finished form, such as a chart, a lesson script, a storytelling script, a platform, a duration, a camera, or a shot list. UNRESOLVED when that cannot be decided.",
    "boundedness is BOUNDED when the concept has a recognizable boundary. UNBOUNDED when it does not define a mechanism or boundary. UNRESOLVED when that cannot be decided.",
    "situationForm is SITUATION when a comparison, a contrast, an experiment, a demonstration, or a situation names the mechanism and what the mechanism makes true, so the reason happens there. VERBAL when the sentence explains the Big Thought in words instead of naming what the mechanism makes true, or announces the conclusion with shows that, proves that, highlights that, menunjukkan bahwa, membuktikan bahwa, or menyoroti bahwa, even when the sentence also names what the mechanism makes true. A finished story, lesson, or chart is not SITUATION. UNRESOLVED when that cannot be decided.",
    "causeLock is LOCKED only when mechanismKeys names each other explanation and how this Idea closes it, so the named Master Thought subject is the only plausible cause. OPEN when a key is missing or another explanation remains. UNRESOLVED when that cannot be decided, or when no subject is named.",
    "Return the confirmed keys in mechanismKeys. Do not leave a lock only inside the sentence.",
    "confidence is optional debug metadata. It does not decide any fact.",
    "Write whatItSays in the same language as the Angle.",
    "Use unresolvedReasons only when a required fact cannot be decided.",
    "Do not use examples from any specific industry, belief system, or brand.",
    "Return JSON only:",
    JSON.stringify({
      code: input.candidate.code,
      subject: "",
      whatItSays: "",
      parentFit: true,
      conceptualForm: "IDEA_CONCEPT",
      creativeMechanism: "COMPARISON",
      conceptualCompleteness: "SUFFICIENT",
      executionIndependence: "INDEPENDENT",
      boundedness: "BOUNDED",
      situationForm: "UNRESOLVED",
      causeLock: "UNRESOLVED",
      mechanismKeys: [],
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
    "",
    "Written mechanism keys:",
    keyLines,
  ].join("\n");
}

export async function judgeIdea(
  input: {
    parentStatement: string;
    masterSubject?: string;
    ancestors?: AncestorStake[];
    candidate: { code: string; statement: string; mechanismKeys?: IdeaMechanismKey[] };
  },
  ask: (prompt: string) => Promise<string | null>,
): Promise<IdeaSemanticFacts> {
  const script = await ask(buildIdeaJudgePrompt(input));
  return rejectAnnouncedConclusion(
    holdCauseUntilSubject(parseIdeaJudge(script, input.candidate.code), input.masterSubject ?? ""),
    input.candidate.statement,
  );
}

import { parseModelJson } from "@/thinking-lab/shared/ai";
import { ancestorStakeBlock, type AncestorStake } from "@/thinking-lab/shared/ancestorStake";
import type {
  AngleBoundedness,
  AngleConceptualForm,
  AngleIdeaGenerativity,
  AngleJobForm,
  AngleRelation,
  AngleResolution,
  AngleSemanticFacts,
  AngleTriState,
} from "@/thinking-lab/angle/types";

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
  };
  if (confidence !== undefined) facts.confidence = confidence;
  return facts;
}

export function parseAngleJudge(script: string | null, code: string): AngleSemanticFacts {
  if (!script?.trim()) return unresolvedAngle(code, "JUDGE_UNAVAILABLE");
  const parsed = parseModelJson(script);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return unresolvedAngle(code, "JUDGE_UNPARSEABLE");
  return normalizeAngleFacts(parsed, code);
}

export function buildAngleJudgePrompt(input: {
  parentStatement: string;
  ancestors?: AncestorStake[];
  candidate: { code: string; statement: string };
}): string {
  return [
    "You are the canonical semantic judge for one Angle under one direct Territory.",
    "An Angle raises an observation inside one Territory: something rarely noticed, a contradiction, or a tension that can make an audience think the observation is true.",
    "The generative question is: what is rarely noticed about this Territory?",
    "An Angle is not a reason. If the sentence fits smoothly into 'because ...', it is doing a Big Thought's job.",
    "It is not yet the concrete concept used to make that observation happen.",
    "Judge only this candidate against this direct Territory. Do not compare sibling Angles. Do not judge overlap, containment, set distinctness, coverage, or challenger completeness.",
    "Judge semantic fit, not keyword overlap.",
    "Return facts only. Do not decide relationToParent. Any relation you include is ignored.",
    "parentFit is false when the candidate would still be coherent after the distinctive stake of this Territory or an ancestor is removed, even if it would be a coherent Angle elsewhere. Otherwise true, or unresolved when fit cannot be decided.",
    "A new framing is allowed. Do not copy the Territory or the ancestors.",
    "conceptualForm is ANGLE_PROPOSITION when the candidate is an observation, contradiction, or tension inside the Territory. ANGLE_PROPOSITION here means that observation, not an argumentative proposition. It must be narrower than the Territory and broader than an Idea.",
    "conceptualForm is TERRITORY_LIKE when it is a topic, domain, label, category, or broad conceptual conversation space.",
    "conceptualForm is BIG_THOUGHT_LIKE when its primary role is a belief or strategic support proposition that belongs higher in the hierarchy.",
    "conceptualForm is IDEA_LIKE when it already defines a concrete creative concept or concept mechanism.",
    "conceptualForm is EXECUTION_LIKE when it already defines a format, scene, channel, shot, medium, production form, or realization.",
    "conceptualForm is UNRESOLVED when the role cannot be decided.",
    "ideaGenerativity is a preliminary note only. A later review owns the final idea-generativity status. Return SUFFICIENT, INSUFFICIENT, or UNRESOLVED.",
    "boundedness is BOUNDED when the observation keeps a useful boundary. UNBOUNDED means it is too vague or broad. UNRESOLVED means that cannot be decided.",
    "jobForm is OBSERVATION when the candidate is something rarely noticed, a contradiction, or a tension. REASON when it fits smoothly as a because-clause that supports a belief. TERRITORY_SUMMARY when it only restates the Territory. UNRESOLVED when the job cannot be decided.",
    "If the observation is true, part of the parent Big Thought's reason should become felt. That is parentFit, not a second belief.",
    "confidence is optional debug metadata. It does not decide any fact.",
    "Write whatItSays in the same language as the Territory.",
    "Use unresolvedReasons only when a required fact cannot be decided. Do not explain a clear rejection there.",
    "Return JSON only:",
    JSON.stringify({
      code: input.candidate.code,
      whatItSays: "",
      parentFit: "unresolved",
      conceptualForm: "UNRESOLVED",
      ideaGenerativity: "UNRESOLVED",
      boundedness: "UNRESOLVED",
      jobForm: "UNRESOLVED",
      unresolvedReasons: [],
      confidence: 0,
    }),
    "",
    "Direct Territory:",
    input.parentStatement.trim(),
    ...ancestorStakeBlock(input.ancestors),
    "",
    "Candidate Angle:",
    `${input.candidate.code}: ${input.candidate.statement.trim()}`,
  ].join("\n");
}

export async function judgeAngle(
  input: {
    parentStatement: string;
    ancestors?: AncestorStake[];
    candidate: { code: string; statement: string };
  },
  ask: (prompt: string) => Promise<string | null>,
): Promise<AngleSemanticFacts> {
  const script = await ask(buildAngleJudgePrompt(input));
  return parseAngleJudge(script, input.candidate.code);
}

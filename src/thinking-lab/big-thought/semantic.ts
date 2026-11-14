import { readGateFailure, readGeneratePasses } from "./checklist";
import { parseModelJson } from "../shared/parseModelJson";
import type { Resolution, TriState } from "../shared/verdict";
import type { BigThoughtFacts, ParentRelation, SiblingSetFacts } from "./types";

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

const LANGUAGE_RULE =
  "Write every natural-language field in the same language as the Master Thought.";

const JUDGMENT_RULE = [
  "Mark resolution RESOLVED only when every required field is decided.",
  "Otherwise mark UNRESOLVED and list unresolvedReasons.",
  "confidence is optional debug metadata. It does not decide the judgment.",
  "Do not use examples from any specific industry, belief system, or brand.",
].join("\n");

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

function asConfidence(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
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
  const generatePasses = readGeneratePasses(row.generatePasses);
  if (generatePasses.length > 0) facts.generatePasses = generatePasses;
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

export function unresolvedSiblingSet(fingerprint: string, reason: string): SiblingSetFacts {
  return {
    fingerprint,
    distinct: "unresolved",
    duplicatePairs: [],
    reasonContributions: [],
    resolution: "UNRESOLVED",
    unresolvedReasons: [reason],
  };
}

export function buildSiblingSetPrompt(input: {
  parentStatement: string;
  rows: Array<{ code: string; statement: string }>;
}): string {
  const lines = input.rows.map((row) => `${row.code}: ${row.statement}`).join("\n");
  return [
    "You are the canonical semantic judge for sibling distinctness.",
    "The individual meaning of each Big Thought is already stored. Do not restate or reclassify what each one means.",
    "Decide whether any two perform substantially the same material-support reasoning job for the Master Thought.",
    "Two Big Thoughts are not distinct merely because they use different wording, framing, emphasis, abstraction, examples, nouns, or opposite phrasing of the same reason.",
    "Two Big Thoughts overlap when they supply substantially the same material support for the Master Thought, even if both are evidence.",
    "Two Big Thoughts may both be evidence and still be distinct when their evidentiary jobs differ.",
    "Two differently worded statements that both establish the same recurring conduct perform the same reasoning job.",
    "Consistent conduct under pressure and a recurring effect on other people's wellbeing can be different reasoning jobs.",
    "Two Big Thoughts may discuss the same subject, actor, object, or domain and still be distinct when their material supports genuinely differ.",
    "For every Big Thought, identify reasonContribution: the distinct material support it performs for the Master Thought.",
    "reasonContribution is not a topic, category, keyword summary, paraphrase, example, or execution, and it is not a restatement of what the sentence says.",
    "reasonContribution must describe the distinct material support supplied to the parent, whether that support is a premise, reason, or evidence.",
    "Do not accept a reasonContribution that only says the row shows why the parent is important, reinforces the responsibility, reflects commitment, or strengthens the ethical basis. If the job cannot be stated without rephrasing the parent, leave the contribution unresolved rather than inventing one.",
    "Sibling distinctness does not make a vertically invalid Big Thought valid. Do not reclassify a row's relation to the parent.",
    "Two candidates are not truly distinct when one merely states a broader or narrower version, a non-supportive consequence, an application, or a normative continuation of the other reasoning job.",
    "Do not reclassify a row's relation to the Master Thought. That judgment belongs to the individual checks.",
    "Compare those contributions across the whole set.",
    "The question is not whether the sentences look different.",
    "The question is whether, if one Big Thought were removed, another sibling would already perform substantially the same reasoning job for the Master Thought.",
    JUDGMENT_RULE,
    LANGUAGE_RULE,
    "Return JSON only:",
    // No sample codes here: a sample pair was copied into real answers.
    JSON.stringify({
      distinct: true,
      duplicatePairs: [],
      reasonContributions: [{ code: "<code>", reasonContribution: "The reasoning job this Big Thought performs for the parent." }],
      resolution: "RESOLVED",
      unresolvedReasons: [],
      confidence: 0,
    }),
    'duplicatePairs lists codes that perform substantially the same material-support reasoning job, each as {"a":"<code>","b":"<code>","explanation":"..."}. Use an empty array when every reasoning job is distinct.',
    "Every duplicatePairs entry needs an explanation that names the one reasoning job both Big Thoughts perform.",
    "If you cannot name one reasoning job both perform, or your explanation says their jobs or mechanisms differ, do not list that pair.",
    "reasonContributions must include every Big Thought code in the set.",
    "distinct is true only when duplicatePairs is empty.",
    "",
    "Master Thought:",
    input.parentStatement.trim(),
    "",
    "Big Thoughts:",
    lines,
  ].join("\n");
}

function asReasonContributions(value: unknown): SiblingSetFacts["reasonContributions"] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as { code?: unknown; reasonContribution?: unknown };
    const code = asText(record.code);
    const reasonContribution = asText(record.reasonContribution);
    if (!code || !reasonContribution) return [];
    return [{ code, reasonContribution }];
  });
}

export function normalizeSiblingSet(
  raw: unknown,
  fingerprint: string,
  activeCodes: string[] = [],
): SiblingSetFacts {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return unresolvedSiblingSet(fingerprint, "JUDGE_UNPARSEABLE");
  }
  const row = raw as Record<string, unknown>;
  const pairs = Array.isArray(row.duplicatePairs)
    ? row.duplicatePairs.flatMap((pair) => {
        if (!pair || typeof pair !== "object") return [];
        const record = pair as { a?: unknown; b?: unknown; explanation?: unknown };
        const a = asText(record.a);
        const b = asText(record.b);
        if (!a || !b || a === b) return [];
        return [{ a, b, explanation: asText(record.explanation) }];
      })
    : [];
  const reasonContributions = asReasonContributions(row.reasonContributions);
  const facts: SiblingSetFacts = {
    fingerprint,
    distinct: asTri(row.distinct),
    duplicatePairs: pairs,
    reasonContributions,
    resolution: asResolution(row.resolution),
    unresolvedReasons: asReasons(row.unresolvedReasons),
  };
  const confidence = asConfidence(row.confidence);
  if (confidence !== undefined) facts.confidence = confidence;
  if (facts.resolution === "RESOLVED" && facts.distinct === "unresolved") {
    facts.resolution = "UNRESOLVED";
    facts.unresolvedReasons = [...facts.unresolvedReasons, "DISTINCTNESS_UNRESOLVED"];
  }
  if (facts.resolution === "RESOLVED" && facts.distinct === true && pairs.length > 0) {
    facts.resolution = "UNRESOLVED";
    facts.unresolvedReasons = [...facts.unresolvedReasons, "DISTINCTNESS_CONTRADICTION"];
  }
  if (facts.resolution === "RESOLVED" && facts.distinct === false && pairs.length === 0) {
    facts.resolution = "UNRESOLVED";
    facts.unresolvedReasons = [...facts.unresolvedReasons, "DISTINCTNESS_CONTRADICTION"];
  }
  if (facts.resolution === "RESOLVED" && pairs.some((pair) => !pair.explanation)) {
    facts.resolution = "UNRESOLVED";
    facts.unresolvedReasons = [...facts.unresolvedReasons, "MISSING_PAIR_EXPLANATION"];
  }
  if (facts.resolution === "RESOLVED" && activeCodes.length >= 2) {
    const covered = new Set(reasonContributions.map((item) => item.code.toUpperCase()));
    const missing = activeCodes.some((code) => !covered.has(code.toUpperCase()));
    if (missing) {
      facts.resolution = "UNRESOLVED";
      facts.unresolvedReasons = [...facts.unresolvedReasons, "MISSING_REASON_CONTRIBUTION"];
    }
  }
  return facts;
}

export function parseSiblingSet(
  script: string | null,
  fingerprint: string,
  activeCodes: string[] = [],
): SiblingSetFacts {
  if (!script?.trim()) return unresolvedSiblingSet(fingerprint, "JUDGE_UNAVAILABLE");
  const parsed = parseModelJson(script);
  return normalizeSiblingSet(parsed, fingerprint, activeCodes);
}

export async function judgeSiblingSet(
  input: {
    parentStatement: string;
    rows: Array<{ code: string; statement: string }>;
    fingerprint: string;
  },
  ask: (prompt: string) => Promise<string | null>,
): Promise<SiblingSetFacts> {
  if (input.rows.length < 2) {
    // One active Big Thought has no sibling reasoning job to compare.
    // reasonContribution is not invented here; multi-BT Audit requires the model.
    return {
      fingerprint: input.fingerprint,
      distinct: true,
      duplicatePairs: [],
      reasonContributions: [],
      resolution: "RESOLVED",
      unresolvedReasons: [],
    };
  }
  const script = await ask(buildSiblingSetPrompt(input));
  const facts = parseSiblingSet(
    script,
    input.fingerprint,
    input.rows.map((row) => row.code),
  );
  return { ...facts, fingerprint: input.fingerprint };
}

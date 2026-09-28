import { parseModelJson } from "@/thinking-lab/shared/ai";
import {
  fingerprintsMatch,
  masterThoughtFingerprint,
} from "@/thinking-lab/shared/fingerprint";
import type { Resolution } from "@/thinking-lab/shared/verdict";
import type {
  ConfirmationSource,
  MasterAdmission,
  MasterThoughtFacts,
  UnderstandOutcome,
} from "@/thinking-lab/master-thought/types";

const LANGUAGE_RULE =
  "Write every natural-language field in the same language as the Master Thought text.";

const OUTCOMES = new Set<UnderstandOutcome>([
  "ORIGINAL_READY",
  "PROPOSAL_RECOMMENDED",
  "CLARIFICATION_REQUIRED",
  "UNRESOLVED",
]);

export type UnderstandClarification = {
  question: string;
  answer: string;
};

export type UnderstandPersistMode = "display_only" | "replace_understanding";

export type MasterThoughtJudgeContext = {
  priorBelief?: string;
  audience?: string;
};

const COMPARISON_FORMS = new Set(["PRESENT", "MISSING", "UNRESOLVED"]);

export function beliefsMatch(left: string, right: string): boolean {
  const normalized = (value: string) => value.replace(/\s+/g, " ").trim();
  const a = normalized(left);
  const b = normalized(right);
  return a.length > 0 && a === b;
}

function startsWithBecause(value: string): boolean {
  return /^(karena|because)\b/i.test(value.trim());
}

export function buildMasterThoughtJudgePrompt(
  originalInput: string,
  clarification?: UnderstandClarification,
  context?: MasterThoughtJudgeContext,
): string {
  const priorBelief = context?.priorBelief?.trim() ?? "";
  const audience = context?.audience?.trim() ?? "";
  const lines = [
    "You are the canonical semantic judge for one Master Thought.",
    "A Master Thought is one parent belief that can serve as the semantic root for later Big Thoughts.",
    "Understand answers only what the parent belief is: what does the user mean, and does the Original Input itself already contain one usable parent belief?",
    "Understand clarifies WHAT the Master Thought means.",
    "Do not answer why the belief is true. WHY belongs to Big Thought.",
    "A clarification question must resolve WHAT the parent belief means.",
    "It must not request supporting WHYs.",
    "Do not extract, request, propose, or inject foundational WHYs.",
    "Broadness alone is not ambiguity. A broad statement can already be the umbrella parent belief.",
    "Subjectivity alone is not ambiguity. A strong opinion alone is not ambiguity.",
    "A subjective, broad, simple, emotional, normative, or opinionated belief can still be a parent belief.",
    "Name the subject: the shortest clause that still states the planted belief. That clause must stay grammatical immediately before karena or because, and it must later be visible as the cause at Idea.",
    "subject is that short clause in the same language as the Master Thought. It is not a noun title, not a reason, and not the whole belief.",
    "A shorter prefix of the planted belief is allowed when it still states the claim. A noun phrase or other span lifted from the middle of the sentence is not a subject.",
    "If that subject cannot be named safely, do not return ORIGINAL_READY or PROPOSAL_RECOMMENDED. Return CLARIFICATION_REQUIRED with one question that asks what the subject is. Do not ask why the belief is true.",
    "ORIGINAL_READY is a positive requirement, not the fallback when no other problem is noticed.",
    "Return ORIGINAL_READY only when the Original Input itself contains an actual belief, claim, or proposition, expresses exactly one coherent parent belief, makes the WHAT of that belief clear enough for downstream Big Thought generation, needs no semantic repair, and does not materially need rewriting. Breadth may be intentional. Return proposedRootBelief null.",
    "ORIGINAL_READY does not mean the belief is objectively true, proven, formal, narrow, or well written.",
    "A topic only, a concept only, a question, an instruction, a request, an execution request, or a fragment with no actual claim does not itself contain a parent belief.",
    "Several materially independent beliefs with no single parent root are not one coherent parent belief and are not ORIGINAL_READY.",
    "When no parent belief is present, return UNRESOLVED. Do not invent a parent belief. Do not synthesize an umbrella belief. Do not use PROPOSAL_RECOMMENDED to create a belief the user never stated. Do not use CLARIFICATION_REQUIRED merely to ask the user to invent a belief.",
    "A weak or circular supporting WHY does not by itself remove a clear parent belief. Judge WHAT the parent belief is, not whether the supplied WHY is strong. Do not reject a clear parent belief only because its supporting WHY is circular, and do not ask for that WHY.",
    "Classify the result as exactly one outcome:",
    "PROPOSAL_RECOMMENDED only when one intended parent belief is already understood and the wording materially interferes with its role as the parent, while a reformulation preserves exactly that same belief without narrowing, expanding, changing it, adding reasoning, adding a WHY, adding assumptions, introducing a new claim, or synthesizing independent beliefs. Return proposedRootBelief and a brief formulationNote for the formulation problem the proposal resolves.",
    "Do not recommend a proposal because the wording is informal, could sound more professional, shorter, more elegant, more strategic, or more specific, or because another wording is preferred. Preservation is preferred over rewriting. If the original already works as the parent belief, return ORIGINAL_READY.",
    "CLARIFICATION_REQUIRED only when an actual belief is already present, WHAT that belief means is materially ambiguous, and that ambiguity would change which Big Thoughts should be generated. The Original Input cannot resolve it. Return one clarificationQuestion. clarificationOptions may be null or a list of answers. Do not return a proposed root belief.",
    "UNRESOLVED when no parent belief is present or you cannot safely choose one of the above. Fail closed.",
    "Do not copy the Original Input into proposedRootBelief merely to fill the field.",
    "Mark resolution RESOLVED only when every required field for the chosen outcome is decided.",
    "Otherwise mark UNRESOLVED and list unresolvedReasons.",
    "confidence is optional debug metadata. It does not decide the judgment.",
    LANGUAGE_RULE,
    "Return JSON only with this shape:",
    JSON.stringify({
      outcome: "ORIGINAL_READY",
      subject: "",
      proposedRootBelief: null,
      formulationNote: null,
      clarificationQuestion: null,
      clarificationOptions: null,
      ...(priorBelief ? { comparisonForm: "UNRESOLVED" } : {}),
      resolution: "RESOLVED",
      unresolvedReasons: [],
      confidence: 0,
    }),
    "Do not use examples from any specific industry, belief system, or brand.",
    "",
    "Original Input:",
    originalInput.trim(),
  ];
  if (priorBelief) {
    lines.push(
      "",
      "The prior belief is the belief being displaced. It is not a second parent belief and not a WHY.",
      "comparisonForm must be PRESENT, MISSING, or UNRESOLVED.",
      "Return comparisonForm PRESENT only when the Original Input already shifts that prior belief in one comparison.",
      "Return comparisonForm MISSING when the Original Input is one clear parent belief but does not yet name what it replaces. Then return PROPOSAL_RECOMMENDED. proposedRootBelief must preserve exactly that same claim and compare it with the prior belief. Do not add a WHY. Do not start proposedRootBelief with karena or because. Do not copy the prior belief into proposedRootBelief.",
      "Return comparisonForm UNRESOLVED when you cannot tell whether the Original Input already makes that shift.",
      "Prior belief:",
      priorBelief,
    );
  }
  if (audience) {
    lines.push(
      "",
      "The audience is only the people being addressed. Do not change the claim. Do not replace the subject with the audience. Do not invent a new belief because of the audience.",
      "Audience:",
      audience,
    );
  }
  if (clarification?.question.trim() && clarification.answer.trim()) {
    lines.push(
      "",
      "The user answered a previous clarification. Use that answer only as context for WHAT the parent belief means.",
      "Previous clarification question:",
      clarification.question.trim(),
      "User answer:",
      clarification.answer.trim(),
    );
  }
  return lines.join("\n");
}

export function unresolvedMasterThought(reason: string): MasterThoughtFacts {
  return {
    outcome: "UNRESOLVED",
    subject: null,
    proposedRootBelief: null,
    formulationNote: null,
    clarificationQuestion: null,
    clarificationOptions: null,
    resolution: "UNRESOLVED",
    unresolvedReasons: [reason],
  };
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asOutcome(value: unknown): UnderstandOutcome | null {
  return typeof value === "string" && OUTCOMES.has(value as UnderstandOutcome)
    ? (value as UnderstandOutcome)
    : null;
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

function namedSubject(value: unknown, beliefs: string[]): string | null {
  const subject = asText(value).replace(/\s+/g, " ");
  if (!subject) return null;
  const copiesBelief = beliefs.some((belief) => belief.replace(/\s+/g, " ").trim() === subject);
  return copiesBelief ? null : subject;
}

function beliefWords(value: string): string {
  return value
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function subjectCopiesSpan(subject: string, beliefs: string[]): boolean {
  const words = beliefWords(subject).split(" ").filter(Boolean);
  if (words.length < 4) return false;
  const span = words.join(" ");
  return beliefs.some((belief) => {
    const haystack = beliefWords(belief);
    if (!haystack || haystack === span || !haystack.includes(span)) return false;
    return !haystack.startsWith(`${span} `);
  });
}

function asOptions(value: unknown): string[] | null {
  if (value == null) return null;
  if (!Array.isArray(value)) return null;
  const options = value.map((row) => asText(row)).filter(Boolean);
  return options.length > 0 ? options : null;
}

function withConfidence(facts: MasterThoughtFacts, confidence: number | undefined): MasterThoughtFacts {
  if (confidence === undefined) return facts;
  return { ...facts, confidence };
}

function comparisonFormOf(raw: Record<string, unknown>): "PRESENT" | "MISSING" | "UNRESOLVED" | null {
  if (!Object.prototype.hasOwnProperty.call(raw, "comparisonForm")) return null;
  const value = raw.comparisonForm;
  return typeof value === "string" && COMPARISON_FORMS.has(value)
    ? (value as "PRESENT" | "MISSING" | "UNRESOLVED")
    : null;
}

function applyComparisonForm(
  facts: MasterThoughtFacts,
  raw: Record<string, unknown>,
  originalInput: string,
  priorBelief: string,
): MasterThoughtFacts {
  const prior = priorBelief.trim();
  if (!prior) return facts;
  const form = comparisonFormOf(raw);
  if (!form) return facts;
  const wouldPass = facts.outcome === "ORIGINAL_READY" || facts.outcome === "PROPOSAL_RECOMMENDED";
  if (!wouldPass) return facts;
  if (facts.outcome === "PROPOSAL_RECOMMENDED") {
    const kept = facts.proposedRootBelief ?? "";
    if (beliefsMatch(kept, prior)) return unresolvedMasterThought("PROPOSAL_IS_PRIOR");
    if (startsWithBecause(kept)) return unresolvedMasterThought("PROPOSAL_IS_BECAUSE");
  }
  if (form === "UNRESOLVED") return unresolvedMasterThought("COMPARISON_UNRESOLVED");
  if (form === "PRESENT") return facts;
  const proposal = asText(raw.proposedRootBelief) || facts.proposedRootBelief || "";
  const note = asText(raw.formulationNote) || facts.formulationNote || "";
  if (proposal && beliefsMatch(proposal, prior)) return unresolvedMasterThought("PROPOSAL_IS_PRIOR");
  if (proposal && startsWithBecause(proposal)) return unresolvedMasterThought("PROPOSAL_IS_BECAUSE");
  if (!proposal || !note || beliefsMatch(proposal, originalInput)) return unresolvedMasterThought("COMPARISON_MISSING");
  const subject = namedSubject(facts.subject ?? raw.subject, [originalInput, proposal, prior]);
  if (!subject) return unresolvedMasterThought("SUBJECT_UNNAMED");
  return {
    outcome: "PROPOSAL_RECOMMENDED",
    subject,
    proposedRootBelief: proposal,
    formulationNote: note,
    clarificationQuestion: null,
    clarificationOptions: null,
    resolution: "RESOLVED",
    unresolvedReasons: [],
    ...(facts.confidence === undefined ? {} : { confidence: facts.confidence }),
  };
}

export function normalizeMasterThoughtFacts(
  raw: unknown,
  originalInput = "",
  priorBelief = "",
  gate?: { rejectCopiedSubject?: boolean },
): MasterThoughtFacts {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return unresolvedMasterThought("JUDGE_UNPARSEABLE");
  }
  const row = raw as Record<string, unknown>;
  const outcome = asOutcome(row.outcome);
  if (!outcome) return unresolvedMasterThought("JUDGE_UNPARSEABLE");
  const proposal = asText(row.proposedRootBelief) || null;
  const note = asText(row.formulationNote) || null;
  const question = asText(row.clarificationQuestion) || null;
  const options = asOptions(row.clarificationOptions);
  const resolution = asResolution(row.resolution);
  const reasons = asReasons(row.unresolvedReasons);
  const confidence = asConfidence(row.confidence);
  const original = originalInput.trim();
  const prior = priorBelief.trim();
  const finish = (facts: MasterThoughtFacts) => {
    if (gate?.rejectCopiedSubject && facts.subject && subjectCopiesSpan(facts.subject, [original, prior, facts.proposedRootBelief ?? ""])) {
      return unresolvedMasterThought("SUBJECT_IS_FRAGMENT");
    }
    return applyComparisonForm(facts, row, original, priorBelief);
  };

  if (outcome === "ORIGINAL_READY") {
    const subject = namedSubject(row.subject, [original]);
    if (!subject) return unresolvedMasterThought("SUBJECT_UNNAMED");
    return finish(withConfidence(
      {
        outcome: "ORIGINAL_READY",
        subject,
        proposedRootBelief: null,
        formulationNote: null,
        clarificationQuestion: null,
        clarificationOptions: null,
        resolution,
        unresolvedReasons: reasons,
      },
      confidence,
    ));
  }

  if (outcome === "PROPOSAL_RECOMMENDED") {
    if (proposal && original && proposal === original) {
      const subject = namedSubject(row.subject, [original]);
      if (!subject) return unresolvedMasterThought("SUBJECT_UNNAMED");
      return finish(withConfidence(
        {
          outcome: "ORIGINAL_READY",
          subject,
          proposedRootBelief: null,
          formulationNote: null,
          clarificationQuestion: null,
          clarificationOptions: null,
          resolution,
          unresolvedReasons: reasons,
        },
        confidence,
      ));
    }
    if (!proposal || !note) return unresolvedMasterThought(reasons[0] ?? "INCOMPLETE_PROPOSAL");
    const subject = namedSubject(row.subject, [original, proposal]);
    if (!subject) return unresolvedMasterThought("SUBJECT_UNNAMED");
    return finish(withConfidence(
      {
        outcome: "PROPOSAL_RECOMMENDED",
        subject,
        proposedRootBelief: proposal,
        formulationNote: note,
        clarificationQuestion: null,
        clarificationOptions: null,
        resolution,
        unresolvedReasons: reasons,
      },
      confidence,
    ));
  }

  if (outcome === "CLARIFICATION_REQUIRED") {
    if (!question) return unresolvedMasterThought(reasons[0] ?? "MISSING_CLARIFICATION");
    return finish(withConfidence(
      {
        outcome: "CLARIFICATION_REQUIRED",
        subject: null,
        proposedRootBelief: null,
        formulationNote: null,
        clarificationQuestion: question,
        clarificationOptions: options,
        resolution,
        unresolvedReasons: reasons,
      },
      confidence,
    ));
  }

  const unresolved = unresolvedMasterThought(reasons[0] ?? "UNRESOLVED");
  return finish(withConfidence(unresolved, confidence));
}

export function parseMasterThoughtFacts(
  script: string | null,
  originalInput: string,
  priorBelief = "",
): MasterThoughtFacts {
  if (!script?.trim()) return unresolvedMasterThought("JUDGE_UNAVAILABLE");
  const parsed = parseModelJson(script);
  if (parsed == null) return unresolvedMasterThought("JUDGE_UNPARSEABLE");
  return normalizeMasterThoughtFacts(parsed, originalInput, priorBelief, { rejectCopiedSubject: true });
}

export async function judgeMasterThought(
  originalInput: string,
  ask: (prompt: string) => Promise<string | null>,
  clarification?: UnderstandClarification,
  context?: MasterThoughtJudgeContext,
): Promise<MasterThoughtFacts> {
  if (!originalInput.trim()) return unresolvedMasterThought("EMPTY_INPUT");
  const priorBelief = context?.priorBelief?.trim() ?? "";
  if (priorBelief && beliefsMatch(originalInput, priorBelief)) return unresolvedMasterThought("SAME_BELIEF");
  return parseMasterThoughtFacts(
    await ask(buildMasterThoughtJudgePrompt(originalInput, clarification, context)),
    originalInput,
    priorBelief,
  );
}

export function understandFingerprint(originalInput: string, proposedRootBelief: string | null): string {
  return masterThoughtFingerprint({ statement: originalInput, rootBelief: proposedRootBelief ?? "" });
}

export function confirmedFingerprint(statement: string, rootBelief: string): string {
  return masterThoughtFingerprint({ statement, rootBelief });
}

export function assessMasterThought(
  facts: MasterThoughtFacts | null,
  factsCurrent: boolean,
): MasterAdmission {
  if (!factsCurrent) return facts ? "STALE" : "UNRESOLVED";
  if (!facts) return "UNRESOLVED";
  if (facts.resolution !== "RESOLVED" || facts.unresolvedReasons.length > 0) return "UNRESOLVED";
  if (!facts.subject?.trim()) return "UNRESOLVED";
  if (facts.outcome === "ORIGINAL_READY") return "USABLE";
  if (facts.outcome === "PROPOSAL_RECOMMENDED" && facts.proposedRootBelief?.trim() && facts.formulationNote?.trim()) {
    return "USABLE";
  }
  return "UNRESOLVED";
}

export function factsMatchStoredFingerprint(input: {
  facts: MasterThoughtFacts | null;
  storedFingerprint: string | null;
  originalInput: string;
  proposedRootBelief: string | null;
}): boolean {
  return fingerprintsMatch(
    input.storedFingerprint,
    understandFingerprint(input.originalInput, input.proposedRootBelief),
  );
}

export function resolveConfirmation(input: {
  source: ConfirmationSource;
  originalInput: string;
  proposedRootBelief: string | null;
  facts: MasterThoughtFacts | null;
  factsCurrent: boolean;
}): { ok: true; statement: string } | { ok: false; admission: MasterAdmission } {
  const admission = assessMasterThought(input.facts, input.factsCurrent);
  if (admission !== "USABLE" || !input.facts) return { ok: false, admission };
  if (input.source === "original" || (input.source === "edited" && input.facts.outcome === "ORIGINAL_READY")) {
    if (input.facts.outcome !== "ORIGINAL_READY" && input.facts.outcome !== "PROPOSAL_RECOMMENDED") {
      return { ok: false, admission: "UNRESOLVED" };
    }
    const statement = input.originalInput.trim();
    if (!statement) return { ok: false, admission: "UNRESOLVED" };
    return { ok: true, statement };
  }
  if (input.facts.outcome !== "PROPOSAL_RECOMMENDED") return { ok: false, admission: "UNRESOLVED" };
  const proposed = (input.proposedRootBelief ?? input.facts.proposedRootBelief ?? "").trim();
  if (!proposed) return { ok: false, admission: "UNRESOLVED" };
  return { ok: true, statement: proposed };
}

export function confirmedParentReady(input: {
  confirmationSource: string | null;
  statement: string;
  rootBelief: string;
  semanticFingerprint: string | null;
}): boolean {
  if (!input.confirmationSource || !input.statement.trim()) return false;
  return fingerprintsMatch(
    input.semanticFingerprint,
    confirmedFingerprint(input.statement, input.rootBelief || input.statement),
  );
}

export function understandPersistMode(input: {
  confirmationSource: string | null;
  confirmedStatement: string;
  storedOriginalInput: string;
  nextOriginalInput: string;
}): UnderstandPersistMode {
  const confirmed = Boolean(input.confirmationSource) && input.confirmedStatement.trim().length > 0;
  const sameOriginal = input.nextOriginalInput.trim() === input.storedOriginalInput.trim();
  if (confirmed && sameOriginal) return "display_only";
  return "replace_understanding";
}

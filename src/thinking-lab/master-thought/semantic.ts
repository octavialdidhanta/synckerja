import { parseModelJson } from "@/thinking-lab/shared/ai";
import {
  fingerprintsMatch,
  masterThoughtFingerprint,
} from "@/thinking-lab/shared/fingerprint";
import type { Resolution } from "@/thinking-lab/shared/verdict";
import type {
  BeliefOption,
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
    "Name the subject as one dense clause in the same language as the Master Thought. The subject is shorter than the belief. A reader who sees only that clause must still hold the belief. Keep the shift: the contrast, the result, and the degree. Fewer words come from tighter wording. Leaving a claim out is not a shorter subject. Do not stitch leftover words from different parts of the sentence. A subject that repeats the belief with one or two words changed is still the belief. It is not a full sentence copied whole, not a noun title, and not a reason.",
    "The subject starts with a capital letter.",
    "That clause must stay grammatical immediately before karena or because, and it must later be visible as the cause at Idea. Read the subject, then a comma, then karena. It must sound like one spoken sentence. A heading that starts with Kemampuan or The ability is not a subject.",
    "A near copy is not a subject. A noun phrase or other span lifted from the middle of the sentence is not a subject.",
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
    "When a belief is present but you cannot safely choose ORIGINAL_READY or PROPOSAL_RECOMMENDED, return CLARIFICATION_REQUIRED with one question about WHAT that belief means. Do not return UNRESOLVED while a belief is present.",
    "UNRESOLVED only when no parent belief is present. Fail closed.",
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

function withCapital(subject: string): string {
  const characters = Array.from(subject);
  const index = characters.findIndex((character) => /\p{L}/u.test(character));
  if (index < 0) return subject;
  characters[index] = characters[index].toLocaleUpperCase();
  return characters.join("");
}

function namedSubject(value: unknown, beliefs: string[]): string | null {
  const subject = asText(value).replace(/\s+/g, " ");
  if (!subject) return null;
  const copiesBelief = beliefs.some((belief) => belief.replace(/\s+/g, " ").trim() === subject);
  return copiesBelief ? null : withCapital(subject);
}

function beliefWords(value: string): string {
  return value
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wordStem(word: string): string {
  return word.replace(/(?:nya|kah|lah|pun)$/i, "");
}

function subjectStitchesBelief(subject: string, beliefs: string[]): boolean {
  const words = beliefWords(subject).split(" ").filter(Boolean);
  if (words.length < 4) return false;
  const stems = words.map(wordStem).filter((word) => word.length >= 4);
  if (stems.length < 4) return false;
  return beliefs.some((belief) => {
    const text = beliefWords(belief);
    if (!text || text.includes(words.join(" "))) return false;
    const known = new Set(text.split(" ").map(wordStem).filter((word) => word.length >= 4));
    return stems.every((word) => known.has(word));
  });
}

function subjectSoundsLikeTitle(subject: string): boolean {
  return /^(?:kemampuan|kemungkinan|pentingnya|adanya|the ability|the possibility|the importance)\b/i.test(subject.trim());
}

function subjectRepeatsBelief(subject: string, beliefs: string[]): boolean {
  const subjectWords = beliefWords(subject).split(" ").filter(Boolean);
  if (subjectWords.length < 8) return false;
  return beliefs.some((belief) => {
    const beliefWordsList = beliefWords(belief).split(" ").filter(Boolean);
    if (beliefWordsList.length < 8) return false;
    if (subjectWords.length < Math.ceil(beliefWordsList.length * 0.8)) return false;
    const known = new Set(beliefWordsList.map(wordStem));
    const shared = subjectWords.filter((word) => known.has(wordStem(word))).length;
    return shared / subjectWords.length >= 0.8;
  });
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
  const beliefOptions = asBeliefOptions(row.beliefOptions);
  const resolution = asResolution(row.resolution);
  const reasons = asReasons(row.unresolvedReasons);
  const confidence = asConfidence(row.confidence);
  const original = originalInput.trim();
  const prior = priorBelief.trim();
  if (outcome === "UNRESOLVED" && beliefOptions) {
    return {
      outcome: "UNRESOLVED",
      subject: null,
      proposedRootBelief: null,
      formulationNote: null,
      clarificationQuestion: null,
      clarificationOptions: null,
      resolution: "UNRESOLVED",
      unresolvedReasons: reasons.length > 0 ? reasons : ["CHOOSE_BELIEF"],
      beliefOptions,
    };
  }
  const finish = (facts: MasterThoughtFacts) => {
    if (
      gate?.rejectCopiedSubject &&
      facts.subject &&
      (subjectCopiesSpan(facts.subject, [original, prior, facts.proposedRootBelief ?? ""]) ||
        subjectStitchesBelief(facts.subject, [original, prior, facts.proposedRootBelief ?? ""]) ||
        subjectRepeatsBelief(facts.subject, [original, prior, facts.proposedRootBelief ?? ""]) ||
        subjectSoundsLikeTitle(facts.subject))
    ) {
      return unresolvedMasterThought("SUBJECT_IS_FRAGMENT");
    }
    return applyComparisonForm(facts, row, original, priorBelief);
  };

  if (row.accepted === true && outcome === "ORIGINAL_READY") {
    const subject = asText(row.subject);
    if (subject) {
      return {
        outcome: "ORIGINAL_READY",
        subject,
        proposedRootBelief: null,
        formulationNote: null,
        clarificationQuestion: null,
        clarificationOptions: null,
        resolution: "RESOLVED",
        unresolvedReasons: [],
        accepted: true,
      };
    }
  }

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

const LEADING_TERNYATA = /^\s*ternyata\b[\s,:]*/i;

function recordOf(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

function sameClaim(left: string, right: string): boolean {
  const claim = (value: string) => beliefClaim(value).toLocaleLowerCase();
  return beliefsMatch(claim(left), claim(right));
}

function readBeliefOption(item: unknown): BeliefOption | null {
  if (typeof item === "string") {
    const belief = item.replace(/\s+/g, " ").trim();
    return belief ? { belief, description: "" } : null;
  }
  const row = recordOf(item);
  if (!row) return null;
  const belief = asText(row.belief ?? row.text).replace(/\s+/g, " ").trim();
  if (!belief) return null;
  return { belief, description: asText(row.description ?? row.note).replace(/\s+/g, " ").trim() };
}

function asBeliefOptions(value: unknown): BeliefOption[] | null {
  if (!Array.isArray(value)) return null;
  const options = value.flatMap((item) => {
    const option = readBeliefOption(item);
    return option ? [option] : [];
  }).slice(0, 3);
  return options.length > 0 ? options : null;
}

/** The claim without a leading Ternyata, used to compare beliefs and to name the subject. */
export function beliefClaim(value: string): string {
  return value.replace(LEADING_TERNYATA, "").replace(/\s+/g, " ").trim();
}

export function subjectFromBelief(belief: string): string {
  const claim = beliefClaim(belief);
  return withCapital(claim || belief.replace(/\s+/g, " ").trim());
}

/** Drop empty lines, reasons, titles, the old belief, and duplicates. A leading Ternyata is ignored. */
export function filterBeliefCandidates(candidates: Array<string | BeliefOption>, priorBelief = ""): BeliefOption[] {
  const seen = new Set<string>();
  const kept: BeliefOption[] = [];
  for (const raw of candidates) {
    const option = readBeliefOption(raw);
    if (!option) continue;
    const choice = option.belief;
    const claim = beliefClaim(choice);
    if (!claim) continue;
    if (startsWithBecause(choice) || startsWithBecause(claim)) continue;
    if (subjectSoundsLikeTitle(claim) || subjectSoundsLikeTitle(choice)) continue;
    if (priorBelief.trim() && sameClaim(choice, priorBelief)) continue;
    const key = claim.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push({ belief: withCapital(choice), description: option.description });
  }
  return kept;
}

export function buildBeliefOptionsPrompt(input: {
  planted: string;
  priorBelief?: string;
  audience?: string;
}): string {
  const priorBelief = input.priorBelief?.trim() ?? "";
  const audience = input.audience?.trim() ?? "";
  return [
    "Write three beliefs the user can plant as a Master Thought.",
    "Each belief states exactly one claim. A sentence that joins two independent beliefs with dan or and is not one claim.",
    "Length may be short or detailed. Do not prefer a shorter sentence.",
    "Each belief is one grammatical clause. Read the belief, then a comma, then karena or because. It must sound like one spoken sentence.",
    "Do not start a belief with karena or because.",
    "Do not copy the old belief.",
    "Start a belief with Ternyata only when that belief shifts the old belief.",
    "A belief that already stands on its own does not start with Ternyata.",
    "Ternyata is optional. Do not add it to every belief.",
    "Stay inside the shift between the old belief and the new belief.",
    "Do not add a topic, benefit, feeling, or situation that neither of those sentences carries.",
    "Each description says what this belief asks someone to hold, and how it shifts the old belief.",
    "Write the description in the same language as the belief. Two or three sentences are enough.",
    "Write every belief in the same language as the new belief.",
    "Return JSON only: {\"beliefs\":[{\"belief\":\"\",\"description\":\"\"}]}",
    "Do not use examples from any specific industry, belief system, or brand.",
    "",
    "New belief:",
    input.planted.trim(),
    ...(priorBelief ? ["", "Old belief:", priorBelief] : []),
    ...(audience
      ? ["", "The audience is only who is addressed. Do not replace the claim with the audience.", "Audience:", audience]
      : []),
  ].join("\n");
}

export function parseBeliefDrafts(raw: unknown): BeliefOption[] {
  const row = recordOf(raw);
  const list = Array.isArray(raw) ? raw : Array.isArray(row?.beliefs) ? row.beliefs : [];
  return list.flatMap((item) => {
    const option = readBeliefOption(item);
    return option ? [option] : [];
  }).slice(0, 3);
}

export function buildBeliefOptionCheckPrompt(input: {
  beliefs: string[];
  planted: string;
  priorBelief?: string;
}): string {
  const priorBelief = input.priorBelief?.trim() ?? "";
  return [
    "Judge each belief on its own.",
    "Pass only when it states exactly one claim and reads as one spoken sentence before karena or because.",
    "A sentence that joins two independent beliefs with dan or and fails.",
    "A title, a fragment, or a line that starts with karena or because fails.",
    "Fail a belief that leaves the shift between the old belief and the new belief.",
    "Fail a belief that adds a topic, benefit, feeling, or situation that neither the old belief nor the new belief carries.",
    "A leading Ternyata does not change the claim and does not by itself fail the belief.",
    "Return JSON only: {\"results\":[{\"index\":0,\"pass\":true}]}",
    "Include one result for every belief below. index is the number shown before that belief.",
    "",
    "New belief:",
    input.planted.trim(),
    ...(priorBelief ? ["", "Old belief:", priorBelief] : []),
    "",
    "Beliefs:",
    ...input.beliefs.map((belief, index) => `${index}: ${belief}`),
  ].join("\n");
}

export function parseBeliefOptionChecks(raw: unknown, count: number): boolean[] {
  const passes = Array.from({ length: Math.max(0, count) }, () => false);
  const row = recordOf(raw);
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(row?.results)
      ? row.results
      : Array.isArray(row?.beliefs)
        ? row.beliefs
        : [];
  for (const item of list) {
    const entry = recordOf(item);
    if (!entry) continue;
    const index = typeof entry.index === "number" ? entry.index : Number(entry.index);
    const pass = entry.pass === true || entry.pass === "true";
    if (!pass || !Number.isInteger(index) || index < 0 || index >= passes.length) continue;
    passes[index] = true;
  }
  return passes;
}

export function beliefChoiceFacts(options: BeliefOption[]): MasterThoughtFacts {
  const beliefOptions = options
    .flatMap((option) => {
      const belief = option.belief.replace(/\s+/g, " ").trim();
      return belief ? [{ belief: withCapital(belief), description: option.description.replace(/\s+/g, " ").trim() }] : [];
    })
    .slice(0, 3);
  if (beliefOptions.length === 0) return unresolvedMasterThought("NO_BELIEF_OPTIONS");
  return {
    outcome: "UNRESOLVED",
    subject: null,
    proposedRootBelief: null,
    formulationNote: null,
    clarificationQuestion: null,
    clarificationOptions: null,
    resolution: "UNRESOLVED",
    unresolvedReasons: ["CHOOSE_BELIEF"],
    beliefOptions,
  };
}

/** Ask for three beliefs, then keep only the ones the model passes as one claim before karena. */
export async function collectBeliefOptions(
  input: { planted: string; priorBelief?: string; audience?: string },
  ask: (prompt: string) => Promise<string | null>,
): Promise<MasterThoughtFacts> {
  const planted = input.planted.trim();
  const prior = input.priorBelief?.trim() ?? "";
  if (!planted) return unresolvedMasterThought("EMPTY_INPUT");
  if (prior && beliefsMatch(beliefClaim(planted), beliefClaim(prior))) return unresolvedMasterThought("SAME_BELIEF");
  const drafted = parseBeliefDrafts(parseModelJson(await ask(buildBeliefOptionsPrompt({ planted, priorBelief: prior, audience: input.audience }))));
  const candidates = filterBeliefCandidates(drafted, prior).filter((option) => !sameClaim(option.belief, planted));
  if (candidates.length === 0) return unresolvedMasterThought("NO_BELIEF_OPTIONS");
  const passes = parseBeliefOptionChecks(
    parseModelJson(
      await ask(
        buildBeliefOptionCheckPrompt({
          beliefs: candidates.map((option) => option.belief),
          planted,
          priorBelief: prior,
        }),
      ),
    ),
    candidates.length,
  );
  return beliefChoiceFacts(candidates.filter((_, index) => passes[index]));
}

/** The picked belief is ready to confirm. Its subject is that belief without a leading Ternyata. */
export function acceptPlantedBelief(belief: string): MasterThoughtFacts {
  const statement = belief.replace(/\s+/g, " ").trim();
  return {
    outcome: "ORIGINAL_READY",
    subject: subjectFromBelief(statement),
    proposedRootBelief: null,
    formulationNote: null,
    clarificationQuestion: null,
    clarificationOptions: null,
    resolution: "RESOLVED",
    unresolvedReasons: [],
    accepted: true,
    beliefOptions: null,
  };
}

/** The user picked a subject, or kept the written new belief. The stored new belief stays as written. */
export function acceptChosenBelief(choice: string): MasterThoughtFacts {
  const statement = choice.replace(/\s+/g, " ").trim();
  return {
    outcome: "ORIGINAL_READY",
    subject: withCapital(statement),
    proposedRootBelief: null,
    formulationNote: null,
    clarificationQuestion: null,
    clarificationOptions: null,
    resolution: "RESOLVED",
    unresolvedReasons: [],
    accepted: true,
  };
}

export type MasterRecovery = "clarify" | "retry" | "edit";

/** What the user can do when Understand stopped without a parent belief. */
export function masterRecovery(
  facts: MasterThoughtFacts | null,
  originalInput: string,
  priorBelief: string,
): MasterRecovery | null {
  if (!facts || facts.outcome !== "UNRESOLVED") return null;
  if (!originalInput.trim()) return null;
  const reason = facts.unresolvedReasons[0] ?? "UNRESOLVED";
  if (reason === "EMPTY_INPUT" || reason === "CHOOSE_BELIEF" || reason === "NO_BELIEF_OPTIONS") return null;
  if (reason === "SAME_BELIEF" || beliefsMatch(originalInput, priorBelief)) return "edit";
  if (reason === "JUDGE_UNAVAILABLE" || reason === "JUDGE_UNPARSEABLE") return "retry";
  return "clarify";
}

export function buildMasterChoicePrompt(input: {
  originalInput: string;
  priorBelief?: string;
  audience?: string;
  question: string;
}): string {
  const priorBelief = input.priorBelief?.trim() ?? "";
  const audience = input.audience?.trim() ?? "";
  return [
    "Offer three subjects for the new belief. A subject does not replace that belief.",
    "One subject is shorter than the new belief. The other two may stay closer to its length.",
    "A shorter subject still says the whole belief. Fewer words come from tighter wording.",
    "Leaving out a shift, a result, a degree, or who it reaches is not a shorter subject.",
    "If the new belief states a change and then what that change produces, every subject keeps both.",
    "Each subject is one grammatical clause in the same language as the new belief.",
    "A reader who sees only the shorter subject must still hold the new belief.",
    "Say each subject, then a comma, then karena. It must sound like one spoken sentence. Do not start a subject with Kemampuan or The ability.",
    "Do not add a WHY. Do not start a subject with karena or because.",
    "Do not copy the old belief. Do not invent a claim the new belief does not carry.",
    "Also recommend one clearer wording of the new belief when the written sentence can be said more clearly and still means the same thing.",
    "If the written new belief should stay, return an empty belief. Do not return the written sentence again.",
    "A subject is not that recommended belief. Do not put the same sentence in both.",
    "Return JSON only: {\"subjects\":[\"\",\"\",\"\"],\"belief\":\"\"}",
    "Do not use examples from any specific industry, belief system, or brand.",
    "",
    "Question:",
    input.question.trim(),
    "",
    "New belief:",
    input.originalInput.trim(),
    ...(priorBelief ? ["", "Old belief:", priorBelief] : []),
    ...(audience
      ? ["", "The audience is only who is addressed. Do not replace the claim with the audience.", "Audience:", audience]
      : []),
  ].join("\n");
}

export type MasterChoiceSet = {
  subjects: string[];
  beliefs: string[];
};

function choiceRewritesBelief(choice: string, belief: string): boolean {
  const planted = belief.trim();
  if (!planted) return false;
  if (beliefsMatch(choice, planted) || subjectRepeatsBelief(choice, [planted])) return true;
  const choiceWords = beliefWords(choice).split(" ").filter(Boolean);
  const beliefList = beliefWords(planted).split(" ").filter(Boolean);
  if (choiceWords.length < 6 || beliefList.length < 6) return false;
  if (choiceWords.length < Math.ceil(beliefList.length * 0.75)) return false;
  const known = new Set(beliefList.map(wordStem));
  const shared = choiceWords.filter((word) => known.has(wordStem(word))).length;
  return shared / choiceWords.length >= 0.55;
}

function cleanChoice(item: unknown, prior: string): string {
  const choice = typeof item === "string" ? item.replace(/\s+/g, " ").trim() : "";
  if (!choice || startsWithBecause(choice) || subjectSoundsLikeTitle(choice)) return "";
  if (prior && beliefsMatch(choice, prior)) return "";
  return choice;
}

/** Subjects stay beside the written belief. A near-copy is a recommended new belief. */
export function parseMasterChoiceSet(
  raw: unknown,
  context?: { priorBelief?: string; originalInput?: string },
): MasterChoiceSet {
  const prior = context?.priorBelief?.trim() ?? "";
  const original = context?.originalInput?.trim() ?? "";
  const record =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as { belief?: unknown; subjects?: unknown; choices?: unknown })
      : null;
  const listed = Array.isArray(raw)
    ? raw
    : Array.isArray(record?.subjects)
      ? record.subjects
      : Array.isArray(record?.choices)
        ? record.choices
        : [];
  const subjects: string[] = [];
  const beliefs: string[] = [];
  const seen = new Set<string>();
  const take = (choice: string) => {
    const key = choice.toLocaleLowerCase();
    if (!choice || seen.has(key)) return;
    seen.add(key);
    if (original && beliefsMatch(choice, original)) return;
    if (original && choiceRewritesBelief(choice, original)) {
      if (beliefs.length < 3) beliefs.push(choice);
      return;
    }
    if (subjects.length < 3) subjects.push(choice);
  };
  take(cleanChoice(record?.belief, prior));
  for (const item of listed) take(cleanChoice(item, prior));
  return { subjects, beliefs };
}

export function parseMasterChoices(raw: unknown, context?: { priorBelief?: string; originalInput?: string }): string[] {
  return parseMasterChoiceSet(raw, context).subjects;
}

export function masterRecoveryQuestionKey(reason: string): string {
  if (reason === "COMPARISON_UNRESOLVED" || reason === "COMPARISON_MISSING") return "thinkingLab.master.recover.comparison";
  if (reason === "SUBJECT_UNNAMED" || reason === "SUBJECT_IS_FRAGMENT") return "thinkingLab.master.recover.subject";
  if (reason === "PROPOSAL_IS_BECAUSE") return "thinkingLab.master.recover.because";
  if (reason === "PROPOSAL_IS_PRIOR") return "thinkingLab.master.recover.prior";
  return "thinkingLab.master.recover.clarify";
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

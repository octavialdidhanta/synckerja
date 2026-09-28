import { parseModelJson } from "@/thinking-lab/shared/ai";
import type { Resolution, TriState } from "@/thinking-lab/shared/verdict";
import type {
  BigThoughtFacts,
  ChallengerFacts,
  ChallengerStatus,
  MissingWhy,
  ParentRelation,
  SiblingSetFacts,
  SupportRole,
} from "@/thinking-lab/big-thought/types";

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

function asSupportRole(value: unknown): SupportRole {
  return value === "PREMISE" || value === "REASON" || value === "EVIDENCE" || value === "UNRESOLVED"
    ? value
    : "UNRESOLVED";
}

export function unresolvedBigThought(code: string, reason: string): BigThoughtFacts {
  return {
    code,
    whatItSays: "",
    relationToParent: "UNRESOLVED",
    supportRole: "UNRESOLVED",
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
    supportRole: legacyPositive ? "UNRESOLVED" : asSupportRole(row.supportRole),
    explainsWhyParentIsTrue: legacyPositive ? "unresolved" : asTri(row.explainsWhyParentIsTrue),
    introducesUnsupportedPremise: asTri(row.introducesUnsupportedPremise),
    duplicateOfCode: asText(row.duplicateOfCode) || null,
    resolution: asResolution(row.resolution),
    unresolvedReasons: asReasons(row.unresolvedReasons),
  };
  const confidence = asConfidence(row.confidence);
  if (confidence !== undefined) facts.confidence = confidence;
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
  if (
    facts.resolution === "RESOLVED" &&
    facts.relationToParent === "DISTINCT_MATERIAL_SUPPORT" &&
    facts.supportRole === "UNRESOLVED"
  ) {
    facts.resolution = "UNRESOLVED";
    facts.unresolvedReasons = [...facts.unresolvedReasons, "SUPPORT_ROLE_UNRESOLVED"];
  }
  if (facts.resolution !== "RESOLVED" || facts.relationToParent === "UNRESOLVED") {
    facts.introducesUnsupportedPremise = "unresolved";
  } else if (facts.relationToParent === "UNSUPPORTED_PREMISE") {
    facts.introducesUnsupportedPremise = true;
  }
  return facts;
}

export function buildBigThoughtJudgePrompt(input: {
  parentStatement: string;
  candidate: { code: string; statement: string };
  siblings: Array<{ code: string; statement: string }>;
}): string {
  const siblingLines = input.siblings.length
    ? input.siblings.map((row) => `${row.code}: ${row.statement}`).join("\n")
    : "(none)";
  return [
    "You are the canonical semantic judge for one Big Thought.",
    "A Big Thought is a distinct material reason, basis, or evidence that substantively supports why the Master Thought is true, important, or defensible, without merely restating, unpacking, or executing the Master Thought.",
    "A valid Big Thought is a distinct material support for the Master Thought.",
    "It may operate as a PREMISE, REASON, or EVIDENCE.",
    "The key question is not whether the candidate is upstream in every logical sense, but whether it contributes a distinct, material argumentative reason for accepting the Master Thought.",
    "Classify exclusions by argumentative function, not by surface form. A statement is not invalid merely because it describes an outcome, effect, behavior, or example.",
    "Before choosing DISTINCT_MATERIAL_SUPPORT, apply these tests.",
    "Parent Conclusion Test: before classifying a candidate as DISTINCT_MATERIAL_SUPPORT, first identify the semantic conclusion of the Master Thought and the semantic conclusion of the candidate.",
    "If both conclusions impose substantially the same responsibility, obligation, judgment, decision, or belief on the same subject, the candidate must not be classified as DISTINCT_MATERIAL_SUPPORT.",
    "If the candidate merely restates the same conclusion with different wording, classify RESTATEMENT.",
    "If it narrows, specifies, operationalizes, or unpacks part of the parent conclusion, classify ELABORATION.",
    "More detail, stronger moral language, or more specific wording is not material support.",
    "Ask whether this candidate explains why the parent conclusion should be accepted, or whether it merely says the parent conclusion again in another form. If it merely says the conclusion again, it must not be DISTINCT_MATERIAL_SUPPORT.",
    "A parent of the form 'X is exceptionally good' and a candidate of the form 'X is fundamentally good and compassionate' is RESTATEMENT. It repeats the evaluation at another level of abstraction.",
    "Conclusion-Substitution Test: replace the Master Thought with the candidate in the argument. If the candidate can function as substantially the same conclusion, even at a broader, narrower, more abstract, more moral, or more specific level, classify RESTATEMENT or ELABORATION. Different wording, abstraction, or vocabulary is not enough.",
    "Because Test: try the form 'the Master Thought is true because [candidate]'. If the result is circular, tautological, or only says the parent again in another form, the candidate must not be DISTINCT_MATERIAL_SUPPORT.",
    "Job Form Test: join the texts as '[Master Thought], because [candidate]' by inserting only the word because. becauseForm is CLAUSE when that sentence is already grammatical and the candidate finishes the belief, including its comparison, without repeating the Master Thought and without opening a separate claim. STANDALONE when the candidate is its own sentence and would need to be rewritten before it can follow because. NOMINAL when it only names an area. OBSERVATION when it is a rarely noticed observation rather than a reason. UNRESOLVED when that cannot be decided.",
    "Do not return DISTINCT_MATERIAL_SUPPORT unless becauseForm is CLAUSE. A sentence that merely could be forced after because, while still introducing a new claim, is STANDALONE.",
    "A parent of the form 'X remains responsible after Y' and a candidate of the form 'X has an ongoing responsibility after Y' is a restatement.",
    "Normative-Conclusion Guard: when the Master Thought is normative, another normative duty for the same subject is especially likely to be RESTATEMENT or ELABORATION unless it supplies a distinct material support.",
    "Argumentative Support Test: does this downstream fact materially increase the rational support for believing the Master Thought?",
    "If yes, the candidate can be DISTINCT_MATERIAL_SUPPORT with supportRole EVIDENCE even when its surface form is an effect, behavior, or outcome.",
    "If no, and the candidate only says what follows after the parent, classify OUTCOME or CONSEQUENCE.",
    "A parent of the form 'X is exceptionally good' and a candidate of the form 'X remains empathetic toward others even under pressure' can be DISTINCT_MATERIAL_SUPPORT with supportRole EVIDENCE. Removing it would remove a distinct observable reason for the evaluation.",
    "A parent of the form 'X is exceptionally good' and a candidate of the form 'X's presence consistently increases other people's sense of safety and wellbeing' can be DISTINCT_MATERIAL_SUPPORT with supportRole EVIDENCE when that effect materially supports the evaluation. Do not classify OUTCOME merely because the surface form is an effect.",
    "If this candidate were removed, would a distinct material reason or evidence for believing the parent disappear? If yes, the candidate has its own reasoning job.",
    "supportRole PREMISE is an underlying proposition or principle that helps produce the parent conclusion.",
    "supportRole REASON is a distinct substantive consideration for accepting or evaluating the parent.",
    "supportRole EVIDENCE is an observation, pattern, effect, behavior, result, or fact that argumentatively supports the parent.",
    "A parent of the form 'X should carefully choose a steward' and a candidate of the form 'different stewards can produce materially different outcomes' can be DISTINCT_MATERIAL_SUPPORT with supportRole PREMISE or REASON, because it supplies a different causal premise.",
    "CRITERION defines a standard for judging, such as 'a good person must have empathy'. It does not show that this subject meets that standard. Classify CRITERION.",
    "EVIDENCE reports that the subject actually does something material, such as consistently showing empathy under pressure.",
    "EXAMPLE is only a weak or non-material illustration. A recurring pattern or meaningful observation that materially strengthens the case can be EVIDENCE.",
    "METHOD, TACTIC, and EXECUTION explain how the parent is carried out. They are exclusions unless they also supply a distinct reason the parent is true.",
    "UNSUPPORTED_PREMISE is a premise-shaped claim whose argumentative value depends on a materially specific factual assertion whose certainty or specificity is not defensible from the available reasoning and would normally require independent evidence. New information by itself is not UNSUPPORTED_PREMISE.",
    "Material Contribution Test: a Big Thought does not need to prove the entire Master Thought by itself. It must contribute one distinct, substantive reason, premise, or piece of evidence that materially strengthens the overall case for accepting the Master Thought.",
    "Ask: if this candidate were removed from the full set of supporting reasons, would a meaningful and distinct part of the case for the Master Thought disappear? If yes, the candidate may be DISTINCT_MATERIAL_SUPPORT.",
    "Evaluative Elaboration Guard: before DISTINCT_MATERIAL_SUPPORT, name the distinct material reasoning job this candidate adds that the parent does not already perform.",
    "If the candidate were removed, would the parent lose a distinct material premise, reason, evidence, constraint, consequence, or basis? If no, do not classify DISTINCT_MATERIAL_SUPPORT.",
    "These explanations are not enough: this reinforces the parent; this shows why the parent is important; this reflects commitment; this confirms responsibility; this emphasizes seriousness.",
    "Classify ELABORATION when the candidate mainly evaluates the seriousness of the parent behavior, describes what that behavior symbolizes, reframes responsibility as commitment, praises or deepens the moral significance of the same behavior, or restates the same responsibility in more philosophical language.",
    "Use UNRESOLVED when that distinction cannot be made safely. Do not give the benefit of the doubt to DISTINCT_MATERIAL_SUPPORT.",
    "Sibling distinctness does not repair a failure against the parent. A candidate can differ from its siblings and still fail vertically.",
    "A named reasoning job must not be only a paraphrase that the candidate shows why the parent is important, reinforces the responsibility, reflects commitment, or strengthens the ethical basis. If that job cannot be stated without rephrasing the parent, do not classify DISTINCT_MATERIAL_SUPPORT.",
    "Do not reject a candidate merely because it does not independently establish every comparative, superlative, universal, or strengthened aspect of the Master Thought.",
    "The full burden of supporting the Master Thought may be distributed across multiple distinct Big Thoughts. Individual Big Thoughts are components of the argument, not complete standalone proofs.",
    "This individual judge decides whether the candidate is a valid distinct material contribution. Sibling audit decides whether that contribution repeats another Big Thought. Challenger decides whether the supporting set is still missing a material contribution. Do not move the completeness burden onto this judgment.",
    "Claim strength still matters inside the candidate's own reasoning job. If that job is consistency or reliability and the candidate offers only one occasion, the evidence is too weak to be material.",
    "A parent of the form 'X always keeps a promise' and a candidate of the form 'X once kept an important promise' is weak evidence for that consistency job. Do not classify it as DISTINCT_MATERIAL_SUPPORT.",
    "A parent of the form 'X always keeps a promise' and a candidate showing a consistent pattern across situations and over a long time can be DISTINCT_MATERIAL_SUPPORT with supportRole EVIDENCE.",
    "For a superlative or strongly evaluative Master Thought, a candidate may still be valid when it contributes a distinct and substantial reason for the evaluation, even if it does not independently prove the superlative. The superlative burden belongs to the supporting set collectively, not necessarily to each Big Thought individually.",
    "A parent of the form 'X is the best person' and a candidate of the form 'X consistently shows deep empathy toward people in need' can be DISTINCT_MATERIAL_SUPPORT with supportRole EVIDENCE.",
    "A parent of the form 'X is the best person' and a candidate of the form 'X always gives unconditional support to people in need' can be DISTINCT_MATERIAL_SUPPORT with supportRole EVIDENCE.",
    "A parent of the form 'X is the best person' and a candidate of the form 'X is fundamentally a very good person' is RESTATEMENT or ELABORATION. It adds no new reasoning contribution.",
    "Materiality Test: a support is material when removing it would remove a distinct part of the case for accepting the Master Thought. A candidate is not immaterial merely because other Big Thoughts are still needed to complete the case.",
    "Single-belief Test: one Big Thought needs one dominant reasoning job. If the candidate joins several independent claims and the dominant job cannot be identified safely, mark relationToParent and supportRole UNRESOLVED. Do not treat a compound statement as DISTINCT_MATERIAL_SUPPORT by default.",
    "Mixed-Conclusion Guard: A candidate must not be classified as DISTINCT_MATERIAL_SUPPORT merely because one clause contains a valid new premise when another clause restates, reproduces, or operationalizes the Master Thought's conclusion.",
    "Inspect each material clause separately.",
    "If one clause supplies new support but another materially reasserts the parent conclusion, the candidate is a compound statement and should not pass as a clean Big Thought.",
    "Prefer ELABORATION when the candidate combines a new premise with a restatement or operationalization of the parent conclusion.",
    "Use UNRESOLVED if the dominant argumentative job cannot be determined safely.",
    "A valid premise must stand on its own as the Big Thought. Do not allow a parent-conclusion clause to be attached to it merely to make the candidate sound complete.",
    "Clause Independence Test: split the candidate into its material argumentative clauses.",
    "Ask whether each clause could independently function as a material support, a restatement/elaboration of the parent, or another exclusion.",
    "If the candidate combines materially different jobs, do not classify the whole statement as DISTINCT_MATERIAL_SUPPORT.",
    "Do not reject every multi-clause sentence. Multiple concepts may appear when they support one dominant job.",
    "A parent 'Kesungguhan memilih wadah pengelolaan merupakan bagian dari tanggung jawab pemberi.' and a candidate 'Pemberian mencerminkan komitmen spiritual, sehingga pemilihan wadah harus dilakukan dengan sungguh-sungguh.' is not DISTINCT_MATERIAL_SUPPORT. Prefer ELABORATION, because the first clause is a valid premise and the second clause is the parent conclusion or an operationalized restatement.",
    "The clean version 'Pemberian merupakan manifestasi dari komitmen spiritual pemberi.' may be judged independently as a PREMISE.",
    "A candidate 'Pengelola yang berbeda dapat menggunakan dana yang sama dengan integritas dan dampak yang berbeda.' may still be DISTINCT_MATERIAL_SUPPORT, because its clauses support one dominant job: different stewards materially change outcomes.",
    "Unsupported Premise Guard: before admitting DISTINCT_MATERIAL_SUPPORT, remember that a Big Thought may introduce new material reasoning that the Master Thought does not already state. NEW INFORMATION is not UNSUPPORTED_PREMISE.",
    "Do not reject a candidate merely because the parent does not explicitly contain or prove it. The rule 'the parent does not state this fact, therefore it is unsupported' is invalid.",
    "First ask whether the candidate introduces a genuinely new material reason, premise, or evidence. If no, use the existing appropriate exclusion. If yes, continue.",
    "Then ask whether it is an ordinary defensible premise or evidence statement, or whether its reasoning depends on an unjustifiably specific empirical assertion.",
    "'If this were true, it would strongly support the parent' is not sufficient for DISTINCT_MATERIAL_SUPPORT.",
    "Apply extra scrutiny to universal or absolute certainty, precise quantities or proportions, exact time horizons, deterministic predictions, strong causal guarantees, highly specific empirical allegations, and invented factual certainty about actors or outcomes. These features are warning signs, not automatic rejection rules.",
    "Strong moral, spiritual, causal, or evaluative claims that carry an independent burden of justification must not automatically receive introducesUnsupportedPremise false. If the candidate's support depends on such a claim and that burden is not defensible, classify UNSUPPORTED_PREMISE and set introducesUnsupportedPremise true. If that cannot be decided safely, use UNRESOLVED. Do not set introducesUnsupportedPremise false merely because the claim sounds philosophically plausible.",
    "Ask whether this proposition could reasonably function as a defensible material premise without needing unstated external evidence to justify its specific certainty. If yes, DISTINCT_MATERIAL_SUPPORT may still be correct. If no, classify UNSUPPORTED_PREMISE. If the distinction cannot safely be determined, use UNRESOLVED.",
    "This must not pass: 'Every carrier who is not checked by an outside agency will divert most of the resources within one year.' Its problem is not merely that it is new. The combination of every carrier, absence of outside checking, will divert, most resources, and within one year is a highly specific universal empirical prediction that requires evidence which is not available.",
    "'Different stewards can use the same resources with materially different integrity and outcomes.' may introduce reasoning the parent does not literally contain, and it can remain DISTINCT_MATERIAL_SUPPORT with supportRole PREMISE or REASON.",
    "'After resources are handed over, the giver loses direct control over how they are used.' may likewise introduce new reasoning, and it can remain DISTINCT_MATERIAL_SUPPORT with supportRole PREMISE or REASON. Both are ordinary defensible premises, not fabricated highly specific empirical claims.",
    "A warranted observation such as 'this person consistently shows deep empathy toward people in need' can remain DISTINCT_MATERIAL_SUPPORT with supportRole EVIDENCE.",
    "Set introducesUnsupportedPremise true when relationToParent is UNSUPPORTED_PREMISE, false when relationToParent is DISTINCT_MATERIAL_SUPPORT, and unresolved when the distinction cannot safely be determined.",
    "DISTINCT_MATERIAL_SUPPORT requires supportRole PREMISE, REASON, or EVIDENCE. If the distinct material support cannot be identified safely, use UNRESOLVED. Do not give the benefit of the doubt to a pass.",
    "Set explainsWhyParentIsTrue true only when the candidate is DISTINCT_MATERIAL_SUPPORT. Evidence counts as support.",
    JUDGMENT_RULE,
    LANGUAGE_RULE,
    "Return JSON only:",
    JSON.stringify({
      code: input.candidate.code,
      whatItSays: "",
      relationToParent: "UNRESOLVED",
      supportRole: "UNRESOLVED",
      explainsWhyParentIsTrue: "unresolved",
      introducesUnsupportedPremise: "unresolved",
      duplicateOfCode: null,
      resolution: "UNRESOLVED",
      unresolvedReasons: [],
      becauseForm: "UNRESOLVED",
      confidence: 0,
    }),
    "becauseForm must be CLAUSE, STANDALONE, NOMINAL, OBSERVATION, or UNRESOLVED.",
    "relationToParent must be one of DISTINCT_MATERIAL_SUPPORT, RESTATEMENT, ELABORATION, OUTCOME, CONSEQUENCE, METHOD, CRITERION, EXAMPLE, TACTIC, EXECUTION, DUPLICATE, UNSUPPORTED_PREMISE, UNRESOLVED.",
    "supportRole must be PREMISE, REASON, EVIDENCE, or UNRESOLVED.",
    "Set duplicateOfCode to a sibling code when this candidate performs the same material support. Otherwise null.",
    "",
    "Master Thought:",
    input.parentStatement.trim(),
    "",
    "Sibling Big Thoughts:",
    siblingLines,
    "",
    "Candidate:",
    `${input.candidate.code}: ${input.candidate.statement.trim()}`,
  ].join("\n");
}

const BECAUSE_FORMS = ["CLAUSE", "STANDALONE", "NOMINAL", "OBSERVATION", "UNRESOLVED"] as const;
type BecauseForm = (typeof BECAUSE_FORMS)[number];

function readBecauseForm(value: unknown): BecauseForm | "ABSENT" {
  if (value == null || value === "") return "ABSENT";
  if (typeof value !== "string") return "UNRESOLVED";
  const match = BECAUSE_FORMS.find((item) => item === value.trim());
  return match ?? "UNRESOLVED";
}

export function applyBecauseForm(facts: BigThoughtFacts, rawBecauseForm: unknown): BigThoughtFacts {
  const form = readBecauseForm(rawBecauseForm);
  if (form === "ABSENT" || form === "CLAUSE") return facts;
  if (facts.relationToParent !== "DISTINCT_MATERIAL_SUPPORT") return facts;
  if (form === "UNRESOLVED") {
    return {
      ...facts,
      resolution: "UNRESOLVED",
      explainsWhyParentIsTrue: "unresolved",
      unresolvedReasons: [...new Set([...facts.unresolvedReasons, "BECAUSE_FORM_UNRESOLVED"])],
    };
  }
  return {
    ...facts,
    relationToParent: "ELABORATION",
    explainsWhyParentIsTrue: false,
    resolution: "RESOLVED",
    unresolvedReasons: [],
  };
}

export function parseBigThoughtJudge(script: string | null, code: string): BigThoughtFacts {
  if (!script?.trim()) return unresolvedBigThought(code, "JUDGE_UNAVAILABLE");
  const parsed = parseModelJson(script);
  if (!parsed || typeof parsed !== "object") return unresolvedBigThought(code, "JUDGE_UNPARSEABLE");
  const row = parsed as Record<string, unknown>;
  const facts = normalizeBigThoughtFacts(row, code);
  return applyBecauseForm({ ...facts, code }, row.becauseForm);
}

const ADVERSARIAL_REJECTS: Record<string, ParentRelation> = {
  REJECT_AS_RESTATEMENT: "RESTATEMENT",
  REJECT_AS_ELABORATION: "ELABORATION",
  REJECT_AS_OUTCOME: "OUTCOME",
  REJECT_AS_CONSEQUENCE: "CONSEQUENCE",
  REJECT_AS_METHOD: "METHOD",
  REJECT_AS_CRITERION: "CRITERION",
  REJECT_AS_EXAMPLE: "EXAMPLE",
  REJECT_AS_TACTIC: "TACTIC",
  REJECT_AS_EXECUTION: "EXECUTION",
  REJECT_AS_UNSUPPORTED_PREMISE: "UNSUPPORTED_PREMISE",
};

const ADVERSARIAL_VERDICTS = new Set([
  "CONFIRM_MATERIAL_SUPPORT",
  ...Object.keys(ADVERSARIAL_REJECTS),
  "UNRESOLVED",
]);

function buildAdversarialVerifierPrompt(input: {
  parentStatement: string;
  candidate: { code: string; statement: string };
  firstPass: BigThoughtFacts;
}): string {
  return [
    "You are the adversarial verifier for one Big Thought classification.",
    "A first-pass judge classified this candidate as DISTINCT_MATERIAL_SUPPORT. Assume that positive classification may be wrong.",
    "Try to falsify the claim that this candidate provides a genuinely distinct material support for the parent, as a premise, reason, or evidence.",
    "Judge argumentative function, not surface form. Do not reject valid evidence merely because it has the surface form of a behavior, effect, outcome, or recurring observation.",
    "Before CONFIRM_MATERIAL_SUPPORT, try to show that the candidate is actually one of these exclusions:",
    "REJECT_AS_RESTATEMENT: the candidate reaches the same semantic conclusion as the parent.",
    "REJECT_AS_ELABORATION: the candidate specifies, narrows, operationalizes, or repackages part of the parent.",
    "REJECT_AS_OUTCOME: the candidate mainly states a result, effect, impact, or state that follows the parent and does not materially increase rational support for believing the parent.",
    "If the candidate is something that happens because the parent is true, and that fact does not itself make the parent more defensible, it is likely an OUTCOME.",
    "A parent of the form 'X is exceptionally good' and a candidate of the form 'people feel better after interacting with X' is a potential outcome. Confirm it as evidence only when that effect materially strengthens the case for the parent.",
    "REJECT_AS_CONSEQUENCE: the candidate states a logical or practical consequence of the parent, not a reason that supports the parent.",
    "Direction Test: a valid material support points toward accepting the Master Thought. Ask which direction is more natural: candidate → Master Thought, or Master Thought → candidate.",
    "candidate → Master Thought can be a premise, reason, or supporting evidence.",
    "Master Thought → candidate suggests OUTCOME, CONSEQUENCE, METHOD, EXAMPLE, or another exclusion, unless the downstream fact still materially increases rational support for believing the parent.",
    "REJECT_AS_METHOD: the candidate explains how the parent is done, achieved, or carried out, not why the parent is true.",
    "REJECT_AS_CRITERION: the candidate only supplies a measure, evaluation condition, indicator, or standard for judging the parent. 'A good person must have empathy' is a criterion. 'This person consistently shows empathy under pressure' can be evidence.",
    "REJECT_AS_EXAMPLE: the candidate is only a weak or non-material illustration. A recurring pattern that materially strengthens the case can remain evidence.",
    "REJECT_AS_TACTIC: the candidate is a practical action for carrying out the parent.",
    "REJECT_AS_EXECUTION: the candidate is a concrete realization, medium, or implementation of the parent.",
    "REJECT_AS_UNSUPPORTED_PREMISE: the candidate's argumentative value depends on a materially specific factual assertion whose certainty or specificity is not defensible from the available reasoning and would normally require independent evidence. New information is not enough to reject it.",
    "A parent of the form 'X is exceptionally good' and a candidate of the form 'X is fundamentally good and compassionate' is REJECT_AS_RESTATEMENT.",
    "A parent of the form 'X is exceptionally good' and a candidate of the form 'X remains empathetic toward others even under pressure' can be CONFIRM_MATERIAL_SUPPORT as EVIDENCE.",
    "A parent of the form 'X is exceptionally good' and a candidate of the form 'X's presence consistently increases other people's sense of safety and wellbeing' can be CONFIRM_MATERIAL_SUPPORT as EVIDENCE when that impact materially supports the evaluation.",
    "A parent of the form 'X should carefully choose a steward' and a candidate of the form 'different stewards can produce materially different outcomes' can be CONFIRM_MATERIAL_SUPPORT as PREMISE or REASON.",
    "Semantic Equivalence Across Abstraction: compare meaning, not vocabulary. Treat two statements as the same conclusion when they preserve the same subject, obligation/responsibility, temporal or causal relation, and practical implication, even if they use different nouns, verbs, abstraction levels, or framing.",
    "'responsibility does not end after transfer' and 'responsibility continues after handoff' are the same conclusion. transfer, handoff, ownership change, delivery, or a similar abstraction is not a new support when the conclusion structure stays the same.",
    "Negation / Inversion Equivalence: 'does not end' and 'continues' are semantically equivalent when they describe the same responsibility over the same transition. Do not treat negative phrasing, positive phrasing, inversion, or temporal reframing as a new support.",
    "'responsibility does not stop', 'responsibility continues', and 'responsibility remains' are the same conclusion in different wording. Use REJECT_AS_RESTATEMENT.",
    "Structural-Proposition Test: reduce the parent and the candidate to SUBJECT + RELATION/OBLIGATION + EVENT/CONDITION + RESULT. Substantially the same proposition is REJECT_AS_RESTATEMENT.",
    "Clause-Repackaging Guard: if a candidate takes one clause or implication already contained in the Master Thought and reformulates it as a standalone principle, use REJECT_AS_RESTATEMENT or REJECT_AS_ELABORATION.",
    "When both parent and candidate assert the same normative proposition about the same actor, default toward REJECT_AS_RESTATEMENT unless the candidate introduces a clearly distinct material support.",
    "Mixed-Conclusion Guard: before CONFIRM_MATERIAL_SUPPORT, ask: Does this candidate contain a valid support clause plus another clause that restates or reproduces the parent conclusion?",
    "If yes, use REJECT_AS_ELABORATION unless the statement can clearly be shown to have one single dominant support job without reasserting the parent.",
    "Clause Independence Test: split the candidate into its material argumentative clauses. Ask whether each clause could independently function as a material support, a restatement/elaboration of the parent, or another exclusion. If the candidate combines materially different jobs, do not confirm.",
    "A valid premise must stand on its own. Do not allow a parent-conclusion clause to be attached merely to make the candidate sound complete.",
    "A parent 'Kesungguhan memilih wadah pengelolaan merupakan bagian dari tanggung jawab pemberi.' and a candidate 'Pemberian mencerminkan komitmen spiritual, sehingga pemilihan wadah harus dilakukan dengan sungguh-sungguh.' is REJECT_AS_ELABORATION. The first clause is a valid premise and the second clause restates or operationalizes the parent conclusion.",
    "The clean version 'Pemberian merupakan manifestasi dari komitmen spiritual pemberi.' may be CONFIRM_MATERIAL_SUPPORT as PREMISE when it stands alone and is materially relevant.",
    "Do not reject every multi-clause sentence. A candidate 'Pengelola yang berbeda dapat menggunakan dana yang sama dengan integritas dan dampak yang berbeda.' may still be CONFIRM_MATERIAL_SUPPORT, because its clauses support one dominant job: different stewards materially change outcomes.",
    "Material Contribution Test: before CONFIRM_MATERIAL_SUPPORT, ask whether this candidate provides a distinct and substantive material contribution to the overall case for the Master Thought.",
    "Evaluative Elaboration Guard: name the distinct material reasoning job this candidate adds that the parent does not already perform.",
    "If the candidate were removed, would the parent lose a distinct material premise, reason, evidence, constraint, consequence, or basis? If no, do not use CONFIRM_MATERIAL_SUPPORT.",
    "These explanations are not enough: this reinforces the parent; this shows why the parent is important; this reflects commitment; this confirms responsibility; this emphasizes seriousness.",
    "Use REJECT_AS_ELABORATION when the candidate mainly evaluates the seriousness of the parent behavior, describes what that behavior symbolizes, reframes responsibility as commitment, praises or deepens the moral significance of the same behavior, or restates the same responsibility in more philosophical language.",
    "Use UNRESOLVED when that distinction cannot be made safely. Do not give the benefit of the doubt to CONFIRM_MATERIAL_SUPPORT.",
    "Sibling distinctness does not repair a failure against the parent.",
    "A Material support reason must name a distinct reasoning job. Do not confirm when that job only says the candidate shows why the parent is important, reinforces the responsibility, reflects commitment, or strengthens the ethical basis, or when the job cannot be stated without rephrasing the parent.",
    "Do not require the candidate to independently prove the entire Master Thought.",
    "Do not reject valid evidence merely because other Big Thoughts are needed to complete the case.",
    "Reject only when the candidate itself is too weak, trivial, redundant, circular, or belongs to an exclusion category.",
    "The superlative burden belongs to the supporting set collectively. A parent of the form 'X is the best person' and a candidate of the form 'X consistently shows deep empathy toward people in need' can be CONFIRM_MATERIAL_SUPPORT as EVIDENCE.",
    "A parent of the form 'X is the best person' and a candidate of the form 'X always gives unconditional support to people in need' can be CONFIRM_MATERIAL_SUPPORT as EVIDENCE.",
    "A parent of the form 'X is the best person' and a candidate of the form 'X is fundamentally a very good person' is REJECT_AS_RESTATEMENT or REJECT_AS_ELABORATION.",
    "A parent of the form 'X always keeps a promise' and a candidate of the form 'X once kept an important promise' is too weak for its own consistency job. Do not confirm.",
    "A consistent pattern across situations and over a long time can be CONFIRM_MATERIAL_SUPPORT as EVIDENCE for a parent of the form 'X always keeps a promise.'",
    "Sibling audit decides whether two contributions repeat the same reasoning job. Challenger decides whether the set is still missing a material contribution.",
    "Unsupported Premise Guard: before CONFIRM_MATERIAL_SUPPORT, a Big Thought may introduce new material reasoning that the Master Thought does not already state. NEW INFORMATION is not UNSUPPORTED_PREMISE.",
    "Do not reject a candidate merely because the parent does not explicitly contain or prove it. The rule 'the parent does not state this fact, therefore it is unsupported' is invalid.",
    "First ask whether the candidate introduces a genuinely new material reason, premise, or evidence. If no, use the existing appropriate exclusion. If yes, continue.",
    "Then ask whether it is an ordinary defensible premise or evidence statement, or whether its reasoning depends on an unjustifiably specific empirical assertion.",
    "'If this were true, it would strongly support the parent' is not sufficient for CONFIRM_MATERIAL_SUPPORT.",
    "Apply extra scrutiny to universal or absolute certainty, precise quantities or proportions, exact time horizons, deterministic predictions, strong causal guarantees, highly specific empirical allegations, and invented factual certainty about actors or outcomes. These features are warning signs, not automatic rejection rules.",
    "Strong moral, spiritual, causal, or evaluative claims that carry an independent burden of justification must not be confirmed merely because they sound plausible. If the candidate's support depends on such a claim and that burden is not defensible, use REJECT_AS_UNSUPPORTED_PREMISE. If that cannot be decided safely, use UNRESOLVED.",
    "Ask whether this proposition could reasonably function as a defensible material premise without needing unstated external evidence to justify its specific certainty. If yes, CONFIRM_MATERIAL_SUPPORT may still be correct. If no, use REJECT_AS_UNSUPPORTED_PREMISE. If the distinction cannot safely be determined, use UNRESOLVED.",
    "This must not pass: 'Every carrier who is not checked by an outside agency will divert most of the resources within one year.' Its problem is not merely that it is new. The combination of every carrier, absence of outside checking, will divert, most resources, and within one year is a highly specific universal empirical prediction that requires evidence which is not available. Use REJECT_AS_UNSUPPORTED_PREMISE.",
    "'Different stewards can use the same resources with materially different integrity and outcomes.' may introduce reasoning the parent does not literally contain, and it can remain CONFIRM_MATERIAL_SUPPORT as PREMISE or REASON.",
    "'After resources are handed over, the giver loses direct control over how they are used.' may likewise introduce new reasoning, and it can remain CONFIRM_MATERIAL_SUPPORT as PREMISE or REASON. Both are ordinary defensible premises, not fabricated highly specific empirical claims.",
    "A warranted observation such as 'this person consistently shows deep empathy toward people in need' can remain CONFIRM_MATERIAL_SUPPORT as EVIDENCE.",
    "CONFIRM_MATERIAL_SUPPORT only when you can state 'Material support:' and name a distinct material contribution to the overall case. That support must be logically different, not a reformulation, and must function as a premise, reason, or evidence. It must not be a non-supportive effect, a method, a criterion, a mere example, or an unsupported factual premise.",
    "Use UNRESOLVED when the material support cannot be identified safely. Do not give the benefit of the doubt to a pass.",
    "Return JSON only:",
    JSON.stringify({ verdict: "UNRESOLVED", reason: "" }),
    "verdict must be CONFIRM_MATERIAL_SUPPORT, REJECT_AS_RESTATEMENT, REJECT_AS_ELABORATION, REJECT_AS_OUTCOME, REJECT_AS_CONSEQUENCE, REJECT_AS_METHOD, REJECT_AS_CRITERION, REJECT_AS_EXAMPLE, REJECT_AS_TACTIC, REJECT_AS_EXECUTION, REJECT_AS_UNSUPPORTED_PREMISE, or UNRESOLVED.",
    "When verdict is CONFIRM_MATERIAL_SUPPORT, reason must begin with 'Material support:' and explain the distinct material contribution to the overall case, not how the candidate proves the entire parent by itself. A valid reason can be 'Material support: this evidence contributes a distinct reason based on consistent empathy, strengthening the overall case for the evaluation without duplicating another support.' Otherwise explain the falsifying evidence.",
    "",
    "Master Thought:",
    input.parentStatement.trim(),
    "",
    "Candidate:",
    `${input.candidate.code}: ${input.candidate.statement.trim()}`,
    "",
    "First-pass claim:",
    `relationToParent: ${input.firstPass.relationToParent}`,
    `supportRole: ${input.firstPass.supportRole}`,
    `whatItSays: ${input.firstPass.whatItSays}`,
  ].join("\n");
}

function adversarialUnresolved(facts: BigThoughtFacts): BigThoughtFacts {
  return {
    ...facts,
    relationToParent: "UNRESOLVED",
    supportRole: "UNRESOLVED",
    explainsWhyParentIsTrue: "unresolved",
    introducesUnsupportedPremise: "unresolved",
    resolution: "UNRESOLVED",
    unresolvedReasons: ["ADVERSARIAL_UNRESOLVED"],
  };
}

function applyAdversarialVerification(facts: BigThoughtFacts, script: string | null): BigThoughtFacts {
  const parsed = parseModelJson(script);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return adversarialUnresolved(facts);
  const row = parsed as { verdict?: unknown; reason?: unknown };
  const verdict = typeof row.verdict === "string" ? row.verdict : "";
  const reason = asText(row.reason);
  if (!ADVERSARIAL_VERDICTS.has(verdict)) return adversarialUnresolved(facts);
  if (verdict === "CONFIRM_MATERIAL_SUPPORT") {
    return reason.startsWith("Material support:")
      ? { ...facts, introducesUnsupportedPremise: false, judgmentVerdict: verdict, judgmentReason: reason }
      : adversarialUnresolved(facts);
  }
  const rejected = ADVERSARIAL_REJECTS[verdict];
  if (rejected) {
    return {
      ...facts,
      relationToParent: rejected,
      supportRole: "UNRESOLVED",
      explainsWhyParentIsTrue: false,
      introducesUnsupportedPremise: rejected === "UNSUPPORTED_PREMISE" ? true : facts.introducesUnsupportedPremise,
      resolution: "RESOLVED",
      unresolvedReasons: [],
      judgmentVerdict: verdict,
      judgmentReason: reason,
    };
  }
  return adversarialUnresolved(facts);
}

export async function judgeBigThought(
  input: {
    parentStatement: string;
    candidate: { code: string; statement: string };
    siblings: Array<{ code: string; statement: string }>;
  },
  ask: (prompt: string) => Promise<string | null>,
): Promise<BigThoughtFacts> {
  const script = await ask(buildBigThoughtJudgePrompt(input));
  const first = parseBigThoughtJudge(script, input.candidate.code);
  if (first.relationToParent !== "DISTINCT_MATERIAL_SUPPORT") return first;
  const verification = await ask(
    buildAdversarialVerifierPrompt({
      parentStatement: input.parentStatement,
      candidate: input.candidate,
      firstPass: first,
    }),
  );
  return applyAdversarialVerification(first, verification);
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
    "Do not reclassify a row's relation to the Master Thought. That judgment belongs to the individual judge.",
    "Compare those contributions across the whole set.",
    "The question is not whether the sentences look different.",
    "The question is whether, if one Big Thought were removed, another sibling would already perform substantially the same reasoning job for the Master Thought.",
    JUDGMENT_RULE,
    LANGUAGE_RULE,
    "Return JSON only:",
    JSON.stringify({
      distinct: false,
      duplicatePairs: [
        {
          a: "BT01",
          b: "BT03",
          explanation: "Why these two perform the same reasoning job.",
        },
      ],
      reasonContributions: [{ code: "BT01", reasonContribution: "The reasoning job this Big Thought performs for the parent." }],
      resolution: "RESOLVED",
      unresolvedReasons: [],
      confidence: 0,
    }),
    "duplicatePairs lists codes that perform substantially the same material-support reasoning job. Use an empty array when every reasoning job is distinct.",
    "Every duplicatePairs entry needs an explanation of why that pair performs the same reasoning job.",
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

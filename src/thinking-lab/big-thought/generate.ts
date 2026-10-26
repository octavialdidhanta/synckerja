import { scoreAuditRow } from "@/thinking-lab/big-thought/audit";
import { asBecauseClause, BECAUSE_RESULT_LINES } from "@/thinking-lab/big-thought/because";
import {
  attachLesson,
  checklistFrame,
  checklistFrames,
  checkingSiblingFrame,
  completeChecklist,
  evaluateIndividualChecklist,
  pendingPassChecklist,
  uncheckedDuplicateChecklist,
  type GateLesson,
  type PassChecklist,
} from "@/thinking-lab/big-thought/checklist";
import { bigThoughtRepeats, normalizeBigThoughtLabel } from "@/thinking-lab/big-thought/label";
import { productReasonLines, statementUsesReason, type ProductReasonPool } from "@/thinking-lab/master-thought/productReasonPool";
import { MAX_GENERATE_ROUNDS, TARGET_GENERATE_VALID } from "@/thinking-lab/shared/limits";
import { individualAdmission } from "@/thinking-lab/big-thought/policy";
import { judgeBigThought } from "@/thinking-lab/big-thought/semantic";
import type { BigThoughtFacts, GenerateMode, MissingWhy, SemanticExclusion, SiblingSetFacts } from "@/thinking-lab/big-thought/types";
import type { IndividualAdmission } from "@/thinking-lab/shared/verdict";

export type { GateLesson, PassChecklist };

export const CHECKED_GENERATE_ATTEMPTS = MAX_GENERATE_ROUNDS * TARGET_GENERATE_VALID;
const CHECKED_CANDIDATE_CODE = "NEW";

export type GeneratedBigThought = {
  label: string;
  statement: string;
  reasonId?: string;
};

export type PlannedGenerate = {
  needed: number;
  mode: GenerateMode | null;
  stop: null | "ENOUGH" | "CAP" | "ROUNDS";
  missingWhy: MissingWhy | null;
};

export function planGenerate(input: {
  activeCount: number;
  generateValidCount: number;
  round: number;
  missingWhy: MissingWhy | null;
  topUp?: boolean;
}): PlannedGenerate {
  if (input.round > MAX_GENERATE_ROUNDS) {
    return { needed: 0, mode: null, stop: "ROUNDS", missingWhy: input.missingWhy };
  }
  if (input.missingWhy) {
    return { needed: 1, mode: "gap", stop: null, missingWhy: input.missingWhy };
  }
  const missing = TARGET_GENERATE_VALID - input.generateValidCount;
  if (missing <= 0) {
    if (!input.topUp) {
      return { needed: 0, mode: null, stop: "ENOUGH", missingWhy: null };
    }
    return { needed: TARGET_GENERATE_VALID, mode: "fill", stop: null, missingWhy: null };
  }
  return { needed: missing, mode: "fill", stop: null, missingWhy: null };
}

export function countGenerateValid(rows: Array<{ admission: IndividualAdmission }>): number {
  return rows.filter((row) => row.admission === "GENERATE_VALID").length;
}

/** Admitted at Generate. Audit checks the pass gates later. */
export function shownBigThoughtFacts(code: string, statement: string): BigThoughtFacts {
  return {
    code,
    whatItSays: statement.trim(),
    relationToParent: "DISTINCT_MATERIAL_SUPPORT",
    supportRole: "REASON",
    explainsWhyParentIsTrue: true,
    introducesUnsupportedPremise: false,
    duplicateOfCode: null,
    resolution: "RESOLVED",
    unresolvedReasons: [],
  };
}

export function nextBigThoughtCode(existingCodes: string[]): string {
  let max = 0;
  for (const code of existingCodes) {
    const match = /^BT(\d+)$/i.exec(code.trim());
    if (!match) continue;
    max = Math.max(max, Number(match[1]));
  }
  return `BT${String(max + 1).padStart(2, "0")}`;
}

function incumbentLines(
  rows: Array<{ code: string; statement: string; label?: string; reasonContribution?: string | null }>,
): string {
  if (rows.length === 0) return "(none)";
  return rows
    .map((row) => {
      const label = row.label?.trim();
      const heading = label ? `${row.code} ${label}: ${row.statement}` : `${row.code}: ${row.statement}`;
      const contribution = row.reasonContribution?.trim() ?? "";
      return contribution ? `${heading}\nReason contribution: ${contribution}` : heading;
    })
    .join("\n");
}

function exclusionLines(entries: SemanticExclusion[]): string {
  if (entries.length === 0) return "(none)";
  return entries
    .map((entry) => {
      const lines = [
        entry.codes.length > 0 ? `Codes: ${entry.codes.join(", ")}` : "",
        entry.reasonContribution.trim() ? `Reason contribution: ${entry.reasonContribution.trim()}` : "",
        entry.explanation.trim() ? `Overlap explanation: ${entry.explanation.trim()}` : "",
      ].filter(Boolean);
      return lines.join("\n");
    })
    .filter(Boolean)
    .join("\n\n");
}

export function buildGeneratePrompt(input: {
  parentStatement: string;
  incumbents: Array<{ code: string; statement: string; label?: string; reasonContribution?: string | null }>;
  needed: number;
  missingWhy: MissingWhy | null;
  exclusions?: SemanticExclusion[];
  failed?: { code: string; statement: string; reasonContribution?: string | null } | null;
  lessons?: GateLesson[];
  reasonPool?: ProductReasonPool | null;
}): string {
  const kept = incumbentLines(input.incumbents);
  const pool = input.reasonPool ?? null;
  const gap = input.missingWhy
    ? [
        "Search only for this missing because-clause.",
        `Description: ${input.missingWhy.description}`,
        `Boundary: ${input.missingWhy.boundary}`,
        "Do not search for a different support.",
        "The candidate must not restate the Master Thought or an incumbent Big Thought.",
      ].join("\n")
    : "Search for a because-clause that is not already in the incumbent list.";
  const exclusionSearch =
    input.exclusions === undefined
      ? []
      : [
          "You are looking for another because-clause.",
          "These reasoning jobs are already occupied.",
          "These reasoning spaces have already been found to collide.",
          "Do not merely reword, reframe, generalize, specialize, or change the emphasis of those same reasoning jobs.",
          "Search for a genuinely different because-clause that finishes the Master Thought.",
          "Different wording is not sufficient.",
          "Different subject vocabulary is not sufficient.",
          "The candidate must perform a genuinely different explanatory job.",
          "",
          "Occupied incumbent reasoning jobs:",
          kept,
          "",
          "Failed row being replaced:",
          input.failed ? incumbentLines([input.failed]) : "(none)",
          "",
          "Known semantic exclusions:",
          exclusionLines(input.exclusions),
        ];
  const productSearch = pool
    ? [
        "Use exactly one allowed product reason for each candidate.",
        "Keep that reason's concrete words. Do not replace them with a broader subject.",
        "Do not combine two reasons. Do not write a reason that is not on this list.",
        "A reason about the surrounding place, the whole market, or every tenant is allowed only when those words are on this list.",
        "Return the reasonId of the one list item the clause uses.",
        "",
        "Allowed product reasons:",
        productReasonLines(pool),
      ]
    : ["Do not use examples from any specific industry, belief system, or brand."];
  const lessons = input.lessons ?? [];
  const lessonSearch =
    lessons.length === 0
      ? []
      : [
          "Previous attempts failed a pass gate. Do not repeat those failures.",
          ...lessons.map(
            (lesson) => `Failed gate: ${lesson.gate}. Cause: ${lesson.reason} Failed clause: ${lesson.statement}`,
          ),
          "Write a different because-clause that gets past every failed gate.",
        ];
  return [
    "Write Big Thought candidates for the confirmed Master Thought.",
    "Each candidate is only the clause that follows because. Inserting the word because between the Master Thought and the candidate must already make one sentence.",
    "The clause finishes the belief that is already there, including its comparison. It does not open a new claim.",
    ...BECAUSE_RESULT_LINES,
    "Do not repeat the Master Thought. Do not start the clause with because.",
    "One candidate is one foundational reason. It should feel awkward as a noun phrase and awkward as an observation that begins from what is rarely noticed.",
    "Prefer materially different reasons rather than multiple clauses that say the same thing.",
    "Do not restate or elaborate the Master Thought. Do not offer a method, tactic, execution, or a weak example.",
    "Do not offer a bare outcome, a bare consequence, or a standalone sentence about a new mechanism. A result joined with sehingga or so that is part of the same reason when the lines above ask for it.",
    "Search for the missing because-clause, not a sentence that already repeats the Master Thought.",
    "Do not invent a weak statement to fill a quota. Return fewer statements when a strong support is not available.",
    "Keep every incumbent. Do not rewrite them.",
    "Read the incumbent labels. A candidate whose label uses the same words as an incumbent label, in any order, is that same Big Thought. Do not return it.",
    "Write the statements in the same language as the Master Thought.",
    "Each item also has a label: a semantic name of that statement's meaning, in a few words, not a shorter copy of the sentence.",
    "A name of two or three words is right when it still names the same reason. Use more words only when a shorter name would name a different reason.",
    "Do not write a clause, and do not copy a stretch of the statement.",
    "Start the label with a capital letter. Do not end it on a loose word such as Tak, Yang, Dan, or Untuk.",
    "The label is not a new Big Thought. Do not shorten or rewrite the statement so that it matches the label.",
    "Write the label in the same language as the statement.",
    ...productSearch,
    gap,
    ...exclusionSearch,
    ...lessonSearch,
    `Return at most ${input.needed} item(s).`,
    pool
      ? "Return JSON only: {\"items\":[{\"label\":\"semantic name\",\"statement\":\"...\",\"reasonId\":\"r1\"}]}"
      : "Return JSON only: {\"items\":[{\"label\":\"semantic name\",\"statement\":\"...\"}]}",
    "",
    "Master Thought:",
    input.parentStatement.trim(),
    "",
    "Incumbent Big Thoughts:",
    kept,
  ].join("\n");
}

export function parseGeneratedBigThoughts(
  raw: unknown,
  parentStatement = "",
  reasonPool?: ProductReasonPool | null,
): GeneratedBigThought[] {
  const allowed = reasonPool ? new Set(reasonPool.items.map((item) => item.id)) : null;
  const read = (row: unknown): GeneratedBigThought | null => {
    if (!row || typeof row !== "object") return null;
    const statement = (row as { statement?: unknown }).statement;
    const label = (row as { label?: unknown }).label;
    const reasonId = (row as { reasonId?: unknown }).reasonId;
    if (typeof statement !== "string" || !statement.trim()) return null;
    const cited = typeof reasonId === "string" ? reasonId.trim() : "";
    if (allowed && !allowed.has(cited)) return null;
    return {
      statement: asBecauseClause(statement, parentStatement),
      label: normalizeBigThoughtLabel(typeof label === "string" ? label : ""),
      ...(cited ? { reasonId: cited } : {}),
    };
  };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const record = raw as { items?: unknown; statements?: unknown };
  if (Array.isArray(record.items)) {
    return record.items.flatMap((row) => {
      const item = read(row);
      return item ? [item] : [];
    });
  }
  if (allowed) return [];
  if (!Array.isArray(record.statements)) return [];
  return record.statements
    .filter((row): row is string => typeof row === "string" && row.trim().length > 0)
    .map((statement) => ({ statement: asBecauseClause(statement, parentStatement), label: "" }));
}

export function keepGroundedBigThoughts(
  items: GeneratedBigThought[],
  reasonPool?: ProductReasonPool | null,
): GeneratedBigThought[] {
  if (!reasonPool) return items;
  return items.filter((item) => {
    const reason = reasonPool.items.find((row) => row.id === item.reasonId);
    return Boolean(reason && statementUsesReason(item.statement, reason.text));
  });
}

export function parseGeneratedStatements(raw: unknown, parentStatement = ""): string[] {
  return parseGeneratedBigThoughts(raw, parentStatement).map((row) => row.statement);
}

export type GenerateRunResult = {
  outcome: "READY" | "INSUFFICIENT_VALID_BIG_THOUGHTS";
  generateValid: number;
  target: number;
};

export async function runGenerateRounds<
  T extends { code: string; statement: string; admission: IndividualAdmission; label?: string },
>(input: {
  parentStatement: string;
  incumbents: T[];
  activeCount: number;
  missingWhy: MissingWhy | null;
  topUp?: boolean;
  propose: (plan: PlannedGenerate, incumbents: T[]) => Promise<GeneratedBigThought[]>;
  onRepeat?: (
    candidate: GeneratedBigThought,
    repeated: { code: string; statement: string },
  ) => void | Promise<void>;
  judge: (
    statement: string,
    siblings: Array<{ code: string; statement: string }>,
  ) => Promise<BigThoughtFacts>;
  persist: (candidate: GeneratedBigThought, facts: BigThoughtFacts) => Promise<T>;
}): Promise<GenerateRunResult & { incumbents: T[] }> {
  let incumbents = [...input.incumbents];
  let activeCount = input.activeCount;
  for (let round = 1; round <= MAX_GENERATE_ROUNDS; round += 1) {
    const plan = planGenerate({
      activeCount,
      generateValidCount: countGenerateValid(incumbents),
      round,
      missingWhy: input.missingWhy,
      topUp: input.topUp,
    });
    if (plan.needed === 0) break;
    const validBefore = countGenerateValid(incumbents);
    const proposed = await input.propose(plan, incumbents);
    const batch = plan.mode === "gap" ? proposed.slice(0, 1) : proposed.slice(0, plan.needed);
    let addedGap = false;
    for (const candidate of batch) {
      const repeated = incumbents.find(
        (row) => row.admission === "GENERATE_VALID" && bigThoughtRepeats(candidate, row),
      );
      if (repeated) {
        await input.onRepeat?.(candidate, { code: repeated.code, statement: repeated.statement });
        continue;
      }
      const siblings = incumbents
        .filter((row) => row.admission === "GENERATE_VALID")
        .map((row) => ({ code: row.code, statement: row.statement }));
      const facts = await input.judge(candidate.statement, siblings);
      const admission = individualAdmission({ facts, factsCurrent: true });
      const saved = await input.persist(candidate, facts);
      incumbents = [...incumbents, { ...saved, admission, label: saved.label || candidate.label }];
      activeCount += 1;
      addedGap = plan.mode === "gap" && admission === "GENERATE_VALID";
    }
    if (addedGap) break;
    const added = countGenerateValid(incumbents) - validBefore;
    if (!input.missingWhy && countGenerateValid(incumbents) >= TARGET_GENERATE_VALID && (!input.topUp || added > 0)) break;
  }
  const generateValid = countGenerateValid(incumbents);
  const filled = input.missingWhy ? generateValid > countGenerateValid(input.incumbents) : generateValid >= TARGET_GENERATE_VALID;
  return {
    outcome: filled ? "READY" : "INSUFFICIENT_VALID_BIG_THOUGHTS",
    generateValid,
    target: input.missingWhy ? countGenerateValid(input.incumbents) + 1 : TARGET_GENERATE_VALID,
    incumbents,
  };
}

export async function judgeCandidateWithAsk(input: {
  parentStatement: string;
  statement: string;
  code: string;
  siblings: Array<{ code: string; statement: string }>;
  ask: (prompt: string, temperature?: 0 | 0.2) => Promise<string | null>;
}): Promise<BigThoughtFacts> {
  return judgeBigThought(
    {
      parentStatement: input.parentStatement,
      candidate: { code: input.code, statement: input.statement },
      siblings: input.siblings,
    },
    (prompt) => input.ask(prompt, 0),
  );
}

function siblingVerdict(set: SiblingSetFacts, activeCodes: string[]): { passed: boolean; reason: string } {
  const verdict = scoreAuditRow({
    code: CHECKED_CANDIDATE_CODE,
    admission: "GENERATE_VALID",
    siblingSet: set,
    siblingSetCurrent: true,
    activeCodes,
  });
  if (verdict === "AUDIT_PASS") return { passed: true, reason: "" };
  const pair = set.duplicatePairs.find(
    (item) =>
      item.a.toUpperCase() === CHECKED_CANDIDATE_CODE || item.b.toUpperCase() === CHECKED_CANDIDATE_CODE,
  );
  return {
    passed: false,
    reason: pair?.explanation?.trim() || set.unresolvedReasons[0] || "This Big Thought repeats another reasoning job.",
  };
}

async function publishChecklist(
  publish: ((checklist: PassChecklist) => void | Promise<void>) | undefined,
  checklist: PassChecklist,
) {
  if (publish) await publish(checklist);
}

async function publishFrames(
  publish: ((checklist: PassChecklist) => void | Promise<void>) | undefined,
  checklist: PassChecklist,
) {
  for (const frame of checklistFrames(checklist)) {
    await publishChecklist(publish, frame);
  }
}

export async function runCheckedGenerate<
  T extends { code: string; statement: string; admission: IndividualAdmission; label?: string },
>(input: {
  parentStatement: string;
  incumbents: T[];
  missingWhy: MissingWhy | null;
  topUp?: boolean;
  initialLessons?: GateLesson[];
  propose: (plan: PlannedGenerate, incumbents: T[], lessons: GateLesson[]) => Promise<GeneratedBigThought[]>;
  judge: (
    statement: string,
    siblings: Array<{ code: string; statement: string }>,
  ) => Promise<BigThoughtFacts>;
  judgeSibling: (
    rows: Array<{ code: string; statement: string }>,
  ) => Promise<SiblingSetFacts>;
  persist: (candidate: GeneratedBigThought, facts: BigThoughtFacts, checklist: PassChecklist) => Promise<T>;
  onChecklist?: (checklist: PassChecklist) => void | Promise<void>;
}): Promise<GenerateRunResult & { incumbents: T[] }> {
  let incumbents = [...input.incumbents];
  const validAtStart = countGenerateValid(incumbents);
  const targetAdded = input.missingWhy ? 1 : TARGET_GENERATE_VALID;
  if (!input.missingWhy && !input.topUp && validAtStart >= TARGET_GENERATE_VALID) {
    return {
      outcome: "READY",
      generateValid: validAtStart,
      target: TARGET_GENERATE_VALID,
      incumbents,
    };
  }
  const lessons: GateLesson[] = [...(input.initialLessons ?? [])];
  let passed = 0;
  for (let attempt = 0; attempt < CHECKED_GENERATE_ATTEMPTS && passed < targetAdded; attempt += 1) {
    const plan: PlannedGenerate = {
      needed: 1,
      mode: input.missingWhy ? "gap" : "fill",
      stop: null,
      missingWhy: input.missingWhy,
    };
    await publishChecklist(input.onChecklist, pendingPassChecklist());
    const proposed = await input.propose(plan, incumbents, lessons);
    const candidate = proposed[0];
    if (!candidate) break;
    const kept = incumbents.filter((row) => row.admission === "GENERATE_VALID");
    const repeated = kept.find((row) => bigThoughtRepeats(candidate, row));
    let facts: BigThoughtFacts;
    let checklist: PassChecklist;
    if (repeated) {
      facts = {
        code: CHECKED_CANDIDATE_CODE,
        whatItSays: candidate.statement,
        relationToParent: "DUPLICATE",
        supportRole: "UNRESOLVED",
        explainsWhyParentIsTrue: false,
        introducesUnsupportedPremise: false,
        duplicateOfCode: repeated.code,
        resolution: "RESOLVED",
        unresolvedReasons: [],
      };
      checklist = attachLesson(uncheckedDuplicateChecklist(`Same Big Thought as ${repeated.code}.`), candidate.statement);
      await publishFrames(input.onChecklist, checklist);
    } else {
      const siblings = kept.map((row) => ({ code: row.code, statement: row.statement }));
      facts = await input.judge(candidate.statement, siblings);
      const individual = evaluateIndividualChecklist(facts);
      if (individual.failure) {
        checklist = attachLesson(individual, candidate.statement);
        await publishFrames(input.onChecklist, checklist);
      } else {
        await publishFrames(input.onChecklist, individual);
        await publishChecklist(input.onChecklist, checkingSiblingFrame(individual));
        const sibling =
          kept.length === 0
            ? { passed: true, reason: "" }
            : siblingVerdict(
                await input.judgeSibling([
                  ...siblings,
                  { code: CHECKED_CANDIDATE_CODE, statement: candidate.statement },
                ]),
                [...siblings.map((row) => row.code), CHECKED_CANDIDATE_CODE],
              );
        checklist = attachLesson(completeChecklist(individual, sibling), candidate.statement);
        await publishChecklist(input.onChecklist, checklistFrame(checklist, "sibling", "checked"));
      }
    }
    if (checklist.passed) facts = { ...facts, passConfirmed: true };
    else if (checklist.failure) facts = { ...facts, gateFailure: checklist.failure };
    const saved = await input.persist(candidate, facts, checklist);
    incumbents = [...incumbents, { ...saved, admission: saved.admission, label: saved.label || candidate.label }];
    if (checklist.lesson) lessons.push(checklist.lesson);
    if (checklist.passed) passed += 1;
  }
  const generateValid = countGenerateValid(incumbents);
  return {
    outcome: passed >= targetAdded ? "READY" : "INSUFFICIENT_VALID_BIG_THOUGHTS",
    generateValid,
    target: input.missingWhy ? validAtStart + 1 : validAtStart + targetAdded,
    incumbents,
  };
}

import { parseModelJson } from "@/thinking-lab/shared/ai";
import { ANCESTOR_STAKE_RULES, ancestorStakeBlock, type AncestorStake } from "@/thinking-lab/shared/ancestorStake";
import { normalizeAngleExample } from "@/thinking-lab/angle/example";
import { normalizeAngleSubject } from "@/thinking-lab/angle/subject";
import { ACTIVE_SET_CAP, MAX_GENERATE_ROUNDS, TARGET_GENERATE_VALID } from "@/thinking-lab/shared/limits";
import type { IndividualAdmission } from "@/thinking-lab/shared/verdict";
import type { AngleParentDenial } from "@/thinking-lab/angle/eligibility";
import { reviewAngleGenerativity, sealAngleFacts } from "@/thinking-lab/angle/generativity";
import { admitAngle } from "@/thinking-lab/angle/policy";
import { judgeAngle } from "@/thinking-lab/angle/semantic";
import type { AngleSemanticFacts } from "@/thinking-lab/angle/types";

export type AngleGenerateStop = null | "ENOUGH" | "CAP" | "ROUNDS";

export type PlannedAngleGenerate = {
  needed: number;
  stop: AngleGenerateStop;
};

export function planAngleGenerate(input: {
  activeCount: number;
  generateValidCount: number;
  round: number;
  topUp?: boolean;
}): PlannedAngleGenerate {
  if (input.round > MAX_GENERATE_ROUNDS) return { needed: 0, stop: "ROUNDS" };
  if (input.activeCount >= ACTIVE_SET_CAP) return { needed: 0, stop: "CAP" };
  const missing = TARGET_GENERATE_VALID - input.generateValidCount;
  const room = ACTIVE_SET_CAP - input.activeCount;
  if (missing <= 0) {
    if (!input.topUp || room <= 0) return { needed: 0, stop: input.topUp && room <= 0 ? "CAP" : "ENOUGH" };
    return { needed: 1, stop: null };
  }
  return { needed: Math.min(missing, room), stop: null };
}

export function countAdmittedAngles(rows: Array<{ admission: IndividualAdmission }>): number {
  return rows.filter((row) => row.admission === "GENERATE_VALID").length;
}

export function nextAngleCode(existingCodes: string[]): string {
  let max = 0;
  for (const code of existingCodes) {
    const match = /^AN(\d+)$/i.exec(code.trim());
    if (!match) continue;
    max = Math.max(max, Number(match[1]));
  }
  return `AN${String(max + 1).padStart(2, "0")}`;
}

export function buildAngleGeneratePrompt(input: {
  parentStatement: string;
  ancestors?: AncestorStake[];
  incumbents: Array<{ code: string; statement: string }>;
  lessons?: Array<{ code: string; statement: string; reason: string }>;
  needed: number;
}): string {
  const kept =
    input.incumbents.length === 0
      ? "(none)"
      : input.incumbents.map((row) => `${row.code}: ${row.statement}`).join("\n");
  const lessons = input.lessons ?? [];
  const lessonLines =
    lessons.length === 0
      ? "(none)"
      : lessons.map((lesson) => `${lesson.code}: ${lesson.statement}\nWhy it failed: ${lesson.reason}`).join("\n");
  return [
    "Write Angle candidates under one direct Territory.",
    "An Angle raises something rarely noticed, a contradiction, or a tension inside one Territory.",
    "Ask: what is rarely noticed about this Territory?",
    "Do not write a because-clause. If the sentence would support a belief as a reason, it is a Big Thought, not an Angle.",
    "It is not a topic, a restatement of the Territory, a concrete creative concept, or a format, scene, or production form.",
    "Each candidate must be able to generate several substantively different Ideas.",
    "Do not restate the Territory, repeat an incumbent, or collapse into one concrete concept.",
    ...ANCESTOR_STAKE_RULES,
    "Do not invent a weak observation to fill a quota. Return fewer candidates when a strong Angle is not available.",
    "Write in the same language as the Territory.",
    "Each candidate also has a subject: one to six words that name the observation on their own.",
    "The subject does not use the Territory's name and is not a chopped opening of the sentence.",
    "Each candidate also has an example: one concrete situation a person could point at that shows the observation.",
    "The statement stays the observation. Do not place that situation inside the statement.",
    "The example is not a second explanation of the pattern and not a finished Idea.",
    "Do not use examples from any specific industry, belief system, or brand.",
    "Read the earlier failures. Do not return a sentence listed there.",
    `Return at most ${input.needed} candidate(s).`,
    "Return JSON only: {\"angles\":[{\"subject\":\"...\",\"statement\":\"...\",\"example\":\"...\"}]}",
    "",
    "Direct Territory:",
    input.parentStatement.trim(),
    ...ancestorStakeBlock(input.ancestors),
    "",
    "Incumbent Angles:",
    kept,
    "",
    "Earlier failures. Do not repeat these sentences:",
    lessonLines,
  ].join("\n");
}

export function buildAngleGapPrompt(input: {
  parentStatement: string;
  ancestors?: AncestorStake[];
  incumbents: Array<{ code: string; statement: string }>;
  lessons?: Array<{ code: string; statement: string; reason: string }>;
  gap: string;
}): string {
  const kept =
    input.incumbents.length === 0
      ? "(none)"
      : input.incumbents.map((row) => `${row.code}: ${row.statement}`).join("\n");
  const lessons = input.lessons ?? [];
  const lessonLines =
    lessons.length === 0
      ? "(none)"
      : lessons.map((lesson) => `${lesson.code}: ${lesson.statement}\nWhy it failed: ${lesson.reason}`).join("\n");
  return [
    "Write one Angle that fills a named gap under one direct Territory.",
    "An Angle is an observation, contradiction, or tension inside one Territory. It must not fit smoothly as a because-clause.",
    "It must cover the missing observation and must not restate the Territory, repeat an incumbent, or sit inside an incumbent.",
    ...ANCESTOR_STAKE_RULES,
    "It must be able to generate several substantively different Ideas.",
    "Write in the same language as the Territory.",
    "Also write a subject of one to six words and one concrete situation a person could point at.",
    "The statement stays the observation. Do not place that situation inside the statement.",
    "Do not use examples from any specific industry, belief system, or brand.",
    "Read the earlier failures. Do not return a sentence listed there.",
    "Return JSON only: {\"angles\":[{\"subject\":\"...\",\"statement\":\"...\",\"example\":\"...\"}]}",
    "",
    "Direct Territory:",
    input.parentStatement.trim(),
    ...ancestorStakeBlock(input.ancestors),
    "",
    "Missing point of view:",
    input.gap.trim(),
    "",
    "Incumbent Angles:",
    kept,
    "",
    "Earlier failures. Do not repeat these sentences:",
    lessonLines,
  ].join("\n");
}

export type AngleDraft = { statement: string; subject: string; example: string };

export function parseGeneratedAngleDrafts(raw: unknown): AngleDraft[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const angles = (raw as { angles?: unknown }).angles;
  if (Array.isArray(angles)) {
    const drafts: AngleDraft[] = [];
    for (const row of angles) {
      if (!row || typeof row !== "object" || Array.isArray(row)) continue;
      const item = row as { statement?: unknown; subject?: unknown; example?: unknown };
      const statement = typeof item.statement === "string" ? item.statement.trim() : "";
      const subject = typeof item.subject === "string" ? item.subject.trim() : "";
      const example = typeof item.example === "string" ? item.example.trim() : "";
      if (!statement) continue;
      drafts.push({ statement, subject, example });
    }
    if (drafts.length > 0) return drafts;
  }
  return parseGeneratedAngleStatements(raw).map((statement) => ({ statement, subject: "", example: "" }));
}

export function parseGeneratedAngleStatements(raw: unknown): string[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const statements = (raw as { statements?: unknown }).statements;
  if (!Array.isArray(statements)) return [];
  return statements
    .filter((row): row is string => typeof row === "string" && row.trim().length > 0)
    .map((row) => row.trim());
}

export type AngleGenerateParent = {
  id: string;
  code: string;
  statement: string;
  territoryFingerprint: string;
  ancestors?: AncestorStake[];
};

export type AngleGenerateResult<T> = {
  outcome: "READY" | "INSUFFICIENT_VALID_ANGLES" | "DENIED";
  reason?: AngleParentDenial;
  generateValid: number;
  target: number;
  incumbents: T[];
  parent: AngleGenerateParent | null;
};

/** Sentence shown immediately. The pass checklist stays off this path. */
export function shownAngleFacts(code: string, statement: string, subject = "", example = ""): AngleSemanticFacts {
  return {
    code,
    whatItSays: statement.trim(),
    relationToParent: "VALID_ANGLE",
    parentFit: true,
    conceptualForm: "ANGLE_PROPOSITION",
    ideaGenerativity: "SUFFICIENT",
    boundedness: "BOUNDED",
    jobForm: "OBSERVATION",
    resolution: "RESOLVED",
    unresolvedReasons: [],
    subject: normalizeAngleSubject(subject),
    example: normalizeAngleExample(example),
  };
}

export async function judgeAndSealAngle(input: {
  parentStatement: string;
  ancestors?: AncestorStake[];
  code: string;
  statement: string;
  ask: (prompt: string) => Promise<string | null>;
}): Promise<AngleSemanticFacts> {
  const provisional = await judgeAngle(
    {
      parentStatement: input.parentStatement,
      ancestors: input.ancestors,
      candidate: { code: input.code, statement: input.statement },
    },
    input.ask,
  );
  const review = await reviewAngleGenerativity(
    { parentStatement: input.parentStatement, statement: input.statement },
    input.ask,
  );
  return sealAngleFacts(provisional, review);
}

export async function runAngleGenerate<
  T extends { code: string; statement: string; admission: IndividualAdmission; territoryId: string },
>(input: {
  loadParent: () => Promise<{ ok: true; parent: AngleGenerateParent } | { ok: false; reason: AngleParentDenial }>;
  incumbents: T[];
  topUp?: boolean;
  propose: (
    plan: PlannedAngleGenerate,
    parent: AngleGenerateParent,
    incumbents: T[],
  ) => Promise<Array<string | AngleDraft>>;
  judge: (parent: AngleGenerateParent, code: string, statement: string) => Promise<AngleSemanticFacts>;
  /** Propose one sentence, judge it, then propose the next sentence with that failure available. */
  carryLessons?: boolean;
  persist: (input: {
    parent: AngleGenerateParent;
    code: string;
    statement: string;
    facts: AngleSemanticFacts;
    admission: IndividualAdmission;
  }) => Promise<T>;
}): Promise<AngleGenerateResult<T>> {
  const gate = await input.loadParent();
  if (gate.ok === false) {
    return {
      outcome: "DENIED",
      reason: gate.reason,
      generateValid: countAdmittedAngles(input.incumbents),
      target: TARGET_GENERATE_VALID,
      incumbents: input.incumbents,
      parent: null,
    };
  }
  let incumbents = [...input.incumbents];
  let activeCount = incumbents.filter((row) => row.admission !== "GENERATE_REJECT").length;
  const attemptLimit = input.carryLessons ? MAX_GENERATE_ROUNDS * TARGET_GENERATE_VALID : MAX_GENERATE_ROUNDS;
  for (let attempt = 1; attempt <= attemptLimit; attempt += 1) {
    const plan = planAngleGenerate({
      activeCount,
      generateValidCount: countAdmittedAngles(incumbents),
      round: input.carryLessons ? 1 : attempt,
      topUp: input.topUp,
    });
    if (plan.needed === 0) break;
    const askFor = input.carryLessons ? 1 : plan.needed;
    const drafts = (await input.propose({ ...plan, needed: askFor }, gate.parent, incumbents))
      .slice(0, askFor)
      .map((row) =>
        typeof row === "string"
          ? { statement: row.trim(), subject: "", example: "" }
          : { statement: row.statement.trim(), subject: row.subject.trim(), example: row.example.trim() },
      )
      .filter((row) => row.statement);
    if (input.carryLessons && drafts.length === 0) break;
    for (const draft of drafts) {
      if (activeCount >= ACTIVE_SET_CAP) break;
      const code = nextAngleCode(incumbents.map((row) => row.code));
      const facts = await input.judge(gate.parent, code, draft.statement);
      const admission = admitAngle(facts);
      const saved = await input.persist({
        parent: gate.parent,
        code,
        statement: draft.statement,
        facts: {
          ...facts,
          subject: normalizeAngleSubject(draft.subject) || facts.subject,
          example: normalizeAngleExample(draft.example) || facts.example,
        },
        admission,
      });
      incumbents = [...incumbents, { ...saved, admission, territoryId: gate.parent.id }];
      if (admission !== "GENERATE_REJECT") activeCount += 1;
    }
    if (countAdmittedAngles(incumbents) >= TARGET_GENERATE_VALID) break;
  }
  const generateValid = countAdmittedAngles(incumbents);
  return {
    outcome: generateValid >= TARGET_GENERATE_VALID ? "READY" : "INSUFFICIENT_VALID_ANGLES",
    generateValid,
    target: TARGET_GENERATE_VALID,
    incumbents,
    parent: gate.parent,
  };
}

export async function proposeAngleStatements(input: {
  parentStatement: string;
  ancestors?: AncestorStake[];
  incumbents: Array<{ code: string; statement: string }>;
  lessons?: Array<{ code: string; statement: string; reason: string }>;
  needed: number;
  ask: (prompt: string) => Promise<string | null>;
}): Promise<AngleDraft[]> {
  const script = await input.ask(
    buildAngleGeneratePrompt({
      parentStatement: input.parentStatement,
      ancestors: input.ancestors,
      incumbents: input.incumbents,
      lessons: input.lessons,
      needed: input.needed,
    }),
  );
  if (!script?.trim()) return [];
  const parsed = parseModelJson(script);
  return parseGeneratedAngleDrafts(parsed);
}

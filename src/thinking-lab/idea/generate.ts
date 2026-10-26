import { sameIdeaConcept } from "@/thinking-lab/idea/conceptIdentity";
import { ideaWorldLines } from "@/thinking-lab/idea/discover";
import type { IdeaDecision } from "@/thinking-lab/idea/setAudit";
import {
  formatFailureMemory,
  howIfInstruction,
  IDEA_K2_RULE,
  IDEA_K7_RULE,
  type FailureMemoryItem,
  type IdeaValidationDecision,
} from "@/thinking-lab/idea/validation";
import { parseModelJson } from "@/thinking-lab/shared/ai";
import { ANCESTOR_STAKE_RULES, ancestorStakeBlock, type AncestorStake } from "@/thinking-lab/shared/ancestorStake";
import type { IndividualAdmission } from "@/thinking-lab/shared/verdict";
import type { IdeaParentDenial } from "@/thinking-lab/idea/eligibility";
import { admitIdea } from "@/thinking-lab/idea/policy";
import { judgeIdea, normalizeIdeaFacts, readMechanismKeys } from "@/thinking-lab/idea/semantic";
import { ideaNodeSummary } from "@/thinking-lab/idea/subject";
import type { IdeaMechanismKey, IdeaSemanticFacts } from "@/thinking-lab/idea/types";

export const TARGET_IDEA_VALID = 5;
export const IDEA_ACTIVE_CAP = 10;
export const IDEA_MAX_ROUNDS = 2;
export const IDEA_GENERATE_BATCH = 3;

export type IdeaGenerateStop = null | "ENOUGH" | "CAP" | "ROUNDS";

export type PlannedIdeaGenerate = {
  needed: number;
  stop: IdeaGenerateStop;
};

export function planIdeaGenerate(input: {
  activeCount: number;
  generateValidCount: number;
  round: number;
}): PlannedIdeaGenerate {
  if (input.round > IDEA_MAX_ROUNDS) return { needed: 0, stop: "ROUNDS" };
  if (input.activeCount >= IDEA_ACTIVE_CAP) return { needed: 0, stop: "CAP" };
  const missing = TARGET_IDEA_VALID - input.generateValidCount;
  if (missing <= 0) return { needed: 0, stop: "ENOUGH" };
  const room = IDEA_ACTIVE_CAP - input.activeCount;
  return { needed: Math.min(missing, room), stop: null };
}

export function countAdmittedIdeas(rows: Array<{ admission: IndividualAdmission; locked?: boolean }>): number {
  return rows.filter((row) => row.admission === "GENERATE_VALID" && row.locked !== true).length;
}

export function nextIdeaCode(existingCodes: string[]): string {
  let max = 0;
  for (const code of existingCodes) {
    const match = /^ID(\d+)$/i.exec(code.trim());
    if (!match) continue;
    max = Math.max(max, Number(match[1]));
  }
  return `ID${String(max + 1).padStart(2, "0")}`;
}

export function buildIdeaGeneratePrompt(input: {
  parentStatement: string;
  masterSubject?: string;
  ancestors?: AncestorStake[];
  incumbents: Array<{ code: string; statement: string; locked?: boolean }>;
  lessons?: Array<{ code: string; statement: string; reason: string }>;
  failures?: FailureMemoryItem[];
  decisions?: IdeaDecision[] | null;
  needed: number;
}): string {
  const open = input.incumbents.filter((row) => row.locked !== true);
  const sealed = input.incumbents.filter((row) => row.locked === true);
  const kept = open.length === 0 ? "(none)" : open.map((row) => `${row.code}: ${row.statement}`).join("\n");
  const locked = sealed.length === 0 ? "(none)" : sealed.map((row) => `${row.code}: ${row.statement}`).join("\n");
  const lessons = input.lessons ?? [];
  const lessonLines =
    lessons.length === 0
      ? "(none)"
      : lessons.map((lesson) => `${lesson.code}: ${lesson.statement}\nWhy it failed: ${lesson.reason}`).join("\n");
  const failureBlock = (input.failures ?? []).length > 0 ? formatFailureMemory(input.failures ?? []) : lessonLines;
  return [
    "Write Idea candidates under one direct Angle.",
    "An Idea is one specific how-if proposal.",
    howIfInstruction(input.parentStatement),
    "Write the statement in the same language as the Angle.",
    "K1. The statement is one specific how-if proposal. It fails when the substance is only a fact, an insight, a problem, a goal, a proposition, a general strategy, a consequence scenario, an activity, or a technique.",
    "Those may appear inside the proposal. They must not be the whole idea.",
    `K2. ${IDEA_K2_RULE}`,
    "K3. The proposed mechanism can produce the stated value.",
    "K4. A beneficiary, a relevant need, and the reason this mechanism could deliver that benefit are clear. A general claim such as increasing effectiveness is not enough.",
    "K5. The core concept, the working principle, or the produced value is meaningfully different from ideas that passed, failed, or could not be verified. Compare passed ideas as well as rejected and unverified ideas.",
    "A new title, wording, visualization, or delivery format is still the same idea when the concept, the working principle, and the value stay the same.",
    "The same topic or the same Big Thought is not a failure.",
    "K6. Quote the stored Master Thought, the stored Big Thought, and the stored Territory, and say how each one supports the proposal. They are not the same thing.",
    `K7. ${IDEA_K7_RULE}`,
    "Return a title, the concept, the core mechanism, and the value with the statement.",
    `Master Thought subject: ${input.masterSubject?.trim() || "(not sealed)"}`,
    "Do not write a finished story. A story is a pillar, not an Idea.",
    "Do not restate the Angle as an observation or widen it into a life area.",
    ...ANCESTOR_STAKE_RULES,
    "Read every locked Idea. Do not reuse its meaning. A new wording of the same mechanism is still a repeat.",
    "Read the earlier failures. Do not return a sentence listed there.",
    ...ideaWorldLines(input.decisions),
    `Return at most ${input.needed} candidate(s).`,
    "Return JSON only: {\"ideas\":[{\"title\":\"...\",\"statement\":\"...\",\"concept\":\"...\",\"mechanism\":\"...\",\"value\":\"...\"}]}",
    "",
    "Direct Angle:",
    input.parentStatement.trim(),
    ...ancestorStakeBlock(input.ancestors),
    "",
    "Incumbent Ideas:",
    kept,
    "",
    "Locked Ideas already sealed:",
    locked,
    "",
    "Earlier failures. Do not repeat these sentences:",
    failureBlock,
  ].join("\n");
}

export type IdeaDraft = {
  subject: string;
  statement: string;
  mechanismKeys: IdeaMechanismKey[];
  concept: string;
  mechanism: string;
  value: string;
};

export function parseGeneratedIdeaDrafts(raw: unknown): IdeaDraft[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const row = raw as { ideas?: unknown };
  if (Array.isArray(row.ideas)) {
    const drafts: IdeaDraft[] = [];
    for (const item of row.ideas) {
      const draft = readIdeaDraft(item);
      if (draft) drafts.push(draft);
    }
    return drafts;
  }
  const single = readIdeaDraft(raw);
  if (single) return [single];
  return parseGeneratedIdeaStatements(raw).map((statement) => ({
    subject: "",
    statement,
    mechanismKeys: [],
    concept: "",
    mechanism: "",
    value: "",
  }));
}

function readIdeaDraft(item: unknown): IdeaDraft | null {
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;
  const statement = typeof (item as { statement?: unknown }).statement === "string"
    ? (item as { statement: string }).statement.trim()
    : "";
  if (!statement) return null;
  const title = typeof (item as { title?: unknown }).title === "string" ? (item as { title: string }).title.trim() : "";
  const subject = typeof (item as { subject?: unknown }).subject === "string" ? (item as { subject: string }).subject.trim() : "";
  return {
    subject: title || subject,
    statement,
    mechanismKeys: readMechanismKeys((item as { keys?: unknown }).keys),
    concept: typeof (item as { concept?: unknown }).concept === "string" ? (item as { concept: string }).concept.trim() : "",
    mechanism: typeof (item as { mechanism?: unknown }).mechanism === "string" ? (item as { mechanism: string }).mechanism.trim() : "",
    value: typeof (item as { value?: unknown }).value === "string" ? (item as { value: string }).value.trim() : "",
  };
}

export function ideaFactsForValidation(
  code: string,
  statement: string,
  decision: IdeaValidationDecision,
  mechanismKeys: IdeaMechanismKey[] = [],
  subject = "",
): IdeaSemanticFacts {
  const base = shownIdeaFacts(code, statement, mechanismKeys, subject);
  if (decision === "LOLOS") return base;
  if (decision === "DITOLAK") {
    return { ...base, relationToParent: "UNDERDEVELOPED_CONCEPT", conceptualCompleteness: "INSUFFICIENT" };
  }
  return {
    ...base,
    relationToParent: "UNRESOLVED",
    resolution: "UNRESOLVED",
    unresolvedReasons: ["validation"],
  };
}

export function parseGeneratedIdeaStatements(raw: unknown): string[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const statements = (raw as { statements?: unknown }).statements;
  if (!Array.isArray(statements)) return [];
  return statements.filter((row): row is string => typeof row === "string" && row.trim().length > 0).map((row) => row.trim());
}

export type IdeaGenerateParent = {
  id: string;
  code: string;
  statement: string;
  angleFingerprint: string;
  ancestors?: AncestorStake[];
};

export type IdeaGenerateResult<T> = {
  outcome: "READY" | "INSUFFICIENT_VALID_IDEAS" | "DENIED";
  reason?: IdeaParentDenial;
  generateValid: number;
  target: number;
  incumbents: T[];
  parent: IdeaGenerateParent | null;
};

/** Sentence shown immediately. The pass checklist stays off this path. */
export function shownIdeaFacts(
  code: string,
  statement: string,
  mechanismKeys: IdeaMechanismKey[] = [],
  subject = "",
): IdeaSemanticFacts {
  return {
    code,
    whatItSays: statement.trim(),
    subject: subject.trim(),
    relationToParent: "VALID_IDEA",
    parentFit: true,
    conceptualForm: "IDEA_CONCEPT",
    creativeMechanism: "DEMONSTRATION",
    conceptualCompleteness: "SUFFICIENT",
    executionIndependence: "INDEPENDENT",
    boundedness: "BOUNDED",
    causeLock: "LOCKED",
    mechanismKeys,
    situationForm: "SITUATION",
    resolution: "RESOLVED",
    unresolvedReasons: [],
  };
}

export function mergeMechanismKeys(
  facts: IdeaSemanticFacts,
  keys: IdeaMechanismKey[],
  subject = "",
): IdeaSemanticFacts {
  const nextSubject = facts.subject.trim() || ideaNodeSummary(subject);
  const nextKeys = facts.mechanismKeys.length > 0 ? facts.mechanismKeys : keys;
  if (facts.relationToParent === "VALID_IDEA" && facts.resolution === "RESOLVED" && facts.unresolvedReasons.length === 0) {
    if (nextSubject === facts.subject && nextKeys === facts.mechanismKeys) return facts;
    return { ...facts, subject: nextSubject, mechanismKeys: nextKeys };
  }
  if ((facts.mechanismKeys.length > 0 || keys.length === 0) && nextSubject === facts.subject) return facts;
  return normalizeIdeaFacts(
    {
      ...facts,
      subject: nextSubject,
      mechanismKeys: facts.mechanismKeys.length > 0 ? facts.mechanismKeys : keys,
    },
    facts.code,
  );
}

export async function judgeAndSealIdea(input: {
  parentStatement: string;
  masterSubject?: string;
  ancestors?: AncestorStake[];
  code: string;
  statement: string;
  mechanismKeys?: IdeaMechanismKey[];
  subject?: string;
  ask: (prompt: string) => Promise<string | null>;
}): Promise<IdeaSemanticFacts> {
  const judged = await judgeIdea(
    {
      parentStatement: input.parentStatement,
      masterSubject: input.masterSubject,
      ancestors: input.ancestors,
      candidate: { code: input.code, statement: input.statement, mechanismKeys: input.mechanismKeys },
    },
    input.ask,
  );
  return mergeMechanismKeys(judged, input.mechanismKeys ?? [], input.subject ?? "");
}

export async function runIdeaGenerate<
  T extends { code: string; statement: string; admission: IndividualAdmission; angleId: string; locked?: boolean },
>(input: {
  loadParent: () => Promise<{ ok: true; parent: IdeaGenerateParent } | { ok: false; reason: IdeaParentDenial }>;
  incumbents: T[];
  propose: (plan: PlannedIdeaGenerate, parent: IdeaGenerateParent, incumbents: T[]) => Promise<Array<string | IdeaDraft>>;
  judge: (
    parent: IdeaGenerateParent,
    code: string,
    statement: string,
    mechanismKeys: IdeaMechanismKey[],
  ) => Promise<IdeaSemanticFacts>;
  /** Propose one sentence, judge it, then propose the next sentence with that failure available. */
  carryLessons?: boolean;
  persist: (input: {
    parent: IdeaGenerateParent;
    code: string;
    statement: string;
    facts: IdeaSemanticFacts;
    admission: IndividualAdmission;
  }) => Promise<T>;
}): Promise<IdeaGenerateResult<T>> {
  const gate = await input.loadParent();
  if (gate.ok === false) {
    return {
      outcome: "DENIED",
      reason: gate.reason,
      generateValid: countAdmittedIdeas(input.incumbents),
      target: TARGET_IDEA_VALID,
      incumbents: input.incumbents,
      parent: null,
    };
  }
  let incumbents = [...input.incumbents];
  let activeCount = incumbents.filter((row) => row.admission !== "GENERATE_REJECT").length;
  const startedValid = countAdmittedIdeas(incumbents);
  const attemptLimit = input.carryLessons ? IDEA_GENERATE_BATCH : IDEA_MAX_ROUNDS;
  for (let attempt = 1; attempt <= attemptLimit; attempt += 1) {
    if (countAdmittedIdeas(incumbents) - startedValid >= IDEA_GENERATE_BATCH) break;
    const plan = planIdeaGenerate({
      activeCount,
      generateValidCount: countAdmittedIdeas(incumbents),
      round: input.carryLessons ? 1 : attempt,
    });
    if (plan.needed === 0) break;
    const askFor = input.carryLessons ? 1 : Math.min(plan.needed, IDEA_GENERATE_BATCH);
    const drafts = (await input.propose({ ...plan, needed: askFor }, gate.parent, incumbents))
      .slice(0, askFor)
      .map((row) =>
        typeof row === "string"
          ? { subject: "", statement: row, mechanismKeys: [] as IdeaMechanismKey[], concept: "", mechanism: "", value: "" }
          : row,
      )
      .filter((row) => row.statement.trim());
    if (input.carryLessons && drafts.length === 0) break;
    for (const draft of drafts) {
      if (activeCount >= IDEA_ACTIVE_CAP) break;
      if (incumbents.some((row) => sameIdeaConcept(row.statement, draft.statement))) continue;
      const code = nextIdeaCode(incumbents.map((row) => row.code));
      const judged = await input.judge(gate.parent, code, draft.statement, draft.mechanismKeys);
      const facts = mergeMechanismKeys(judged, draft.mechanismKeys, draft.subject);
      const admission = admitIdea(facts);
      const saved = await input.persist({ parent: gate.parent, code, statement: draft.statement, facts, admission });
      incumbents = [...incumbents, { ...saved, admission, angleId: gate.parent.id }];
      if (admission !== "GENERATE_REJECT") activeCount += 1;
    }
    if (countAdmittedIdeas(incumbents) >= TARGET_IDEA_VALID) break;
  }
  const generateValid = countAdmittedIdeas(incumbents);
  return {
    outcome: generateValid >= TARGET_IDEA_VALID ? "READY" : "INSUFFICIENT_VALID_IDEAS",
    generateValid,
    target: TARGET_IDEA_VALID,
    incumbents,
    parent: gate.parent,
  };
}

export async function proposeIdeaStatements(input: {
  parentStatement: string;
  masterSubject?: string;
  ancestors?: AncestorStake[];
  incumbents: Array<{ code: string; statement: string; locked?: boolean }>;
  lessons?: Array<{ code: string; statement: string; reason: string }>;
  failures?: FailureMemoryItem[];
  decisions?: IdeaDecision[] | null;
  needed: number;
  ask: (prompt: string) => Promise<string | null>;
}): Promise<IdeaDraft[]> {
  const script = await input.ask(
    buildIdeaGeneratePrompt({
      parentStatement: input.parentStatement,
      masterSubject: input.masterSubject,
      ancestors: input.ancestors,
      incumbents: input.incumbents,
      lessons: input.lessons,
      failures: input.failures,
      decisions: input.decisions,
      needed: input.needed,
    }),
  );
  if (!script?.trim()) return [];
  return parseGeneratedIdeaDrafts(parseModelJson(script));
}

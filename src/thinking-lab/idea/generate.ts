import { sameIdeaConcept } from "@/thinking-lab/idea/conceptIdentity";
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
  needed: number;
}): string {
  const open = input.incumbents.filter((row) => row.locked !== true);
  const sealed = input.incumbents.filter((row) => row.locked === true);
  const kept = open.length === 0 ? "(none)" : open.map((row) => `${row.code}: ${row.statement}`).join("\n");
  const locked = sealed.length === 0 ? "(none)" : sealed.map((row) => `${row.code}: ${row.statement}`).join("\n");
  return [
    "Write Idea candidates under one direct Angle.",
    "Write the statement and every key in the same language as the Angle.",
    "When the Angle is not English, do not write the statement or the keys in English.",
    "An Idea is a concrete mechanism that makes the Angle happen, become visible, or be proved.",
    "The mechanism is a demonstration, an experiment, a comparison, or a situation.",
    "Write one sentence in the Angle's language. Name what is made, invited, shown, or created, then what that makes true.",
    "Do not write a plot. Do not use namun, tiba-tiba, lalu, or kita mengamati bagaimana.",
    "The sentence contains the mechanism, not a topic, and it does not contain the keys.",
    "It proves the Angle. It does not jump ahead and explain the Big Thought.",
    "State what becomes true in the sentence so the mechanism can be understood.",
    "Do not announce that result with menunjukkan bahwa, membuktikan bahwa, menyoroti bahwa, shows that, proves that, or highlights that.",
    "Do not explain the Big Thought in words. Do not write that this shows or highlights a conclusion. The situation itself is where the reason happens.",
    "Write subject as at most six words in the Angle's language. It names this mechanism and keeps its meaning. It is not a cut-off sentence.",
    "Write the keys separately. Each key is two short clauses, at most twelve words each: the other explanation a viewer might reach, and how this Idea closes it.",
    "Do not write that this shows, proves, or highlights a conclusion inside a key.",
    `Master Thought subject: ${input.masterSubject?.trim() || "(not sealed)"}`,
    "Do not write a finished story. A story is a pillar, not an Idea.",
    "Do not write the lesson, the chart, the shots, the dialogue, or the posting format.",
    "A pillar is chosen later. A pillar that would force a message outside this Idea is refused later.",
    "Do not restate the Angle as an observation or widen it into a life area.",
    ...ANCESTOR_STAKE_RULES,
    "Do not repeat an incumbent by changing only the title, caption, platform, duration, or a similar prop.",
    "Read every locked Idea. Do not reuse its meaning. A new wording of the same mechanism is still a repeat.",
    "Do not use examples from any specific industry, belief system, or brand.",
    `Return at most ${input.needed} candidate(s).`,
    "Return JSON only: {\"ideas\":[{\"subject\":\"...\",\"statement\":\"...\",\"keys\":[{\"otherExplanation\":\"...\",\"close\":\"...\"}]}]}",
    "",
    "Direct Angle:",
    input.parentStatement.trim(),
    ...ancestorStakeBlock(input.ancestors),
    "",
    "Incumbent Ideas, including ones already rejected:",
    kept,
    "",
    "Locked Ideas already sealed:",
    locked,
  ].join("\n");
}

export type IdeaDraft = {
  subject: string;
  statement: string;
  mechanismKeys: IdeaMechanismKey[];
};

export function parseGeneratedIdeaDrafts(raw: unknown): IdeaDraft[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const row = raw as { ideas?: unknown };
  if (Array.isArray(row.ideas)) {
    const drafts: IdeaDraft[] = [];
    for (const item of row.ideas) {
      if (!item || typeof item !== "object") continue;
      const statement = typeof (item as { statement?: unknown }).statement === "string"
        ? (item as { statement: string }).statement.trim()
        : "";
      if (!statement) continue;
      drafts.push({
        subject: typeof (item as { subject?: unknown }).subject === "string" ? (item as { subject: string }).subject.trim() : "",
        statement,
        mechanismKeys: readMechanismKeys((item as { keys?: unknown }).keys),
      });
    }
    return drafts;
  }
  return parseGeneratedIdeaStatements(raw).map((statement) => ({ subject: "", statement, mechanismKeys: [] }));
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
  let activeCount = incumbents.length;
  for (let round = 1; round <= IDEA_MAX_ROUNDS; round += 1) {
    const plan = planIdeaGenerate({ activeCount, generateValidCount: countAdmittedIdeas(incumbents), round });
    if (plan.needed === 0) break;
    const drafts = (await input.propose(plan, gate.parent, incumbents)).slice(0, plan.needed).map((row) =>
      typeof row === "string" ? { subject: "", statement: row, mechanismKeys: [] as IdeaMechanismKey[] } : row,
    );
    for (const draft of drafts) {
      if (activeCount >= IDEA_ACTIVE_CAP) break;
      if (incumbents.some((row) => sameIdeaConcept(row.statement, draft.statement))) continue;
      const code = nextIdeaCode(incumbents.map((row) => row.code));
      const judged = await input.judge(gate.parent, code, draft.statement, draft.mechanismKeys);
      const facts = mergeMechanismKeys(judged, draft.mechanismKeys, draft.subject);
      const admission = admitIdea(facts);
      const saved = await input.persist({ parent: gate.parent, code, statement: draft.statement, facts, admission });
      incumbents = [...incumbents, { ...saved, admission, angleId: gate.parent.id }];
      activeCount += 1;
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
  needed: number;
  ask: (prompt: string) => Promise<string | null>;
}): Promise<IdeaDraft[]> {
  const script = await input.ask(
    buildIdeaGeneratePrompt({
      parentStatement: input.parentStatement,
      masterSubject: input.masterSubject,
      ancestors: input.ancestors,
      incumbents: input.incumbents,
      needed: input.needed,
    }),
  );
  if (!script?.trim()) return [];
  return parseGeneratedIdeaDrafts(parseModelJson(script));
}

import { parseModelJson } from "@/thinking-lab/shared/ai";
import { ANCESTOR_STAKE_RULES, ancestorStakeBlock, type AncestorStake } from "@/thinking-lab/shared/ancestorStake";
import type { IndividualAdmission } from "@/thinking-lab/shared/verdict";
import type { IdeaParentDenial } from "@/thinking-lab/idea/eligibility";
import { admitIdea } from "@/thinking-lab/idea/policy";
import { judgeIdea } from "@/thinking-lab/idea/semantic";
import type { IdeaSemanticFacts } from "@/thinking-lab/idea/types";

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

export function countAdmittedIdeas(rows: Array<{ admission: IndividualAdmission }>): number {
  return rows.filter((row) => row.admission === "GENERATE_VALID").length;
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
  incumbents: Array<{ code: string; statement: string }>;
  needed: number;
}): string {
  const kept =
    input.incumbents.length === 0
      ? "(none)"
      : input.incumbents.map((row) => `${row.code}: ${row.statement}`).join("\n");
  return [
    "Write Idea candidates under one direct Angle.",
    "An Idea creates a situation in which the Angle happens or can be proved. Test it as 'we make, invite, show, or create … so that …'. Do not require that prefix.",
    "The situation must close other explanations, so the named Master Thought subject is the plausible cause.",
    `Master Thought subject: ${input.masterSubject?.trim() || "(not sealed)"}`,
    "Do not verbally explain the Big Thought. Do not restate the Angle as an observation, widen it into a life area, or specify platform, duration, camera, shots, dialogue, or posting format.",
    "Each candidate must say what actually happens in the situation.",
    ...ANCESTOR_STAKE_RULES,
    "Do not repeat an incumbent by changing only the title, caption, platform, duration, or a similar prop.",
    "Write in the same language as the Angle.",
    "Do not use examples from any specific industry, belief system, or brand.",
    `Return at most ${input.needed} candidate(s).`,
    "Return JSON only: {\"statements\":[\"...\"]}",
    "",
    "Direct Angle:",
    input.parentStatement.trim(),
    ...ancestorStakeBlock(input.ancestors),
    "",
    "Incumbent Ideas, including ones already rejected:",
    kept,
  ].join("\n");
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

export async function judgeAndSealIdea(input: {
  parentStatement: string;
  masterSubject?: string;
  ancestors?: AncestorStake[];
  code: string;
  statement: string;
  ask: (prompt: string) => Promise<string | null>;
}): Promise<IdeaSemanticFacts> {
  return judgeIdea(
    {
      parentStatement: input.parentStatement,
      masterSubject: input.masterSubject,
      ancestors: input.ancestors,
      candidate: { code: input.code, statement: input.statement },
    },
    input.ask,
  );
}

export async function runIdeaGenerate<
  T extends { code: string; statement: string; admission: IndividualAdmission; angleId: string },
>(input: {
  loadParent: () => Promise<{ ok: true; parent: IdeaGenerateParent } | { ok: false; reason: IdeaParentDenial }>;
  incumbents: T[];
  propose: (plan: PlannedIdeaGenerate, parent: IdeaGenerateParent, incumbents: T[]) => Promise<string[]>;
  judge: (parent: IdeaGenerateParent, code: string, statement: string) => Promise<IdeaSemanticFacts>;
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
    const statements = (await input.propose(plan, gate.parent, incumbents)).slice(0, plan.needed);
    for (const statement of statements) {
      if (activeCount >= IDEA_ACTIVE_CAP) break;
      const code = nextIdeaCode(incumbents.map((row) => row.code));
      const facts = await input.judge(gate.parent, code, statement);
      const admission = admitIdea(facts);
      const saved = await input.persist({ parent: gate.parent, code, statement, facts, admission });
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
  ancestors?: AncestorStake[];
  incumbents: Array<{ code: string; statement: string }>;
  needed: number;
  ask: (prompt: string) => Promise<string | null>;
}): Promise<string[]> {
  const script = await input.ask(
    buildIdeaGeneratePrompt({
      parentStatement: input.parentStatement,
      ancestors: input.ancestors,
      incumbents: input.incumbents,
      needed: input.needed,
    }),
  );
  if (!script?.trim()) return [];
  return parseGeneratedIdeaStatements(parseModelJson(script));
}

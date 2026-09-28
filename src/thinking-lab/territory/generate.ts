import { ANCESTOR_STAKE_RULES, ancestorStakeBlock, type AncestorStake } from "@/thinking-lab/shared/ancestorStake";
import { ACTIVE_SET_CAP, MAX_GENERATE_ROUNDS, TARGET_GENERATE_VALID } from "@/thinking-lab/shared/limits";
import { parseModelJson } from "@/thinking-lab/shared/ai";
import type { TerritoryParentDenial } from "@/thinking-lab/territory/eligibility";
import { reviewTerritoryGenerativity, sealTerritoryFacts } from "@/thinking-lab/territory/generativity";
import { admitTerritory } from "@/thinking-lab/territory/policy";
import { judgeTerritory, TERRITORY_STAKE_LINES, territoryPassLines } from "@/thinking-lab/territory/semantic";
import type { TerritorySemanticFacts } from "@/thinking-lab/territory/types";
import type { IndividualAdmission } from "@/thinking-lab/shared/verdict";

export type TerritoryGenerateStop = null | "ENOUGH" | "CAP" | "ROUNDS";

export type PlannedTerritoryGenerate = {
  needed: number;
  stop: TerritoryGenerateStop;
};

export function planTerritoryGenerate(input: {
  activeCount: number;
  generateValidCount: number;
  round: number;
}): PlannedTerritoryGenerate {
  if (input.round > MAX_GENERATE_ROUNDS) return { needed: 0, stop: "ROUNDS" };
  if (input.activeCount >= ACTIVE_SET_CAP) return { needed: 0, stop: "CAP" };
  const missing = TARGET_GENERATE_VALID - input.generateValidCount;
  if (missing <= 0) return { needed: 0, stop: "ENOUGH" };
  const room = ACTIVE_SET_CAP - input.activeCount;
  return { needed: Math.min(missing, room), stop: null };
}

export function countAdmittedTerritories(rows: Array<{ admission: IndividualAdmission }>): number {
  return rows.filter((row) => row.admission === "GENERATE_VALID").length;
}

/** True when Generate admitted a Territory that was not already in the set. */
export function admittedTerritorySetChanged(
  before: Array<{ code: string; admission: IndividualAdmission }>,
  after: Array<{ code: string; admission: IndividualAdmission }>,
): boolean {
  const codes = (rows: Array<{ code: string; admission: IndividualAdmission }>) =>
    rows
      .filter((row) => row.admission === "GENERATE_VALID")
      .map((row) => row.code.toUpperCase())
      .sort();
  const previous = codes(before);
  const next = codes(after);
  return previous.length !== next.length || previous.some((code, index) => code !== next[index]);
}

export function nextTerritoryCode(existingCodes: string[]): string {
  let max = 0;
  for (const code of existingCodes) {
    const match = /^TR(\d+)$/i.exec(code.trim());
    if (!match) continue;
    max = Math.max(max, Number(match[1]));
  }
  return `TR${String(max + 1).padStart(2, "0")}`;
}

export function buildTerritoryGeneratePrompt(input: {
  parentStatement: string;
  ancestors?: AncestorStake[];
  audience?: string;
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
    "Write Territory candidates under one direct Big Thought.",
    "A Territory names an area in the audience's world where that Big Thought's reason can be discussed.",
    "Write a noun or a noun phrase. Do not write a claim, a belief, or a because-clause.",
    ...territoryPassLines(input.audience),
    "Do not name an impact, a requirement, or an evaluation. Those are claims even when the grammar is still a noun phrase.",
    ...TERRITORY_STAKE_LINES,
    "A short noun phrase is allowed. Do not expand it into a proposition just to make it longer.",
    "Do not restate the parent, repeat an incumbent, or offer a space that can hold only one observation.",
    ...ANCESTOR_STAKE_RULES,
    "Read the earlier audit failures. Do not repeat the mistake that made those Territories fail.",
    "Do not invent a weak space to fill a quota. Return fewer candidates when a strong space is not available.",
    "Write in the same language as the Big Thought.",
    "Do not use examples from any specific industry, belief system, or brand.",
    `Return at most ${input.needed} candidate(s).`,
    "Return JSON only: {\"statements\":[\"...\"]}",
    "",
    "Direct Big Thought:",
    input.parentStatement.trim(),
    ...ancestorStakeBlock(input.ancestors),
    "",
    "Incumbent Territories, including ones already rejected:",
    kept,
    "",
    "Earlier Territories that failed audit. Do not make the same mistake:",
    lessonLines,
  ].join("\n");
}

export function buildTerritoryGapPrompt(input: {
  parentStatement: string;
  ancestors?: AncestorStake[];
  audience?: string;
  incumbents: Array<{ code: string; statement: string }>;
  gap: string;
}): string {
  const kept =
    input.incumbents.length === 0
      ? "(none)"
      : input.incumbents.map((row) => `${row.code}: ${row.statement}`).join("\n");
  return [
    "Write one Territory that fills a named gap under one direct Big Thought.",
    "A Territory is a noun or noun phrase naming an audience area where several Angles could live. It must not contain a claim.",
    ...territoryPassLines(input.audience),
    "Do not name an impact, a requirement, or an evaluation. Those are claims even when the grammar is still a noun phrase.",
    ...TERRITORY_STAKE_LINES,
    "It must cover the missing area and must not restate the Big Thought, repeat an incumbent, or sit inside an incumbent.",
    ...ANCESTOR_STAKE_RULES,
    "Do not return a slogan or a single claim.",
    "Write in the same language as the Big Thought.",
    "Do not use examples from any specific industry, belief system, or brand.",
    "Return JSON only: {\"statements\":[\"...\"]}",
    "",
    "Direct Big Thought:",
    input.parentStatement.trim(),
    ...ancestorStakeBlock(input.ancestors),
    "",
    "Missing space:",
    input.gap.trim(),
    "",
    "Incumbent Territories:",
    kept,
  ].join("\n");
}

export function parseGeneratedTerritoryStatements(raw: unknown): string[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const statements = (raw as { statements?: unknown }).statements;
  if (!Array.isArray(statements)) return [];
  return statements
    .filter((row): row is string => typeof row === "string" && row.trim().length > 0)
    .map((row) => row.trim());
}

export type TerritoryGenerateParent = {
  id: string;
  code: string;
  statement: string;
  ancestors?: AncestorStake[];
  audience?: string;
};

export type TerritoryGenerateResult<T> = {
  outcome: "READY" | "INSUFFICIENT_VALID_TERRITORIES" | "DENIED";
  reason?: TerritoryParentDenial;
  generateValid: number;
  target: number;
  incumbents: T[];
  parent: TerritoryGenerateParent | null;
};

export async function judgeAndSealTerritory(input: {
  parentStatement: string;
  ancestors?: AncestorStake[];
  audience?: string;
  code: string;
  statement: string;
  ask: (prompt: string) => Promise<string | null>;
}): Promise<TerritorySemanticFacts> {
  const provisional = await judgeTerritory(
    {
      parentStatement: input.parentStatement,
      ancestors: input.ancestors,
      audience: input.audience,
      candidate: { code: input.code, statement: input.statement },
    },
    input.ask,
  );
  const review = await reviewTerritoryGenerativity(
    { parentStatement: input.parentStatement, statement: input.statement },
    input.ask,
  );
  return sealTerritoryFacts(provisional, review);
}

export async function runTerritoryGenerate<
  T extends { code: string; statement: string; admission: IndividualAdmission; bigThoughtId: string },
>(input: {
  loadParent: () => Promise<
    { ok: true; parent: TerritoryGenerateParent } | { ok: false; reason: TerritoryParentDenial }
  >;
  incumbents: T[];
  propose: (plan: PlannedTerritoryGenerate, parent: TerritoryGenerateParent, incumbents: T[]) => Promise<string[]>;
  judge: (parent: TerritoryGenerateParent, code: string, statement: string) => Promise<TerritorySemanticFacts>;
  persist: (input: {
    parent: TerritoryGenerateParent;
    code: string;
    statement: string;
    facts: TerritorySemanticFacts;
    admission: IndividualAdmission;
  }) => Promise<T>;
}): Promise<TerritoryGenerateResult<T>> {
  const gate = await input.loadParent();
  if (gate.ok === false) {
    return {
      outcome: "DENIED",
      reason: gate.reason,
      generateValid: countAdmittedTerritories(input.incumbents),
      target: TARGET_GENERATE_VALID,
      incumbents: input.incumbents,
      parent: null,
    };
  }
  let incumbents = [...input.incumbents];
  let activeCount = incumbents.filter((row) => row.admission !== "GENERATE_REJECT").length;
  for (let round = 1; round <= MAX_GENERATE_ROUNDS; round += 1) {
    const plan = planTerritoryGenerate({
      activeCount,
      generateValidCount: countAdmittedTerritories(incumbents),
      round,
    });
    if (plan.needed === 0) break;
    const statements = (await input.propose(plan, gate.parent, incumbents)).slice(0, plan.needed);
    for (const statement of statements) {
      if (activeCount >= ACTIVE_SET_CAP) break;
      const code = nextTerritoryCode(incumbents.map((row) => row.code));
      const facts = await input.judge(gate.parent, code, statement);
      const admission = admitTerritory(facts);
      const saved = await input.persist({ parent: gate.parent, code, statement, facts, admission });
      incumbents = [...incumbents, { ...saved, admission, bigThoughtId: gate.parent.id }];
      if (admission !== "GENERATE_REJECT") activeCount += 1;
    }
    if (countAdmittedTerritories(incumbents) >= TARGET_GENERATE_VALID) break;
  }
  const generateValid = countAdmittedTerritories(incumbents);
  return {
    outcome: generateValid >= TARGET_GENERATE_VALID ? "READY" : "INSUFFICIENT_VALID_TERRITORIES",
    generateValid,
    target: TARGET_GENERATE_VALID,
    incumbents,
    parent: gate.parent,
  };
}

export async function proposeTerritoryStatements(input: {
  parentStatement: string;
  ancestors?: AncestorStake[];
  audience?: string;
  incumbents: Array<{ code: string; statement: string }>;
  lessons?: Array<{ code: string; statement: string; reason: string }>;
  needed: number;
  ask: (prompt: string) => Promise<string | null>;
}): Promise<string[]> {
  const script = await input.ask(
    buildTerritoryGeneratePrompt({
      parentStatement: input.parentStatement,
      ancestors: input.ancestors,
      audience: input.audience,
      incumbents: input.incumbents,
      lessons: input.lessons,
      needed: input.needed,
    }),
  );
  if (!script?.trim()) return [];
  const parsed = parseModelJson(script);
  return parseGeneratedTerritoryStatements(parsed);
}

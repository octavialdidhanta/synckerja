import { ANCESTOR_STAKE_RULES, ancestorStakeBlock, type AncestorStake } from "@/thinking-lab/shared/ancestorStake";
import { territoryLinkInstruction } from "@/thinking-lab/territory/link";
import { ACTIVE_SET_CAP, MAX_GENERATE_ROUNDS, TARGET_GENERATE_VALID } from "@/thinking-lab/shared/limits";
import { parseModelJson } from "@/thinking-lab/shared/ai";
import type { TerritoryParentDenial } from "@/thinking-lab/territory/eligibility";
import { reviewTerritoryGenerativity, sealTerritoryFacts } from "@/thinking-lab/territory/generativity";
import {
  buildTerritoryLivedFitPrompt,
  buildTerritoryPlacePrompt,
  parseTerritoryLivedFit,
  parseTerritoryPlace,
  territoryScreenRejection,
} from "@/thinking-lab/territory/checks";
import { admitTerritory } from "@/thinking-lab/territory/policy";
import { judgeTerritory, TERRITORY_STAKE_LINES, territoryPassLines } from "@/thinking-lab/territory/semantic";
import type { TerritoryRelation, TerritorySemanticFacts } from "@/thinking-lab/territory/types";
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
  topUp?: boolean;
}): PlannedTerritoryGenerate {
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

export type TerritoryPromptRow = {
  code: string;
  statement: string;
  admission?: IndividualAdmission;
  relationToParent?: TerritoryRelation;
};

export type TerritoryGenerateLesson = {
  code: string;
  statement: string;
  reason: string;
};

export function territoryRejectionReason(relation: TerritoryRelation): string | null {
  switch (relation) {
    case "OUT_OF_PARENT_SCOPE":
      return "This is not an area in the audience's world. A keyword of the Big Thought, an internal term, or a claim is the same mistake. Write a noun the audience already uses, in at most three words. Do not put the reason into the name.";
    case "PARENT_SCOPE_DUPLICATION":
      return "This repeats the Big Thought's reason as a noun. Name the area where that reason is discussed, without writing the reason into the name.";
    case "BIG_THOUGHT_LIKE":
      return "This is a belief, not an area. Write a noun for an area in the audience's world.";
    case "ANGLE_LIKE":
      return "This closes on one claim. Write an area wide enough for several Angles.";
    case "DOWNSTREAM_EXECUTION_LIKE":
      return "This is an action or a method. Write the area where the reason is discussed.";
    case "INSUFFICIENT_GENERATIVITY":
      return "This space can hold only one observation. Widen it enough for several Angles.";
    case "UNBOUNDED_SPACE":
      return "The boundary is too broad. Name a recognizable area.";
    case "CLAIM_BEARING":
      return "This name states a claim, a lack, or an evaluation. Write only the area. The reason stays out of the name.";
    case "INTERNAL_LANGUAGE":
      return "These are internal strategy words. Use the audience's words.";
    case "QUESTION_NOT_LIVED":
      return "The question this Big Thought answers does not come up in this area. Name an area where that question actually shows up.";
    case "UNRESOLVED":
      return "The audit could not decide this space. Do not offer another name of the same kind.";
    case "VALID_TERRITORY":
      return null;
  }
}

export const TERRITORY_NAME_WORD_LIMIT = 3;

export const TERRITORY_NAME_LENGTH_REASON =
  "The name is longer than three words. Write a noun of at most three words.";

export const TERRITORY_ACTIVITY_REASON =
  "This names an activity, not an area the audience discusses. Write a short noun the audience already uses, in at most three words.";

const ACTIVITY_HEAD =
  /^(?:pelaksanaan|pengenalan|penanganan|pelatihan|pengelolaan|pengambilan|penerapan|pengaturan|pengerjaan|pemrosesan|proses)\b/i;

export function territoryNameIsActivity(statement: string): boolean {
  return ACTIVITY_HEAD.test(statement.trim());
}

export function territoryNameWordCount(statement: string): number {
  return statement.trim().split(/\s+/).filter(Boolean).length;
}

export function territoryNameTooLong(statement: string): boolean {
  return territoryNameWordCount(statement) > TERRITORY_NAME_WORD_LIMIT;
}

export function territoryAdmissionLessons(rows: TerritoryPromptRow[]): TerritoryGenerateLesson[] {
  return rows.flatMap((row) => {
    if (!row.admission || row.admission === "GENERATE_VALID") return [];
    const lessons: TerritoryGenerateLesson[] = [];
    const tooLong = territoryNameTooLong(row.statement);
    const activity = territoryNameIsActivity(row.statement);
    if (tooLong) {
      lessons.push({ code: row.code, statement: row.statement, reason: TERRITORY_NAME_LENGTH_REASON });
    }
    if (activity) {
      lessons.push({ code: row.code, statement: row.statement, reason: TERRITORY_ACTIVITY_REASON });
    }
    const stampedLength = tooLong && row.relationToParent === "UNBOUNDED_SPACE";
    if (row.relationToParent && !stampedLength) {
      const reason = territoryRejectionReason(row.relationToParent);
      if (reason) lessons.push({ code: row.code, statement: row.statement, reason });
    }
    return lessons;
  });
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

function territoryLanguageSample(parentStatement: string, ancestors?: AncestorStake[]): string {
  return [parentStatement, ...(ancestors ?? []).map((item) => item.statement)].join(" ");
}

function combineTerritoryLessons(
  explicit: TerritoryGenerateLesson[],
  fromAdmission: TerritoryGenerateLesson[],
): TerritoryGenerateLesson[] {
  const seen = new Set<string>();
  const combined: TerritoryGenerateLesson[] = [];
  for (const lesson of [...explicit, ...fromAdmission]) {
    const key = `${lesson.code}\n${lesson.statement}\n${lesson.reason}`;
    if (seen.has(key)) continue;
    seen.add(key);
    combined.push(lesson);
  }
  return combined;
}

export function buildTerritoryGeneratePrompt(input: {
  parentStatement: string;
  ancestors?: AncestorStake[];
  audience?: string;
  answeredQuestion?: string;
  incumbents: TerritoryPromptRow[];
  lessons?: TerritoryGenerateLesson[];
  needed: number;
}): string {
  const kept =
    input.incumbents.length === 0
      ? "(none)"
      : input.incumbents.map((row) => `${row.code}: ${row.statement}`).join("\n");
  const lessons = combineTerritoryLessons(input.lessons ?? [], territoryAdmissionLessons(input.incumbents));
  const lessonLines =
    lessons.length === 0
      ? "(none)"
      : lessons.map((lesson) => `${lesson.code}: ${lesson.statement}\nWhy it failed: ${lesson.reason}`).join("\n");
  return [
    "Write Territory candidates under one direct Big Thought.",
    "A Territory names an area in the audience's world where that Big Thought's reason can be discussed.",
    "The area is a place where people ask a question the Big Thought answers. The Master Thought alone does not already answer that question.",
    "Write a noun or a noun phrase. Do not write a claim, a belief, or a because-clause.",
    territoryLinkInstruction(input.answeredQuestion ?? "", territoryLanguageSample(input.parentStatement, input.ancestors)),
    ...territoryPassLines(input.audience),
    "Do not name an impact, a requirement, or an evaluation. Those are claims even when the grammar is still a noun phrase.",
    "A short noun phrase is allowed. Do not expand it into a proposition just to make it longer.",
    "Do not restate the parent, repeat an incumbent, or offer a space that can hold only one observation.",
    ...ANCESTOR_STAKE_RULES,
    ...TERRITORY_STAKE_LINES,
    "Read the earlier audit failures. Do not repeat the mistake that made those Territories fail. A new name that fails for the same reason is still that mistake.",
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
  answeredQuestion?: string;
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
    territoryLinkInstruction(input.answeredQuestion ?? "", territoryLanguageSample(input.parentStatement, input.ancestors)),
    ...territoryPassLines(input.audience),
    "Do not name an impact, a requirement, or an evaluation. Those are claims even when the grammar is still a noun phrase.",
    "It must cover the missing area and must not restate the Big Thought, repeat an incumbent, or sit inside an incumbent.",
    ...ANCESTOR_STAKE_RULES,
    ...TERRITORY_STAKE_LINES,
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

/** Name shown immediately. The long area, question, and generativity checks stay off this path. */
export function shownTerritoryFacts(code: string, statement: string): TerritorySemanticFacts {
  return {
    code,
    whatItSays: statement.trim(),
    relationToParent: "VALID_TERRITORY",
    parentFit: true,
    conceptualForm: "TERRITORY_SPACE",
    parentScopeDuplication: false,
    generativity: "SUFFICIENT",
    boundedness: "BOUNDED",
    nominalForm: "NOMINAL",
    audienceLanguage: "AUDIENCE",
    livedQuestion: true,
    resolution: "RESOLVED",
    unresolvedReasons: [],
  };
}

export async function judgeAndSealTerritory(input: {
  parentStatement: string;
  ancestors?: AncestorStake[];
  audience?: string;
  answeredQuestion?: string;
  code: string;
  statement: string;
  ask: (prompt: string) => Promise<string | null>;
}): Promise<TerritorySemanticFacts> {
  const question = input.answeredQuestion?.trim() ?? "";
  const [placeScript, livedScript] = await Promise.all([
    input.ask(
      buildTerritoryPlacePrompt({
        statement: input.statement,
        parentStatement: input.parentStatement,
        audience: input.audience,
      }),
    ),
    question
      ? input.ask(buildTerritoryLivedFitPrompt({ statement: input.statement, question }))
      : Promise.resolve(null),
  ]);
  if (parseTerritoryPlace(placeScript) !== true) {
    return territoryScreenRejection(input.code, "OUT_OF_PARENT_SCOPE");
  }
  if (!question || parseTerritoryLivedFit(livedScript) !== true) {
    return territoryScreenRejection(input.code, "QUESTION_NOT_LIVED");
  }
  const provisional = await judgeTerritory(
    {
      parentStatement: input.parentStatement,
      ancestors: input.ancestors,
      audience: input.audience,
      answeredQuestion: input.answeredQuestion,
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
  T extends {
    code: string;
    statement: string;
    admission: IndividualAdmission;
    bigThoughtId: string;
    relationToParent?: TerritoryRelation;
  },
>(input: {
  loadParent: () => Promise<
    { ok: true; parent: TerritoryGenerateParent } | { ok: false; reason: TerritoryParentDenial }
  >;
  incumbents: T[];
  topUp?: boolean;
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
      topUp: input.topUp,
    });
    if (plan.needed === 0) break;
    const statements = (await input.propose(plan, gate.parent, incumbents)).slice(0, plan.needed);
    const room = Math.max(0, ACTIVE_SET_CAP - activeCount);
    const reserved = incumbents.map((row) => row.code);
    const planned = statements.slice(0, room).map((statement) => {
      const code = nextTerritoryCode(reserved);
      reserved.push(code);
      return { code, statement };
    });
    const judged = await Promise.all(
      planned.map(async ({ code, statement }) => {
        const raw = await input.judge(gate.parent, code, statement);
        const tooLong = territoryNameTooLong(statement);
        const activity = territoryNameIsActivity(statement);
        const admitted = admitTerritory(raw) === "GENERATE_VALID";
        const facts =
          admitted && tooLong
            ? { ...raw, relationToParent: "UNBOUNDED_SPACE" as const, boundedness: "UNBOUNDED" as const }
            : admitted && activity
              ? { ...raw, relationToParent: "OUT_OF_PARENT_SCOPE" as const }
              : raw;
        return { code, statement, facts };
      }),
    );
    for (const item of judged) {
      const admission = admitTerritory(item.facts);
      const saved = await input.persist({
        parent: gate.parent,
        code: item.code,
        statement: item.statement,
        facts: item.facts,
        admission,
      });
      incumbents = [
        ...incumbents,
        { ...saved, admission, bigThoughtId: gate.parent.id, relationToParent: item.facts.relationToParent },
      ];
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
  answeredQuestion?: string;
  incumbents: TerritoryPromptRow[];
  lessons?: TerritoryGenerateLesson[];
  needed: number;
  ask: (prompt: string) => Promise<string | null>;
}): Promise<string[]> {
  const script = await input.ask(
    buildTerritoryGeneratePrompt({
      parentStatement: input.parentStatement,
      ancestors: input.ancestors,
      audience: input.audience,
      answeredQuestion: input.answeredQuestion,
      incumbents: input.incumbents,
      lessons: input.lessons,
      needed: input.needed,
    }),
  );
  if (!script?.trim()) return [];
  const parsed = parseModelJson(script);
  return parseGeneratedTerritoryStatements(parsed);
}

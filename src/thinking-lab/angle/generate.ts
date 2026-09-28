import { parseModelJson } from "@/thinking-lab/shared/ai";
import { ANCESTOR_STAKE_RULES, ancestorStakeBlock, type AncestorStake } from "@/thinking-lab/shared/ancestorStake";
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
}): PlannedAngleGenerate {
  if (input.round > MAX_GENERATE_ROUNDS) return { needed: 0, stop: "ROUNDS" };
  if (input.activeCount >= ACTIVE_SET_CAP) return { needed: 0, stop: "CAP" };
  const missing = TARGET_GENERATE_VALID - input.generateValidCount;
  if (missing <= 0) return { needed: 0, stop: "ENOUGH" };
  const room = ACTIVE_SET_CAP - input.activeCount;
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
  needed: number;
}): string {
  const kept =
    input.incumbents.length === 0
      ? "(none)"
      : input.incumbents.map((row) => `${row.code}: ${row.statement}`).join("\n");
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
    "Do not use examples from any specific industry, belief system, or brand.",
    `Return at most ${input.needed} candidate(s).`,
    "Return JSON only: {\"statements\":[\"...\"]}",
    "",
    "Direct Territory:",
    input.parentStatement.trim(),
    ...ancestorStakeBlock(input.ancestors),
    "",
    "Incumbent Angles, including ones already rejected:",
    kept,
  ].join("\n");
}

export function buildAngleGapPrompt(input: {
  parentStatement: string;
  ancestors?: AncestorStake[];
  incumbents: Array<{ code: string; statement: string }>;
  gap: string;
}): string {
  const kept =
    input.incumbents.length === 0
      ? "(none)"
      : input.incumbents.map((row) => `${row.code}: ${row.statement}`).join("\n");
  return [
    "Write one Angle that fills a named gap under one direct Territory.",
    "An Angle is an observation, contradiction, or tension inside one Territory. It must not fit smoothly as a because-clause.",
    "It must cover the missing observation and must not restate the Territory, repeat an incumbent, or sit inside an incumbent.",
    ...ANCESTOR_STAKE_RULES,
    "It must be able to generate several substantively different Ideas.",
    "Write in the same language as the Territory.",
    "Do not use examples from any specific industry, belief system, or brand.",
    "Return JSON only: {\"statements\":[\"...\"]}",
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
  ].join("\n");
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
  propose: (plan: PlannedAngleGenerate, parent: AngleGenerateParent, incumbents: T[]) => Promise<string[]>;
  judge: (parent: AngleGenerateParent, code: string, statement: string) => Promise<AngleSemanticFacts>;
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
  let activeCount = incumbents.length;
  for (let round = 1; round <= MAX_GENERATE_ROUNDS; round += 1) {
    const plan = planAngleGenerate({
      activeCount,
      generateValidCount: countAdmittedAngles(incumbents),
      round,
    });
    if (plan.needed === 0) break;
    const statements = (await input.propose(plan, gate.parent, incumbents)).slice(0, plan.needed);
    for (const statement of statements) {
      if (activeCount >= ACTIVE_SET_CAP) break;
      const code = nextAngleCode(incumbents.map((row) => row.code));
      const facts = await input.judge(gate.parent, code, statement);
      const admission = admitAngle(facts);
      const saved = await input.persist({ parent: gate.parent, code, statement, facts, admission });
      incumbents = [...incumbents, { ...saved, admission, territoryId: gate.parent.id }];
      activeCount += 1;
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
  needed: number;
  ask: (prompt: string) => Promise<string | null>;
}): Promise<string[]> {
  const script = await input.ask(
    buildAngleGeneratePrompt({
      parentStatement: input.parentStatement,
      ancestors: input.ancestors,
      incumbents: input.incumbents,
      needed: input.needed,
    }),
  );
  if (!script?.trim()) return [];
  const parsed = parseModelJson(script);
  return parseGeneratedAngleStatements(parsed);
}

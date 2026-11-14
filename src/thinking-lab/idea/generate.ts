import { sameIdeaConcept } from "./conceptIdentity";
import { ideaWorldLines } from "./discover";
import { readMechanismKeys, type IdeaMechanismKey } from "./facts";
import type { IdeaDecision } from "./ideaSet";
import { howIfInstruction } from "./check/guards";
import { formatFailureMemory, type FailureMemoryItem } from "./check/memory";
import { admissionForDecision, type IdeaValidation } from "./check/record";
import { parseModelJson } from "../shared/parseModelJson";
import { ANCESTOR_STAKE_RULES, ancestorStakeBlock, type AncestorStake } from "../shared/ancestorStake";
import type { IndividualAdmission } from "../shared/verdict";
import type { IdeaParentDenial } from "./eligibility";

const TARGET_IDEA_VALID = 5;
export const IDEA_ACTIVE_CAP = 10;
/** One Generate run proposes at most this many sentences, one at a time, each checked before the next. */
const IDEA_GENERATE_BATCH = 3;

function countAdmittedIdeas(rows: Array<{ admission: IndividualAdmission; locked?: boolean }>): number {
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
  failures: FailureMemoryItem[];
  decisions?: IdeaDecision[] | null;
}): string {
  const open = input.incumbents.filter((row) => row.locked !== true);
  const sealed = input.incumbents.filter((row) => row.locked === true);
  const lines = (rows: typeof open) => (rows.length === 0 ? "(none)" : rows.map((row) => `${row.code}: ${row.statement}`).join("\n"));
  return [
    "Write one Idea under one direct Angle.",
    "An Idea is one specific proposal of what we make happen in front of the audience: a mechanism that makes the Angle happen, become visible, or be proved.",
    howIfInstruction(input.parentStatement),
    "Write the statement, the keys, and every field in the same language as the Angle.",
    "The vehicle is a comparison, an experiment, a demonstration, or a situation. A situation may unfold over time, as long as its turning point is caused by the Master Thought subject.",
    "Do not write a finished story with a plot or dialogue, a metaphor, a lesson, or a production form. A story is told later in a pillar.",
    "Name what becomes true in the sentence. Do not announce it with menunjukkan bahwa, membuktikan bahwa, menyoroti bahwa, shows that, proves that, or highlights that.",
    "The audience must be able to watch it or join it during time they already spend, without a new product, skill, profession, or commitment.",
    "Write the keys separately: each key is the other explanation a viewer might reach and how this Idea closes it, so the Master Thought subject is the only plausible cause.",
    `Master Thought subject: ${input.masterSubject?.trim() || "(not sealed)"}`,
    "Do not restate the Angle as an observation or widen it into a life area.",
    ...ANCESTOR_STAKE_RULES,
    "Read every Idea below. Do not reuse its mechanism. A new wording of the same mechanism, or the same audience action, is still a repeat.",
    "Read the earlier failures. Do not return a sentence listed there, and do not repeat its mistake.",
    ...ideaWorldLines(input.decisions),
    'Return JSON only: {"ideas":[{"title":"...","statement":"...","concept":"...","mechanism":"...","value":"...","keys":[{"otherExplanation":"...","close":"..."}]}]}',
    "",
    "Direct Angle:",
    input.parentStatement.trim(),
    ...ancestorStakeBlock(input.ancestors),
    "",
    "Open Ideas:",
    lines(open),
    "",
    "Locked Ideas:",
    lines(sealed),
    "",
    formatFailureMemory(input.failures),
  ].join("\n");
}

export type IdeaDraft = {
  title: string;
  statement: string;
  mechanismKeys: IdeaMechanismKey[];
  concept: string;
  mechanism: string;
  value: string;
};

function field(item: Record<string, unknown>, key: string): string {
  const value = item[key];
  return typeof value === "string" ? value.trim() : "";
}

function readIdeaDraft(item: unknown): IdeaDraft | null {
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;
  const row = item as Record<string, unknown>;
  const statement = field(row, "statement");
  if (!statement) return null;
  return {
    title: field(row, "title") || field(row, "subject"),
    statement,
    mechanismKeys: readMechanismKeys(row.keys),
    concept: field(row, "concept"),
    mechanism: field(row, "mechanism"),
    value: field(row, "value"),
  };
}

export function parseGeneratedIdeaDrafts(raw: unknown): IdeaDraft[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const ideas = (raw as { ideas?: unknown }).ideas;
  if (!Array.isArray(ideas)) {
    const single = readIdeaDraft(raw);
    return single ? [single] : [];
  }
  return ideas.flatMap((item) => {
    const draft = readIdeaDraft(item);
    return draft ? [draft] : [];
  });
}

type IdeaGenerateParent = {
  id: string;
  code: string;
  statement: string;
  angleFingerprint: string;
  ancestors?: AncestorStake[];
};

type IdeaGenerateResult<T> = {
  outcome: "READY" | "INSUFFICIENT_VALID_IDEAS" | "DENIED";
  reason?: IdeaParentDenial;
  generateValid: number;
  target: number;
  incumbents: T[];
  parent: IdeaGenerateParent | null;
};

/** How many more sentences this run may ask for. */
function roomLeft(activeCount: number, admitted: number): number {
  if (activeCount >= IDEA_ACTIVE_CAP) return 0;
  return Math.max(0, Math.min(TARGET_IDEA_VALID - admitted, IDEA_ACTIVE_CAP - activeCount));
}

/** Proposes one sentence, checks it, saves it, then proposes the next with that result available. */
export async function runIdeaGenerate<
  T extends { code: string; statement: string; admission: IndividualAdmission; angleId: string; locked?: boolean },
>(input: {
  loadParent: () => Promise<{ ok: true; parent: IdeaGenerateParent } | { ok: false; reason: IdeaParentDenial }>;
  incumbents: T[];
  propose: (parent: IdeaGenerateParent, incumbents: T[]) => Promise<IdeaDraft | null>;
  check: (parent: IdeaGenerateParent, draft: IdeaDraft) => Promise<IdeaValidation>;
  persist: (input: { parent: IdeaGenerateParent; code: string; draft: IdeaDraft; validation: IdeaValidation; admission: IndividualAdmission }) => Promise<T>;
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
  for (let attempt = 0; attempt < IDEA_GENERATE_BATCH; attempt += 1) {
    if (roomLeft(activeCount, countAdmittedIdeas(incumbents)) === 0) break;
    const draft = await input.propose(gate.parent, incumbents);
    if (!draft) break;
    if (incumbents.some((row) => sameIdeaConcept(row.statement, draft.statement))) continue;
    const code = nextIdeaCode(incumbents.map((row) => row.code));
    const validation = await input.check(gate.parent, draft);
    const admission = admissionForDecision(validation.decision);
    const saved = await input.persist({ parent: gate.parent, code, draft, validation, admission });
    incumbents = [...incumbents, { ...saved, admission, angleId: gate.parent.id }];
    if (admission !== "GENERATE_REJECT") activeCount += 1;
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

export async function proposeIdea(input: Parameters<typeof buildIdeaGeneratePrompt>[0] & {
  ask: (prompt: string) => Promise<string | null>;
}): Promise<IdeaDraft | null> {
  const script = await input.ask(buildIdeaGeneratePrompt(input));
  if (!script?.trim()) return null;
  return parseGeneratedIdeaDrafts(parseModelJson(script))[0] ?? null;
}

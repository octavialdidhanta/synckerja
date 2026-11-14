import { parseModelJson } from "./parseModelJson";

/**
 * Several pass checks of one item in one model call. Each check keeps its own rule text and is
 * judged on its own; the caller still walks the checks in order and stops at the first failure,
 * so the result has the same shape as asking one check at a time.
 */
export type BatchGate = { id: string; rules: string[]; extra?: string[] };

export type GateAnswer = { pass: boolean; reason: string };

/** The reason of a check the model left undecided. */
export const UNDECIDED_REASON = "This check could not be decided.";
/** The reason shown on a check switched OFF for the organization. */
export const SWITCHED_OFF_REASON = "Dimatikan untuk organisasi ini.";
const UNDECIDED = UNDECIDED_REASON;

export function buildBatchGatePrompt(input: {
  item: string;
  gates: BatchGate[];
  context: string[];
  language: string;
}): string {
  const blocks = input.gates.flatMap((gate) => [
    "",
    `Check ${gate.id}:`,
    ...gate.rules,
    ...(gate.extra ?? []),
  ]);
  return [
    `Decide each ${input.item} pass check below. Do not rewrite the text.`,
    "Judge every check on its own, by its own rule only. One check's answer must not change another check's answer.",
    `When a check fails, its reason is one sentence in the same language as the ${input.language}.`,
    "When you cannot decide a check, do not return pass true for it.",
    `Return JSON only: {"checks":[{"id":"...","pass":true,"reason":""}]} with exactly one entry for each check id: ${input.gates.map((gate) => gate.id).join(", ")}.`,
    ...blocks,
    "",
    ...input.context,
  ].join("\n");
}

/** Answers by check id, or null when any asked check is missing, so the caller can ask one by one. */
export function parseBatchGates(script: string | null, ids: readonly string[]): Map<string, GateAnswer> | null {
  if (!script?.trim()) return null;
  const parsed = parseModelJson(script);
  const root = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as { checks?: unknown }) : null;
  const list = Array.isArray(root?.checks) ? root.checks : Array.isArray(parsed) ? parsed : null;
  if (!list) return null;
  const answers = new Map<string, GateAnswer>();
  for (const item of list) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const row = item as { id?: unknown; pass?: unknown; reason?: unknown };
    const id = typeof row.id === "string" ? row.id.trim() : "";
    if (!ids.includes(id) || answers.has(id)) continue;
    const reason = typeof row.reason === "string" ? row.reason.trim() : "";
    if (row.pass === true) answers.set(id, { pass: true, reason: "" });
    else if (row.pass === false) answers.set(id, { pass: false, reason: reason || UNDECIDED });
    else answers.set(id, { pass: false, reason: UNDECIDED });
  }
  return ids.every((id) => answers.has(id)) ? answers : null;
}

/** One call for every open check; a second call when the first answer cannot be read. */
export async function askBatchGates(input: {
  prompt: string;
  ids: readonly string[];
  ask: (prompt: string) => Promise<string | null>;
}): Promise<Map<string, GateAnswer> | null> {
  if (input.ids.length === 0) return new Map();
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let script: string | null = null;
    try {
      script = await input.ask(input.prompt);
    } catch {
      script = null;
    }
    const answers = parseBatchGates(script, input.ids);
    if (answers) return answers;
  }
  return null;
}

/** One check's answer. A missing, unreadable, or undecided answer fails the check as undecided. */
export function parseGateAnswer(script: string | null): GateAnswer {
  if (!script?.trim()) return { pass: false, reason: UNDECIDED };
  const parsed = parseModelJson(script);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { pass: false, reason: UNDECIDED };
  const row = parsed as { pass?: unknown; reason?: unknown };
  const reason = typeof row.reason === "string" ? row.reason.trim() : "";
  if (row.pass === true) return { pass: true, reason: "" };
  if (row.pass === false) return { pass: false, reason: reason || UNDECIDED };
  return { pass: false, reason: UNDECIDED };
}

/**
 * The batched answer when it decided the check; otherwise the check asked alone,
 * and asked once more when that answer is still undecided.
 */
export async function answerGate(input: {
  batched?: GateAnswer | null;
  prompt: () => string;
  ask: (prompt: string) => Promise<string | null>;
}): Promise<GateAnswer> {
  let answer = input.batched ?? null;
  if (!answer || isUndecided(answer)) answer = parseGateAnswer(await input.ask(input.prompt()));
  if (isUndecided(answer)) answer = parseGateAnswer(await input.ask(input.prompt()));
  return answer;
}

/** A single-check answer the model left undecided is asked again alone. */
export function isUndecided(answer: GateAnswer | undefined): boolean {
  return Boolean(answer && !answer.pass && answer.reason === UNDECIDED);
}

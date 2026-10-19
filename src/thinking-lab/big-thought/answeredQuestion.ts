import { becauseConnector } from "@/thinking-lab/big-thought/because";
import { parseModelJson } from "@/thinking-lab/shared/ai";

function plain(value: string): string {
  return value.trim().replace(/\s+/g, " ").trim();
}

export const ANSWERED_QUESTION_VERSION = 5;

const QUESTION_STOP = new Set([
  "apa",
  "apakah",
  "yang",
  "jika",
  "kalau",
  "tidak",
  "bukan",
  "dengan",
  "untuk",
  "dari",
  "pada",
  "dalam",
  "akan",
  "adalah",
  "ini",
  "itu",
  "dan",
  "atau",
  "karena",
  "sebab",
  "saat",
  "ketika",
  "sudah",
  "telah",
  "lebih",
  "banyak",
  "sangat",
  "justru",
  "masih",
  "juga",
  "para",
  "sebuah",
  "meskipun",
  "dianggap",
  "penting",
  "menyebabkan",
  "memiliki",
  "mempunyai",
  "mana",
  "kenapa",
  "mengapa",
  "bagaimana",
  "the",
  "and",
  "or",
  "not",
  "with",
  "from",
  "that",
  "this",
  "what",
  "why",
  "how",
  "does",
  "when",
  "where",
  "because",
]);

function contentToken(word: string): string {
  return word
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, "")
    .replace(/(?:nya|kah|lah|pun)$/i, "");
}

function contentTokens(text: string): string[] {
  return plain(text)
    .toLowerCase()
    .split(/\s+/)
    .map(contentToken)
    .filter((token) => token.length >= 4 && !QUESTION_STOP.has(token));
}

export function repeatsMasterConclusion(question: string, master: string): boolean {
  const masterTokens = new Set(contentTokens(master));
  const questionTokens = contentTokens(question);
  if (masterTokens.size === 0 || questionTokens.length === 0) return false;
  const overlap = questionTokens.filter((token) => masterTokens.has(token));
  return overlap.length >= 3;
}

export function buildAnsweredQuestionPrompt(input: {
  master: string;
  reason: string;
  audience?: string;
  rejected?: string[];
}): string {
  const language = becauseConnector(`${input.master} ${input.reason}`) === "karena" ? "Indonesian" : "English";
  const people = input.audience?.trim();
  const rejected = (input.rejected ?? []).map((row) => row.trim()).filter(Boolean);
  return [
    "Write the one question this Big Thought answers.",
    `Write it in ${language}.`,
    "The question is specific to this reason. A question the Master Thought already answers, before this reason, is too broad.",
    "Ask the practical question whose answer is this reason.",
    "Do not ask the Master Thought's conclusion again. A rephrasing of that conclusion is still that question.",
    "Do not start with apakah, does, is, are, do, or can. Ask why or how this reason changes the cost.",
    people ? `Use words this audience would use: ${people}.` : "Use the audience's words.",
    "One short question. End it with a question mark.",
    "Do not write the because-clause. Do not start with karena or because.",
    ...(rejected.length > 0
      ? ["These questions were rejected. Do not write them again, and do not rephrase them:", ...rejected]
      : []),
    'Return JSON only: {"question":"..."}',
    "",
    `Master Thought: ${input.master.trim()}`,
    `Big Thought: ${input.reason.trim()}`,
  ].join("\n");
}

export function buildAnsweredQuestionScopePrompt(input: { master: string; reason: string; question: string }): string {
  return [
    "Decide which sentence this question is asking.",
    "REASON means the question stays unanswered if this Big Thought's reason is removed.",
    "MASTER means the question asks for the Master Thought's conclusion, even when the words are different.",
    "A question about the waste, the cost, or the harm the Master Thought already states is MASTER.",
    "UNRESOLVED when that cannot be decided.",
    'Return JSON only: {"scope":"REASON"} or {"scope":"MASTER"} or {"scope":"UNRESOLVED"}',
    "",
    `Master Thought: ${input.master.trim()}`,
    `Big Thought: ${input.reason.trim()}`,
    `Question: ${input.question.trim()}`,
  ].join("\n");
}

export function buildMasterAnswerabilityPrompt(input: { master: string; reason: string; question: string }): string {
  return [
    "Decide one fact. Do not write an answer.",
    "answerable is true when the Master Thought alone is enough to answer the question.",
    "answerable is false when the answer still needs this Big Thought's reason.",
    "Choose true or false.",
    'Return JSON only: {"answerable":true} or {"answerable":false}',
    "",
    `Master Thought: ${input.master.trim()}`,
    `Big Thought: ${input.reason.trim()}`,
    `Question: ${input.question.trim()}`,
  ].join("\n");
}

export function parseMasterAnswerability(script: string | null): "ANSWERABLE" | "NEEDS_REASON" | "UNRESOLVED" {
  if (!script?.trim()) return "UNRESOLVED";
  const parsed = parseModelJson(script);
  const raw =
    parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as { answerable?: unknown }).answerable
      : script;
  if (raw === true || raw === "true") return "ANSWERABLE";
  if (raw === false || raw === "false") return "NEEDS_REASON";
  if (typeof raw !== "string") return "UNRESOLVED";
  const token = raw.trim().toLowerCase();
  if (token === "true") return "ANSWERABLE";
  if (token === "false") return "NEEDS_REASON";
  return "UNRESOLVED";
}

export function parseAnsweredQuestionScope(script: string | null): "REASON" | "MASTER" | "UNRESOLVED" {
  if (!script?.trim()) return "UNRESOLVED";
  const parsed = parseModelJson(script);
  const raw =
    parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as { scope?: unknown }).scope
      : script;
  if (typeof raw !== "string") return "UNRESOLVED";
  const scope = raw.trim().toUpperCase();
  if (scope === "REASON" || scope === "MASTER" || scope === "UNRESOLVED") return scope;
  return "UNRESOLVED";
}

export function draftAnsweredQuestion(script: string | null, reason = ""): string {
  if (!script?.trim()) return "";
  const parsed = parseModelJson(script);
  const raw =
    parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as { question?: unknown }).question
      : script;
  if (typeof raw !== "string") return "";
  let text = plain(raw.split(/(?<=[?？])\s+/)[0] ?? "");
  text = text.replace(/^["'“”]+|["'“”]+$/g, "").trim();
  if (!text || text.length > 180) return "";
  if (/^(karena|because)\b/i.test(text)) return "";
  const reasonText = plain(reason).toLowerCase();
  if (reasonText.length > 24 && text.toLowerCase().includes(reasonText)) return "";
  if (!/[?？]$/.test(text)) text = `${text.replace(/[.。]+$/g, "")}?`;
  return text;
}

export function parseAnsweredQuestion(script: string | null, reason = "", master = ""): string {
  const text = draftAnsweredQuestion(script, reason);
  if (!text || repeatsMasterConclusion(text, master)) return "";
  return text;
}

const ANSWERED_QUESTION_ATTEMPTS = 3;

/** One stable question for this Big Thought. A question that only restates the Master Thought is asked again. */
export async function resolveAnsweredQuestion(input: {
  master: string;
  reason: string;
  audience?: string;
  ask: (prompt: string) => Promise<string | null>;
}): Promise<string> {
  const rejected: string[] = [];
  for (let attempt = 0; attempt < ANSWERED_QUESTION_ATTEMPTS; attempt += 1) {
    const script = await input.ask(
      buildAnsweredQuestionPrompt({
        master: input.master,
        reason: input.reason,
        audience: input.audience,
        rejected,
      }),
    );
    const question = parseAnsweredQuestion(script, input.reason, input.master);
    if (!question) {
      const draft = draftAnsweredQuestion(script, input.reason);
      if (draft) rejected.push(draft);
      continue;
    }
    const scope = parseAnsweredQuestionScope(
      await input.ask(
        buildAnsweredQuestionScopePrompt({ master: input.master, reason: input.reason, question }),
      ),
    );
    if (scope !== "REASON") {
      rejected.push(question);
      continue;
    }
    const answerable = parseMasterAnswerability(
      await input.ask(
        buildMasterAnswerabilityPrompt({ master: input.master, reason: input.reason, question }),
      ),
    );
    if (answerable !== "NEEDS_REASON") {
      rejected.push(question);
      continue;
    }
    return question;
  }
  return "";
}

import { asBecauseClause } from "@/thinking-lab/big-thought/because";

function labelWords(raw: string): string[] {
  return raw
    .replace(/[“”"'`]/g, "")
    .replace(/[.。,;:!?—–-]+$/g, "")
    .trim()
    .split(/\s+/)
    .map((word) => word.replace(/^[.。,;:!?—–-]+|[.。,;:!?—–-]+$/g, ""))
    .filter(Boolean);
}

const OPEN_LABEL_WORD = new Set([
  "tak",
  "tidak",
  "yang",
  "dan",
  "atau",
  "dari",
  "ke",
  "di",
  "untuk",
  "tanpa",
  "dengan",
  "pada",
  "akan",
  "karena",
  "of",
  "the",
  "a",
  "an",
  "and",
  "or",
  "to",
  "for",
  "with",
]);

function withCapital(label: string): string {
  const characters = Array.from(label);
  const index = characters.findIndex((character) => /\p{L}/u.test(character));
  if (index < 0) return label;
  characters[index] = characters[index].toLocaleUpperCase();
  return characters.join("");
}

const LABEL_WORD_CAP = 12;

export function normalizeBigThoughtLabel(raw: string): string {
  const words = labelWords(raw).slice(0, LABEL_WORD_CAP);
  if (words.length < 1) return "";
  return withCapital(words.join(" "));
}

export function bigThoughtLabelIsOpen(raw: string): boolean {
  const words = labelWords(raw);
  if (words.length === 0) return false;
  return OPEN_LABEL_WORD.has(words[words.length - 1].toLocaleLowerCase());
}

const LABEL_GLUE = new Set(["dan", "atau", "and", "or", "the", "of", "yang", "dengan"]);

export function sameBigThoughtLabel(left: string, right: string): boolean {
  const tokens = (value: string) =>
    labelWords(value)
      .map((word) => word.toLocaleLowerCase())
      .filter((word) => !LABEL_GLUE.has(word));
  const a = [...new Set(tokens(left))].sort();
  const b = [...new Set(tokens(right))].sort();
  if (a.length === 0 || b.length === 0) return false;
  return a.length === b.length && a.every((word, index) => word === b[index]);
}

export function bigThoughtRepeats(
  candidate: { label: string; statement: string },
  incumbent: { label?: string; statement: string },
): boolean {
  const left = candidate.statement.trim().toLocaleLowerCase();
  const right = incumbent.statement.trim().toLocaleLowerCase();
  if (left && right && left === right) return true;
  return Boolean(candidate.label.trim() && incumbent.label?.trim() && sameBigThoughtLabel(candidate.label, incumbent.label));
}

export function bigThoughtLabelRestates(label: string, statement: string): boolean {
  const words = labelWords(label).map((word) => word.toLocaleLowerCase());
  if (words.length >= 6) return true;
  if (words.length < 4) return false;
  const span = words.join(" ");
  const haystack = labelWords(statement)
    .map((word) => word.toLocaleLowerCase())
    .join(" ");
  return haystack.includes(span);
}

export function readBigThoughtLabel(raw: string): { ok: true; label: string } | { ok: false; reason: "EMPTY" | "TOO_LONG" } {
  const words = labelWords(raw);
  if (words.length === 0) return { ok: false, reason: "EMPTY" };
  if (words.length > LABEL_WORD_CAP) return { ok: false, reason: "TOO_LONG" };
  return { ok: true, label: words.join(" ") };
}

export function bigThoughtHeading(code: string, label: string): string {
  const clean = normalizeBigThoughtLabel(label);
  return clean ? `${code} — ${clean}` : code;
}

export function bigThoughtTreeCode(code: string, label: string): string {
  const clean = normalizeBigThoughtLabel(label);
  return clean ? `${code}-${clean}` : code;
}

export function buildBigThoughtLabelPrompt(rows: Array<{ code: string; statement: string }>): string {
  const lines = rows.map((row) => `${row.code}: ${row.statement.trim()}`).join("\n");
  return [
    "Name each Big Thought by the meaning of its because-clause.",
    "The subject is a semantic name: the reason in a few words, not a shorter copy of the sentence.",
    "Keep that meaning. A name of two or three words is right when it still names the same reason.",
    "Use more words only when a shorter name would name a different reason.",
    "Do not write a clause, and do not copy a stretch of the because-clause.",
    "Start each subject with a capital letter.",
    "Do not end a subject on a loose word such as Tak, Yang, Dan, Atau, Dari, Untuk, Tanpa, or Karena.",
    "The subject is only a heading. It is not a new Big Thought.",
    "Do not rewrite, shorten, or replace any because-clause.",
    "Write each label in the same language as its because-clause.",
    "Return JSON only: {\"labels\":[{\"code\":\"BT01\",\"label\":\"...\"}]}",
    "",
    lines,
  ].join("\n");
}

export function buildKeyBeliefFromLabelPrompt(input: {
  parentStatement: string;
  label: string;
  incumbents: Array<{ code: string; statement: string }>;
  rejection?: string | null;
}): string {
  const kept =
    input.incumbents.length === 0
      ? "(none)"
      : input.incumbents.map((row) => `${row.code}: ${row.statement.trim()}`).join("\n");
  const retry = input.rejection?.trim()
    ? [
        "The previous because-clause was rejected.",
        `Rejection: ${input.rejection.trim()}`,
        "Write a different because-clause that still belongs to the same label.",
      ]
    : [];
  return [
    "Write one because-clause for the label the user chose.",
    "The label is the heading. Do not change, translate, or replace the label.",
    "Return only the words that follow because. Inserting because between the Master Thought and this clause must already make one sentence.",
    "The clause finishes the belief that is already there, including its comparison. It does not open a new claim.",
    "Do not restate or elaborate the Master Thought. Do not unpack a part the Master Thought already asserts.",
    "Do not repeat an incumbent Big Thought.",
    "Do not offer a method, tactic, or execution.",
    "Do not start with because. Do not return only the label.",
    "Write the clause in the same language as the Master Thought.",
    ...retry,
    "Return JSON only: {\"statement\":\"...\"}",
    "",
    "Label:",
    input.label.trim(),
    "",
    "Master Thought:",
    input.parentStatement.trim(),
    "",
    "Incumbent Big Thoughts:",
    kept,
  ].join("\n");
}

export function parseKeyBeliefFromLabel(raw: unknown, parentStatement = ""): string {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return "";
  const record = raw as { statement?: unknown; items?: unknown };
  const direct = typeof record.statement === "string" ? record.statement : "";
  if (direct.trim()) return asBecauseClause(direct, parentStatement);
  if (!Array.isArray(record.items)) return "";
  const first = record.items.find((row) => row && typeof row === "object");
  const statement = first && typeof first === "object" ? (first as { statement?: unknown }).statement : null;
  return typeof statement === "string" ? asBecauseClause(statement, parentStatement) : "";
}

export function parseBigThoughtLabels(raw: unknown): Map<string, string> {
  const labels = new Map<string, string>();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return labels;
  const rows = (raw as { labels?: unknown }).labels;
  if (!Array.isArray(rows)) return labels;
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const code = (row as { code?: unknown }).code;
    const label = (row as { label?: unknown }).label;
    if (typeof code !== "string" || typeof label !== "string") continue;
    const clean = normalizeBigThoughtLabel(label);
    if (!clean) continue;
    labels.set(code.trim().toUpperCase(), clean);
  }
  return labels;
}

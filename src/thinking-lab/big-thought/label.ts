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

export function normalizeBigThoughtLabel(raw: string): string {
  const words = labelWords(raw).slice(0, 3);
  if (words.length < 1) return "";
  return words.join(" ");
}

export function readBigThoughtLabel(raw: string): { ok: true; label: string } | { ok: false; reason: "EMPTY" | "TOO_LONG" } {
  const words = labelWords(raw);
  if (words.length === 0) return { ok: false, reason: "EMPTY" };
  if (words.length > 3) return { ok: false, reason: "TOO_LONG" };
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
    "Write one short label for each Big Thought.",
    "Each label is 1 to 3 words.",
    "The label is only a heading. It names the core of that because-clause.",
    "The label is not a new Big Thought.",
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

// What an Idea row stores beside its sentence (thinking_lab_ideas.canonical_semantic): a short name and
// the mechanism keys. Relative imports only: the MCP server loads this file.
import { ANNOUNCED_CONCLUSION } from "./check/guards";
import { ideaNodeSummary } from "./subject";

/** One other explanation a viewer might reach, and how this Idea closes it. Stored apart from the sentence. */
export type IdeaMechanismKey = {
  otherExplanation: string;
  close: string;
};

export type IdeaFacts = {
  code: string;
  whatItSays: string;
  /** Short name of the mechanism, at most six words. */
  subject: string;
  mechanismKeys: IdeaMechanismKey[];
};

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function clipKeyClause(raw: string): string {
  const first = raw.split(/(?:\.\.|[.!?])/)[0]?.trim() ?? "";
  return first.split(/\s+/).filter(Boolean).slice(0, 12).join(" ").trim();
}

/** Keys with both clauses, each at most twelve words. A key that announces a conclusion is dropped. */
export function readMechanismKeys(value: unknown): IdeaMechanismKey[] {
  if (!Array.isArray(value)) return [];
  const keys: IdeaMechanismKey[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const record = row as { otherExplanation?: unknown; close?: unknown };
    const otherExplanation = clipKeyClause(asText(record.otherExplanation));
    const close = clipKeyClause(asText(record.close));
    if (!otherExplanation || !close) continue;
    if (ANNOUNCED_CONCLUSION.test(otherExplanation) || ANNOUNCED_CONCLUSION.test(close)) continue;
    keys.push({ otherExplanation, close });
  }
  return keys;
}

export function ideaFacts(input: { code: string; statement: string; subject?: string; mechanismKeys?: IdeaMechanismKey[] }): IdeaFacts {
  return {
    code: input.code,
    whatItSays: input.statement.trim(),
    subject: ideaNodeSummary(input.subject ?? ""),
    mechanismKeys: input.mechanismKeys ?? [],
  };
}

/** A stored row. Older rows carry more fields; only these are read. */
export function readIdeaFacts(raw: unknown, fallbackCode = ""): IdeaFacts {
  const row = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return {
    code: asText(row.code) || fallbackCode,
    whatItSays: asText(row.whatItSays),
    subject: ideaNodeSummary(asText(row.subject)),
    mechanismKeys: readMechanismKeys(row.mechanismKeys),
  };
}

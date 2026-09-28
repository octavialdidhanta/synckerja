import { parseModelJson } from "@/thinking-lab/shared/ai";
import { ANCESTOR_STAKE_RULES, ancestorStakeBlock, type AncestorStake } from "@/thinking-lab/shared/ancestorStake";
import { TERRITORY_STAKE_LINES, territoryPassLines } from "@/thinking-lab/territory/semantic";
import { scoreTerritoryAudit } from "@/thinking-lab/territory/setAudit";
import type { TerritorySetFacts } from "@/thinking-lab/territory/types";

export type TerritoryFixReplacement = {
  code: string;
  statement: string;
};

export function buildTerritoryFixPrompt(input: {
  parentStatement: string;
  ancestors?: AncestorStake[];
  audience?: string;
  failed: Array<{ code: string; statement: string }>;
  keepers: Array<{ code: string; statement: string }>;
  conflicts: string[];
}): string {
  const failedLines = input.failed.map((row) => `${row.code}: ${row.statement}`).join("\n");
  const keeperLines =
    input.keepers.length === 0 ? "(none)" : input.keepers.map((row) => `${row.code}: ${row.statement}`).join("\n");
  const conflictLines = input.conflicts.length === 0 ? "(none)" : input.conflicts.join("\n");
  return [
    "Replace each failed Territory with one audience area named as a noun or noun phrase, without a claim.",
    ...territoryPassLines(input.audience),
    ...TERRITORY_STAKE_LINES,
    "A replacement must be able to hold several different observations.",
    "It must not restate the Big Thought, repeat a keeper, overlap another replacement, or sit inside another replacement.",
    ...ANCESTOR_STAKE_RULES,
    "Use the conflict notes to leave the failed space, not to paraphrase it.",
    "Return one replacement for every failed code. Do not replace a Territory that already passed.",
    "Write in the same language as the Big Thought.",
    "Do not use examples from any specific industry, belief system, or brand.",
    "Return JSON only: {\"replacements\":[{\"code\":\"TR01\",\"statement\":\"...\"}]}",
    "",
    "Direct Big Thought:",
    input.parentStatement.trim(),
    ...ancestorStakeBlock(input.ancestors),
    "",
    "Failed Territories:",
    failedLines,
    "",
    "Territories that already passed and must stay distinct:",
    keeperLines,
    "",
    "Conflict notes:",
    conflictLines,
  ].join("\n");
}

export function parseTerritoryFixReplacements(raw: unknown, failedCodes: string[]): TerritoryFixReplacement[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const rows = (raw as { replacements?: unknown }).replacements;
  if (!Array.isArray(rows)) return [];
  const wanted = new Set(failedCodes.map((code) => code.toUpperCase()));
  const seen = new Set<string>();
  const replacements: TerritoryFixReplacement[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const item = row as { code?: unknown; statement?: unknown };
    const code = typeof item.code === "string" ? item.code.trim().toUpperCase() : "";
    const statement = typeof item.statement === "string" ? item.statement.trim() : "";
    if (!wanted.has(code) || !statement || seen.has(code)) continue;
    seen.add(code);
    replacements.push({ code, statement });
  }
  return replacements;
}

export function parseTerritoryFixScript(script: string | null, failedCodes: string[]): TerritoryFixReplacement[] {
  if (!script?.trim()) return [];
  return parseTerritoryFixReplacements(parseModelJson(script), failedCodes);
}

export function buildTerritoryFixOptionsPrompt(input: {
  parentStatement: string;
  ancestors?: AncestorStake[];
  audience?: string;
  failed: { code: string; statement: string };
  keepers: Array<{ code: string; statement: string }>;
  conflicts: string[];
}): string {
  const keeperLines =
    input.keepers.length === 0 ? "(none)" : input.keepers.map((row) => `${row.code}: ${row.statement}`).join("\n");
  const conflictLines = input.conflicts.length === 0 ? "(none)" : input.conflicts.join("\n");
  return [
    "Propose three replacement Territories for one failed Territory.",
    "Each replacement is a noun or noun phrase naming an audience area, without a claim, and can hold several different observations.",
    ...territoryPassLines(input.audience),
    ...TERRITORY_STAKE_LINES,
    "Each one must stay distinct from the keepers, from the failed Territory, and from the other proposals.",
    "Do not restate the Big Thought, paraphrase the failed Territory, or sit inside a keeper.",
    ...ANCESTOR_STAKE_RULES,
    "Use the conflict notes to leave the failed space.",
    "Write in the same language as the Big Thought.",
    "Do not use examples from any specific industry, belief system, or brand.",
    "Return JSON only: {\"statements\":[\"...\",\"...\",\"...\"]}",
    "",
    "Direct Big Thought:",
    input.parentStatement.trim(),
    ...ancestorStakeBlock(input.ancestors),
    "",
    "Failed Territory:",
    `${input.failed.code}: ${input.failed.statement}`,
    "",
    "Territories that already passed and must stay distinct:",
    keeperLines,
    "",
    "Conflict notes:",
    conflictLines,
  ].join("\n");
}

export function parseTerritoryFixOptions(raw: unknown): string[] {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as { statements?: unknown }).statements : raw;
  if (!Array.isArray(source)) return [];
  const seen = new Set<string>();
  const statements: string[] = [];
  for (const row of source) {
    const statement = typeof row === "string" ? row.trim() : "";
    if (!statement || seen.has(statement)) continue;
    seen.add(statement);
    statements.push(statement);
    if (statements.length === 3) break;
  }
  return statements;
}

export function parseTerritoryFixOptionsScript(script: string | null): string[] {
  if (!script?.trim()) return [];
  return parseTerritoryFixOptions(parseModelJson(script));
}

/** A replacement is offered only when this sibling judgment already scores that code as AUDIT_PASS. */
export function territoryReplacementPasses(set: TerritorySetFacts | null, code: string): boolean {
  if (!set) return false;
  return (
    scoreTerritoryAudit({ codes: [code], siblingSet: set, siblingSetCurrent: true })[0]?.verdict === "AUDIT_PASS"
  );
}

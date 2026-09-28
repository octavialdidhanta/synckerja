import { parseModelJson } from "@/thinking-lab/shared/ai";
import { ANCESTOR_STAKE_RULES, ancestorStakeBlock, type AncestorStake } from "@/thinking-lab/shared/ancestorStake";
import { scoreAngleAudit } from "@/thinking-lab/angle/setAudit";
import type { AngleSetFacts } from "@/thinking-lab/angle/types";

export type AngleFixReplacement = {
  code: string;
  statement: string;
};

export function buildAngleFixPrompt(input: {
  parentStatement: string;
  ancestors?: AncestorStake[];
  failed: Array<{ code: string; statement: string }>;
  keepers: Array<{ code: string; statement: string }>;
  conflicts: string[];
}): string {
  const failedLines = input.failed.map((row) => `${row.code}: ${row.statement}`).join("\n");
  const keeperLines =
    input.keepers.length === 0 ? "(none)" : input.keepers.map((row) => `${row.code}: ${row.statement}`).join("\n");
  const conflictLines = input.conflicts.length === 0 ? "(none)" : input.conflicts.join("\n");
  return [
    "Replace each failed Angle with one observation, contradiction, or tension inside the direct Territory.",
    "A replacement must be able to generate several different ideas.",
    "It must not restate the Territory, repeat a keeper, overlap another replacement, or sit inside another replacement.",
    ...ANCESTOR_STAKE_RULES,
    "Use the conflict notes to leave the failed point of view, not to paraphrase it.",
    "Return one replacement for every failed code.",
    "Write in the same language as the Territory.",
    "Do not use examples from any specific industry, belief system, or brand.",
    "Return JSON only: {\"replacements\":[{\"code\":\"AN01\",\"statement\":\"...\"}]}",
    "",
    "Direct Territory:",
    input.parentStatement.trim(),
    ...ancestorStakeBlock(input.ancestors),
    "",
    "Failed Angles:",
    failedLines,
    "",
    "Angles that already passed and must stay distinct:",
    keeperLines,
    "",
    "Conflict notes:",
    conflictLines,
  ].join("\n");
}

export function parseAngleFixReplacements(raw: unknown, failedCodes: string[]): AngleFixReplacement[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const rows = (raw as { replacements?: unknown }).replacements;
  if (!Array.isArray(rows)) return [];
  const wanted = new Set(failedCodes.map((code) => code.toUpperCase()));
  const seen = new Set<string>();
  const replacements: AngleFixReplacement[] = [];
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

export function parseAngleFixScript(script: string | null, failedCodes: string[]): AngleFixReplacement[] {
  if (!script?.trim()) return [];
  return parseAngleFixReplacements(parseModelJson(script), failedCodes);
}

export function buildAngleFixOptionsPrompt(input: {
  parentStatement: string;
  ancestors?: AncestorStake[];
  failed: { code: string; statement: string };
  keepers: Array<{ code: string; statement: string }>;
  conflicts: string[];
}): string {
  const keeperLines =
    input.keepers.length === 0 ? "(none)" : input.keepers.map((row) => `${row.code}: ${row.statement}`).join("\n");
  const conflictLines = input.conflicts.length === 0 ? "(none)" : input.conflicts.join("\n");
  return [
    "Propose three replacement Angles for one failed Angle.",
    "Each replacement is an observation, contradiction, or tension inside the direct Territory and can generate several different ideas.",
    "Do not write a because-clause.",
    "Each one must stay distinct from the keepers, from the failed Angle, and from the other proposals.",
    "Do not restate the Territory, paraphrase the failed Angle, or sit inside a keeper.",
    ...ANCESTOR_STAKE_RULES,
    "Use the conflict notes to leave the failed point of view.",
    "Write in the same language as the Territory.",
    "Do not use examples from any specific industry, belief system, or brand.",
    "Return JSON only: {\"statements\":[\"...\",\"...\",\"...\"]}",
    "",
    "Direct Territory:",
    input.parentStatement.trim(),
    ...ancestorStakeBlock(input.ancestors),
    "",
    "Failed Angle:",
    `${input.failed.code}: ${input.failed.statement}`,
    "",
    "Angles that already passed and must stay distinct:",
    keeperLines,
    "",
    "Conflict notes:",
    conflictLines,
  ].join("\n");
}

export function parseAngleFixOptions(raw: unknown): string[] {
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

export function parseAngleFixOptionsScript(script: string | null): string[] {
  if (!script?.trim()) return [];
  return parseAngleFixOptions(parseModelJson(script));
}

/** A replacement is offered only when this sibling judgment already scores that code as AUDIT_PASS. */
export function angleReplacementPasses(set: AngleSetFacts | null, code: string): boolean {
  if (!set) return false;
  return scoreAngleAudit({ codes: [code], siblingSet: set, siblingSetCurrent: true })[0]?.verdict === "AUDIT_PASS";
}

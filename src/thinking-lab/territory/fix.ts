import { parseModelJson } from "../shared/parseModelJson";
import { fixScopeLines, openMistakeLines, type FixScope } from "../shared/fixScope";
import { territoryLinkInstruction } from "./link";
import { ANCESTOR_STAKE_RULES, ancestorStakeBlock, type AncestorStake } from "../shared/ancestorStake";
import { TERRITORY_STAKE_LINES, territoryPassLines } from "./semantic";
import { scoreTerritoryAudit } from "./setAudit";
import type { TerritorySetFacts } from "./types";

export function buildTerritoryFixOptionsPrompt(input: {
  parentStatement: string;
  ancestors?: AncestorStake[];
  audience?: string;
  answeredQuestion?: string;
  failed: { code: string; statement: string };
  keepers: Array<{ code: string; statement: string }>;
  conflicts: string[];
  lessons?: Array<{ code: string; statement: string; reason: string }>;
  scope?: FixScope;
}): string {
  const keeperLines =
    input.keepers.length === 0 ? "(none)" : input.keepers.map((row) => `${row.code}: ${row.statement}`).join("\n");
  const conflictLines = input.conflicts.length === 0 ? "(none)" : input.conflicts.join("\n");
  const lessons = input.lessons ?? [];
  const lessonLines =
    lessons.length === 0
      ? "(none)"
      : lessons.map((lesson) => `${lesson.code}: ${lesson.statement}\nWhy it failed: ${lesson.reason}`).join("\n");
  return [
    "Propose one replacement Territory for the failed Territory.",
    "The replacement is a noun or noun phrase naming an audience area, without a claim, and can hold several different observations.",
    territoryLinkInstruction(
      input.answeredQuestion ?? "",
      [input.parentStatement, ...(input.ancestors ?? []).map((item) => item.statement)].join(" "),
    ),
    ...territoryPassLines(input.audience),
    "It must stay distinct from the keepers and from the failed Territory.",
    "Do not restate the Big Thought, paraphrase the failed Territory, or sit inside a keeper.",
    ...ANCESTOR_STAKE_RULES,
    ...TERRITORY_STAKE_LINES,
    "Use the conflict notes to leave the failed space.",
    "Read the earlier failures. Do not return a name listed there. A new name that fails for the same reason is still that mistake.",
    ...fixScopeLines(input.scope ?? { preserve: [], repair: [] }),
    "Write in the same language as the Big Thought.",
    "Do not use examples from any specific industry, belief system, or brand.",
    "Return JSON only: {\"statements\":[\"...\"]}",
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
    "",
    "Earlier failures. Do not repeat these names or this mistake:",
    lessonLines,
    ...openMistakeLines(lessons, input.scope ?? { preserve: [], repair: [] }),
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

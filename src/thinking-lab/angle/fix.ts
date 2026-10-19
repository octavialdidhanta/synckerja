import { parseModelJson } from "@/thinking-lab/shared/ai";
import { fixScopeLines, openMistakeLines, type FixScope } from "@/thinking-lab/shared/fixScope";
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
    "Propose one replacement Angle for the failed Angle.",
    "The replacement is an observation, contradiction, or tension inside the direct Territory and can generate several different ideas.",
    "Do not write a because-clause.",
    "It must stay distinct from the keepers and from the failed Angle.",
    "Do not restate the Territory, paraphrase the failed Angle, or sit inside a keeper.",
    ...ANCESTOR_STAKE_RULES,
    "Use the conflict notes to leave the failed point of view.",
    "Read the earlier failures. Do not return a sentence listed there. A new sentence that fails for the same reason is still that mistake.",
    ...fixScopeLines(input.scope ?? { preserve: [], repair: [] }),
    "Write in the same language as the Territory.",
    "Also write subject: one to six words that name this observation on their own. Do not use the Territory's name.",
    "Also write example: one concrete situation a person could point at that shows this observation.",
    "The statement stays the observation. Do not place that situation inside the statement.",
    "The example is not a second explanation of the pattern and not a finished Idea.",
    "Do not use examples from any specific industry, belief system, or brand.",
    "Return JSON only: {\"subject\":\"...\",\"example\":\"...\",\"statements\":[\"...\"]}",
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
    "",
    "Earlier failures. Do not repeat these sentences or this mistake:",
    lessonLines,
    ...openMistakeLines(lessons, input.scope ?? { preserve: [], repair: [] }),
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

export function buildAngleSubjectPrompt(input: { territory: string; statement: string }): string {
  return [
    "Name this Angle with a short subject. Do not rewrite the observation.",
    "The subject is one to six words. Read alone, it names the observation.",
    "Do not use the Territory's name or copy a chopped opening of the sentence.",
    "Write in the same language as the Territory.",
    'Return JSON only: {"subject":"..."}',
    "",
    "Territory:",
    input.territory.trim(),
    "Angle:",
    input.statement.trim(),
  ].join("\n");
}

export function parseAngleSubjectScript(script: string | null): string {
  if (!script?.trim()) return "";
  const parsed = parseModelJson(script);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return "";
  const subject = (parsed as { subject?: unknown }).subject;
  return typeof subject === "string" ? subject.trim() : "";
}

export function buildAngleExamplePrompt(input: {
  territory: string;
  statement: string;
  refused?: string[];
}): string {
  const refused = (input.refused ?? []).map((row) => row.trim()).filter(Boolean);
  return [
    "Write one concrete example of this observation. Do not rewrite the observation.",
    "The example is one situation a person could point at, in the audience's language.",
    "It shows the same observation. It is not a second explanation and not a finished Idea.",
    "Do not use a brand, an industry, or a belief system.",
    "Write in the same language as the Territory.",
    ...(refused.length > 0 ? ["Do not return any of these examples:", ...refused] : []),
    'Return JSON only: {"example":"..."}',
    "",
    "Territory:",
    input.territory.trim(),
    "Angle:",
    input.statement.trim(),
  ].join("\n");
}

export function parseAngleExampleScript(script: string | null): string {
  if (!script?.trim()) return "";
  const parsed = parseModelJson(script);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return "";
  const example = (parsed as { example?: unknown }).example;
  return typeof example === "string" ? example.trim() : "";
}

/** A replacement is offered only when this sibling judgment already scores that code as AUDIT_PASS. */
export function angleReplacementPasses(set: AngleSetFacts | null, code: string): boolean {
  if (!set) return false;
  return scoreAngleAudit({ codes: [code], siblingSet: set, siblingSetCurrent: true })[0]?.verdict === "AUDIT_PASS";
}

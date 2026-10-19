import { parseModelJson } from "@/thinking-lab/shared/ai";
import { fixScopeLines, openMistakeLines, type FixScope } from "@/thinking-lab/shared/fixScope";
import { ANCESTOR_STAKE_RULES, ancestorStakeBlock, type AncestorStake } from "@/thinking-lab/shared/ancestorStake";
import { parseGeneratedIdeaDrafts, type IdeaDraft } from "@/thinking-lab/idea/generate";
import { scoreIdeaAudit } from "@/thinking-lab/idea/setAudit";
import type { IdeaSetFacts } from "@/thinking-lab/idea/setAudit";

export function buildIdeaFixOptionsPrompt(input: {
  parentStatement: string;
  masterSubject?: string;
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
    "Propose one replacement Idea for the failed Idea under the direct Angle.",
    "Write the statement and every key in the same language as the Angle.",
    "When the Angle is not English, do not write the statement or the keys in English.",
    "The replacement is a concrete mechanism that makes the Angle happen, become visible, or be proved, through a demonstration, an experiment, a comparison, or a situation.",
    "Write one sentence in the Angle's language. Name what is made, invited, shown, or created, then what that makes true. It proves the Angle and does not explain the Big Thought in words.",
    "Keep what becomes true in the sentence so the mechanism can be understood.",
    "Do not announce that result with menunjukkan bahwa, membuktikan bahwa, menyoroti bahwa, shows that, proves that, or highlights that.",
    "Do not write a plot. Do not use namun, tiba-tiba, lalu, or kita mengamati bagaimana.",
    "Do not put the keys in that sentence.",
    "Write subject as at most six words in the Angle's language. It names this mechanism and keeps its meaning.",
    "Write the keys separately. Each key is two short clauses, at most twelve words each: the other explanation a viewer might reach, and how this Idea closes it.",
    "Do not write that this shows, proves, or highlights a conclusion inside a key.",
    `Master Thought subject: ${input.masterSubject?.trim() || "(not sealed)"}`,
    "Do not write a finished story, a lesson, a chart, or any other pillar. A pillar is chosen later.",
    "Do not repeat a keeper or the failed Idea.",
    ...ANCESTOR_STAKE_RULES,
    "Use the conflict notes to leave the failed mechanism.",
    "Read the earlier failures. Do not return a sentence listed there. A new sentence that fails for the same reason is still that mistake.",
    ...fixScopeLines(input.scope ?? { preserve: [], repair: [] }),
    ...(input.scope?.preserve.includes("causeLock")
      ? ["The cause lock already passed. Keep those mechanism keys."]
      : []),
    "Do not use examples from any specific industry, belief system, or brand.",
    "Return JSON only: {\"ideas\":[{\"subject\":\"...\",\"statement\":\"...\",\"keys\":[{\"otherExplanation\":\"...\",\"close\":\"...\"}]}]}",
    "",
    "Direct Angle:",
    input.parentStatement.trim(),
    ...ancestorStakeBlock(input.ancestors),
    "",
    "Failed Idea:",
    `${input.failed.code}: ${input.failed.statement}`,
    "",
    "Ideas that already passed and must stay distinct:",
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

export function parseIdeaFixOptions(raw: unknown): string[] {
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

export function parseIdeaFixDrafts(raw: unknown): IdeaDraft[] {
  if (raw && typeof raw === "object" && !Array.isArray(raw) && Array.isArray((raw as { ideas?: unknown }).ideas)) {
    return parseGeneratedIdeaDrafts(raw).slice(0, 3);
  }
  return parseIdeaFixOptions(raw).map((statement) => ({ subject: "", statement, mechanismKeys: [] }));
}

export function parseIdeaFixDraftScript(script: string | null): IdeaDraft[] {
  if (!script?.trim()) return [];
  return parseIdeaFixDrafts(parseModelJson(script));
}

export function parseIdeaFixOptionsScript(script: string | null): string[] {
  if (!script?.trim()) return [];
  return parseIdeaFixOptions(parseModelJson(script));
}

/** A replacement is offered only when this sibling judgment already scores that code as AUDIT_PASS. */
export function ideaReplacementPasses(set: IdeaSetFacts | null, code: string): boolean {
  if (!set) return false;
  return scoreIdeaAudit({ codes: [code], siblingSet: set, siblingSetCurrent: true })[0]?.verdict === "AUDIT_PASS";
}

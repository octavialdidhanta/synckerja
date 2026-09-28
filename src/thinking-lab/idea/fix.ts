import { parseModelJson } from "@/thinking-lab/shared/ai";
import { ANCESTOR_STAKE_RULES, ancestorStakeBlock, type AncestorStake } from "@/thinking-lab/shared/ancestorStake";
import { scoreIdeaAudit } from "@/thinking-lab/idea/setAudit";
import type { IdeaSetFacts } from "@/thinking-lab/idea/setAudit";

export function buildIdeaFixOptionsPrompt(input: {
  parentStatement: string;
  masterSubject?: string;
  ancestors?: AncestorStake[];
  failed: { code: string; statement: string };
  keepers: Array<{ code: string; statement: string }>;
  conflicts: string[];
}): string {
  const keeperLines =
    input.keepers.length === 0 ? "(none)" : input.keepers.map((row) => `${row.code}: ${row.statement}`).join("\n");
  const conflictLines = input.conflicts.length === 0 ? "(none)" : input.conflicts.join("\n");
  return [
    "Write up to three replacement Ideas for one failed Idea under the direct Angle.",
    "Each replacement creates a situation in which the Angle happens, and closes other explanations so the named Master Thought subject is the plausible cause.",
    `Master Thought subject: ${input.masterSubject?.trim() || "(not sealed)"}`,
    "Do not verbally explain the Big Thought. Do not write a production form.",
    "A viewer who sees only the situation should be able to climb to this Angle, then the Big Thought, then the Master Thought.",
    "Do not repeat a keeper or the failed Idea.",
    ...ANCESTOR_STAKE_RULES,
    "Use the conflict notes to leave the failed situation.",
    "Write in the same language as the Angle.",
    "Do not use examples from any specific industry, belief system, or brand.",
    "Return JSON only: {\"statements\":[\"...\"]}",
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

export function parseIdeaFixOptionsScript(script: string | null): string[] {
  if (!script?.trim()) return [];
  return parseIdeaFixOptions(parseModelJson(script));
}

/** A replacement is offered only when this sibling judgment already scores that code as AUDIT_PASS. */
export function ideaReplacementPasses(set: IdeaSetFacts | null, code: string): boolean {
  if (!set) return false;
  return scoreIdeaAudit({ codes: [code], siblingSet: set, siblingSetCurrent: true })[0]?.verdict === "AUDIT_PASS";
}

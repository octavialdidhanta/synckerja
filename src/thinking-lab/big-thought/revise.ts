// Revise: rewrite the same Big Thought card from its failed check, keeping the checks it already passed.
// Relative imports only: the MCP server loads this file.
import { parseModelJson } from "../shared/parseModelJson";
import { BECAUSE_RESULT_LINES } from "./because";
import { parseGeneratedBigThoughts } from "./generate";
import { BIG_THOUGHT_REVISION_CAP, type BigThoughtAuditLesson } from "./record";
import type { PassGateCheck } from "./checklist";

export function buildBigThoughtRevisionPrompt(input: {
  parentStatement: string;
  statement: string;
  checks: readonly PassGateCheck[];
  peers: ReadonlyArray<{ code: string; statement: string }>;
  lessons: readonly BigThoughtAuditLesson[];
  revision: number;
}): string {
  const failed = input.checks.filter((check) => check.state === "fail");
  const passed = input.checks.filter((check) => check.state === "pass");
  const list = (rows: readonly PassGateCheck[]) =>
    rows.length ? rows.map((row) => `${row.id}${row.reason ? `: ${row.reason}` : ""}`).join("\n") : "(none)";
  const peers = input.peers.length ? input.peers.map((row) => `${row.code}: ${row.statement}`).join("\n") : "(none)";
  const lessons = input.lessons.length
    ? input.lessons.map((lesson) => `${lesson.statement}\nWhy it failed: ${lesson.reason}`).join("\n")
    : "(none)";
  return [
    "Repair this same Big Thought. Do not add another card.",
    "The sentence is one because-clause in the same language as the Master Thought: inserting the word because between the Master Thought and it must already make one sentence.",
    "It is a distinct material reason, basis, or evidence for why the Master Thought is true. It is not a method, an outcome, an example, a restatement, or an unpacking of the Master Thought.",
    ...BECAUSE_RESULT_LINES,
    "Change only what the failed checks need. Keep every passed check true. When the failed check says the sentence is not a reason at all, write a different reason.",
    "Carry a basic reason different from every other Big Thought listed below.",
    "Do not return a sentence from the earlier failures, and do not repeat their mistake.",
    "Do not use examples from any specific industry, belief system, or brand.",
    'Return JSON only: {"items":[{"label":"semantic name","statement":"..."}]}',
    `This is repair ${input.revision} of ${BIG_THOUGHT_REVISION_CAP} on the same card.`,
    "",
    "Master Thought:",
    input.parentStatement.trim(),
    "",
    "Big Thought on this card:",
    input.statement.trim(),
    "",
    "Passed checks that must stay true:",
    list(passed),
    "",
    "Failed checks to repair:",
    list(failed),
    "",
    "Other Big Thoughts of this Master Thought:",
    peers,
    "",
    "Earlier failures:",
    lessons,
  ].join("\n");
}

/** The rewritten because-clause, or null when the reply has none or repeats the current sentence. */
export function parseBigThoughtRevision(script: string | null, parentStatement: string, current: string): string | null {
  if (!script?.trim()) return null;
  const statement = parseGeneratedBigThoughts(parseModelJson(script), parentStatement)[0]?.statement.trim() ?? "";
  if (!statement || statement.toLocaleLowerCase() === current.trim().toLocaleLowerCase()) return null;
  return statement;
}

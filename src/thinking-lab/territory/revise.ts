// Revise: rewrite the same Territory card from its failed check, keeping the checks it already passed.
// Relative imports only: the MCP server loads this file.
import { parseModelJson } from "../shared/parseModelJson";
import { ANCESTOR_STAKE_RULES, ancestorStakeBlock, type AncestorStake } from "../shared/ancestorStake";
import { territoryLinkInstruction } from "./link";
import { TERRITORY_STAKE_LINES, territoryPassLines } from "./semantic";
import { TERRITORY_REVISION_CAP, type TerritoryAuditLesson } from "./record";
import type { TerritoryPassCheck, TerritoryPeer } from "./passChecklist";

export function buildTerritoryRevisionPrompt(input: {
  bigThought: string;
  ancestors?: AncestorStake[];
  audience?: string;
  answeredQuestion?: string;
  statement: string;
  checks: readonly TerritoryPassCheck[];
  peers: readonly TerritoryPeer[];
  lessons: readonly TerritoryAuditLesson[];
  revision: number;
}): string {
  const failed = input.checks.filter((check) => check.state === "fail");
  const passed = input.checks.filter((check) => check.state === "pass");
  const list = (rows: readonly TerritoryPassCheck[]) =>
    rows.length ? rows.map((row) => `${row.id}${row.reason ? `: ${row.reason}` : ""}`).join("\n") : "(none)";
  const peers = input.peers.length ? input.peers.map((row) => `${row.code}: ${row.statement}`).join("\n") : "(none)";
  const lessons = input.lessons.length
    ? input.lessons.map((lesson) => `${lesson.statement}\nWhy it failed: ${lesson.reason}`).join("\n")
    : "(none)";
  return [
    "Repair this same Territory. Do not write a different card and do not add another card.",
    "A Territory is a noun or noun phrase naming an audience area, without a claim, that can hold several different observations.",
    territoryLinkInstruction(
      input.answeredQuestion ?? "",
      [input.bigThought, ...(input.ancestors ?? []).map((item) => item.statement)].join(" "),
    ),
    ...territoryPassLines(input.audience),
    "Change only what the failed checks need. Keep every passed check true.",
    "Stay a different area from the other Territories listed below, and do not sit inside one of them.",
    "Do not restate the Big Thought.",
    ...ANCESTOR_STAKE_RULES,
    ...TERRITORY_STAKE_LINES,
    "Do not return a name from the earlier failures, and do not repeat their mistake.",
    "Write in the same language as the Big Thought.",
    "Do not use examples from any specific industry, belief system, or brand.",
    'Return JSON only: {"statement":"..."}',
    `This is repair ${input.revision} of ${TERRITORY_REVISION_CAP} on the same card.`,
    "",
    "Direct Big Thought:",
    input.bigThought.trim(),
    ...ancestorStakeBlock(input.ancestors),
    "",
    "Territory on this card:",
    input.statement.trim(),
    "",
    "Passed checks that must stay true:",
    list(passed),
    "",
    "Failed checks to repair:",
    list(failed),
    "",
    "Other Territories of this Big Thought:",
    peers,
    "",
    "Earlier failures:",
    lessons,
  ].join("\n");
}

/** The rewritten name, or null when the reply has none or repeats the current name. */
export function parseTerritoryRevision(script: string | null, current: string): string | null {
  if (!script?.trim()) return null;
  const parsed = parseModelJson(script);
  const raw =
    parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as { statement?: unknown; statements?: unknown }).statement ??
        (Array.isArray((parsed as { statements?: unknown }).statements)
          ? ((parsed as { statements: unknown[] }).statements[0] as unknown)
          : undefined)
      : undefined;
  const statement = typeof raw === "string" ? raw.replace(/\s+/g, " ").trim() : "";
  if (!statement || statement.toLowerCase() === current.trim().toLowerCase()) return null;
  return statement;
}

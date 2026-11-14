// Revise: rewrite the same Angle card from its failed check, keeping the checks it already passed.
// Relative imports only: the MCP server loads this file.
import { parseModelJson } from "../shared/parseModelJson";
import { ANCESTOR_STAKE_RULES, ancestorStakeBlock, type AncestorStake } from "../shared/ancestorStake";
import { ANGLE_REVISION_CAP, type AngleAuditLesson } from "./record";
import type { AnglePassCheck, AnglePeer } from "./passChecklist";

export type AngleRevision = { statement: string; subject: string; example: string };

export function buildAngleRevisionPrompt(input: {
  territory: string;
  ancestors?: AncestorStake[];
  card: AngleRevision;
  checks: readonly AnglePassCheck[];
  peers: readonly AnglePeer[];
  lessons: readonly AngleAuditLesson[];
  revision: number;
}): string {
  const failed = input.checks.filter((check) => check.state === "fail");
  const passed = input.checks.filter((check) => check.state === "pass");
  const list = (rows: readonly AnglePassCheck[]) =>
    rows.length ? rows.map((row) => `${row.id}${row.reason ? `: ${row.reason}` : ""}`).join("\n") : "(none)";
  const peers = input.peers.length ? input.peers.map((row) => `${row.code}: ${row.statement}`).join("\n") : "(none)";
  const lessons = input.lessons.length
    ? input.lessons.map((lesson) => `${lesson.statement}\nWhy it failed: ${lesson.reason}`).join("\n")
    : "(none)";
  return [
    "Repair this same Angle. Do not write a different Angle and do not add another card.",
    "An Angle is one observation inside the Territory: something rarely noticed, a contradiction, or a tension. It is not a because-clause.",
    "Change only what the failed checks need. Keep every passed check true.",
    "Stay a different observation from the other Angles listed below.",
    ...ANCESTOR_STAKE_RULES,
    "Do not return a sentence from the earlier failures, and do not repeat their mistake.",
    "subject: a noun phrase of one to six words that carries this observation's rarely noticed fact. Do not name the place or use the Territory's name.",
    "example: one concrete situation a person could point at that shows this observation. It is not a second explanation and not a finished Idea.",
    "The statement stays the observation. Do not place the example inside the statement.",
    "Do not use a brand, an industry, or a belief system.",
    "Write in the same language as the Territory.",
    'Return JSON only: {"statement":"...","subject":"...","example":"..."}',
    `This is repair ${input.revision} of ${ANGLE_REVISION_CAP} on the same card.`,
    "",
    "Direct Territory:",
    input.territory.trim(),
    ...ancestorStakeBlock(input.ancestors),
    "",
    "Angle on this card:",
    input.card.statement.trim(),
    `Subject: ${input.card.subject.trim() || "(none)"}`,
    `Example: ${input.card.example.trim() || "(none)"}`,
    "",
    "Passed checks that must stay true:",
    list(passed),
    "",
    "Failed checks to repair:",
    list(failed),
    "",
    "Other Angles of this Territory:",
    peers,
    "",
    "Earlier failures:",
    lessons,
  ].join("\n");
}

/** The rewritten card, or null when the reply has no statement. A missing subject or example keeps the old one. */
export function parseAngleRevision(script: string | null, card: AngleRevision): AngleRevision | null {
  if (!script?.trim()) return null;
  const parsed = parseModelJson(script);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const row = parsed as { statement?: unknown; subject?: unknown; example?: unknown };
  const text = (value: unknown) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "");
  const statement = text(row.statement);
  if (!statement) return null;
  return { statement, subject: text(row.subject) || card.subject, example: text(row.example) || card.example };
}

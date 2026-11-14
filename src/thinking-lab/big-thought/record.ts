// What a Master Thought stores about its Big Thoughts (thinking_lab_master_thoughts.last_audit). The shape and
// the helpers are shared with the other levels (shared/cardSetRecord.ts); this file names them for Big Thought.
// The schema name stays "thinking-lab/v1", so items stored before the per-card checks still count.
// Relative imports only: the MCP server loads this file.
import { readBigThoughtCheckId, type BigThoughtCheckId } from "./checklist";
import {
  CARD_REVISION_CAP,
  canReviseCard,
  cardVerdict,
  emptyCardSetRecord,
  mergeCardLessons,
  readCardSetRecord,
  withCardResult,
  withCardRevision,
  withoutCard,
  type CardAuditItem,
  type CardAuditLesson,
  type CardGateFailure,
  type CardSetRecord,
} from "../shared/cardSetRecord";

const SCHEMA = "thinking-lab/v1";

export type BigThoughtGateFailure = CardGateFailure<BigThoughtCheckId>;
export type BigThoughtAuditItem = CardAuditItem<BigThoughtCheckId>;
export type BigThoughtAuditLesson = CardAuditLesson;
export type BigThoughtSetRecord = CardSetRecord<typeof SCHEMA, BigThoughtCheckId>;

export const BIG_THOUGHT_REVISION_CAP = CARD_REVISION_CAP;

/** Code of the lessons Generate writes for sentences that never got a card. */
export const GENERATE_LESSON_CODE = "NEW";

export const emptyBigThoughtSetRecord = (): BigThoughtSetRecord => emptyCardSetRecord(SCHEMA);
export const mergeBigThoughtLessons = mergeCardLessons;
export const bigThoughtVerdict = cardVerdict;
export const withBigThoughtResult = (
  record: BigThoughtSetRecord,
  input: Parameters<typeof withCardResult<BigThoughtSetRecord, BigThoughtCheckId>>[1],
) => withCardResult<BigThoughtSetRecord, BigThoughtCheckId>(record, input);
export const withoutBigThought = (record: BigThoughtSetRecord, code: string) => withoutCard(record, code);
export const canReviseBigThought = canReviseCard;
export const withBigThoughtRevision = (record: BigThoughtSetRecord, code: string) => withCardRevision(record, code);

/** Lessons Generate already learned: sentences it must not propose again. */
export function generateLessons(record: BigThoughtSetRecord | null | undefined): BigThoughtAuditLesson[] {
  return (record?.auditLessons ?? []).filter((lesson) => lesson.code === GENERATE_LESSON_CODE);
}

function legacyLessons(raw: unknown): BigThoughtAuditLesson[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const row = raw as { fixLessons?: unknown; generateLessons?: unknown };
  const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
  const fix = Array.isArray(row.fixLessons)
    ? row.fixLessons.flatMap((item) => {
        const lesson = (item ?? {}) as { code?: unknown; statement?: unknown; reason?: unknown };
        const code = text(lesson.code);
        const statement = text(lesson.statement);
        const reason = text(lesson.reason);
        return code && statement && reason ? [{ code, statement, reason }] : [];
      })
    : [];
  const generate = Array.isArray(row.generateLessons)
    ? row.generateLessons.flatMap((item) => {
        const lesson = (item ?? {}) as { gate?: unknown; statement?: unknown; reason?: unknown };
        const gate = readBigThoughtCheckId(lesson.gate);
        const statement = text(lesson.statement);
        const reason = text(lesson.reason);
        return gate && statement && reason ? [{ code: GENERATE_LESSON_CODE, statement, reason: `${gate}: ${reason}` }] : [];
      })
    : [];
  return [...fix, ...generate];
}

/**
 * Reads a stored record. A record written before the per-card checks keeps its items; its fix and Generate
 * lessons become lessons, and the set-wide sibling judgment (siblingSet, semanticExclusions) is dropped.
 */
export function readBigThoughtSetRecord(raw: unknown): BigThoughtSetRecord {
  const record = readCardSetRecord(raw, SCHEMA, readBigThoughtCheckId);
  const legacy = legacyLessons(raw);
  return legacy.length ? { ...record, auditLessons: mergeCardLessons(record.auditLessons, legacy) } : record;
}

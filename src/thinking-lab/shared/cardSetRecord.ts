// What a parent row stores about its child cards (a Territory's angle_set, a Big Thought's territory_set):
// the pass or fail of each card's current sentence, the sentences that already failed, and how many
// times each card was revised. Each level keeps its own schema name and check ids.
// Relative imports only: the MCP server loads this file.
import type { AuditVerdict } from "./verdict";

export type CardGateFailure<Gate extends string> = {
  gate: Gate;
  reason: string;
};

export type CardAuditItem<Gate extends string> = {
  code: string;
  verdict: AuditVerdict;
  statementFingerprint?: string;
  gateFailure?: CardGateFailure<Gate>;
  /** Pass checks switched OFF when this item was saved: shown as "Tanpa cek". */
  skipped?: string[];
  /** An ancestor was rewritten after this item passed: shown as "Induk berubah". */
  parentChanged?: true;
};

/** A sentence that failed a check. Generate and Revise must not write it again. */
export type CardAuditLesson = {
  code: string;
  statement: string;
  reason: string;
};

export type CardSetRecord<Schema extends string, Gate extends string> = {
  schema: Schema;
  audit: { fingerprint: string; items: CardAuditItem<Gate>[] } | null;
  auditLessons: CardAuditLesson[];
  /** Revise clicks used per card, by upper-case code. */
  revisions: Record<string, number>;
};

/** Revise rewrites one card at most this many times. */
export const CARD_REVISION_CAP = 3;

const AUDIT_VERDICTS = new Set<AuditVerdict>(["AUDIT_PASS", "AUDIT_FAIL", "UNRESOLVED", "STALE"]);

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

const sameCode = (left: string, right: string) => left.toUpperCase() === right.toUpperCase();

export function mergeCardLessons(existing: CardAuditLesson[], next: CardAuditLesson[]): CardAuditLesson[] {
  const seen = new Set(existing.map((lesson) => `${lesson.statement}\n${lesson.reason}`));
  const merged = [...existing];
  for (const lesson of next) {
    const key = `${lesson.statement}\n${lesson.reason}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(lesson);
  }
  return merged;
}

/**
 * The verdict of one card's current sentence: locked rows pass, a stored item counts only for the sentence
 * it was saved for, anything else is not checked yet (null).
 */
export function cardVerdict(
  row: { code: string; status?: string },
  record: { audit: { items: Array<{ code: string; verdict: AuditVerdict; statementFingerprint?: string }> } | null } | null | undefined,
  statementFingerprint: string,
): "AUDIT_PASS" | "AUDIT_FAIL" | null {
  if (row.status === "locked") return "AUDIT_PASS";
  const stored = record?.audit?.items.find((item) => sameCode(item.code, row.code));
  if (!stored || !statementFingerprint || stored.statementFingerprint !== statementFingerprint) return null;
  return stored.verdict === "AUDIT_PASS" || stored.verdict === "AUDIT_FAIL" ? stored.verdict : null;
}

/** Stores the result of one card's checks, replacing its earlier item. A fail also becomes a lesson. */
export function withCardResult<R extends CardSetRecord<string, Gate>, Gate extends string>(
  record: R,
  input: {
    code: string;
    statement: string;
    statementFingerprint: string;
    failure: CardGateFailure<Gate> | null;
    skipped?: readonly string[];
  },
): R {
  const item: CardAuditItem<Gate> = input.failure
    ? { code: input.code, verdict: "AUDIT_FAIL", statementFingerprint: input.statementFingerprint, gateFailure: input.failure }
    : {
        code: input.code,
        verdict: "AUDIT_PASS",
        statementFingerprint: input.statementFingerprint,
        ...(input.skipped?.length ? { skipped: [...input.skipped] } : {}),
      };
  return {
    ...record,
    audit: {
      fingerprint: record.audit?.fingerprint ?? "",
      items: [...(record.audit?.items ?? []).filter((entry) => !sameCode(entry.code, input.code)), item],
    },
    auditLessons: input.failure
      ? mergeCardLessons(record.auditLessons, [
          { code: input.code, statement: input.statement.trim(), reason: `${input.failure.gate}: ${input.failure.reason}` },
        ])
      : record.auditLessons,
  };
}

/** Drops a deleted card's item and revision count. */
export function withoutCard<R extends CardSetRecord<string, string>>(record: R, code: string): R {
  const revisions = { ...record.revisions };
  delete revisions[code.toUpperCase()];
  return {
    ...record,
    audit: record.audit ? { ...record.audit, items: record.audit.items.filter((item) => !sameCode(item.code, code)) } : null,
    revisions,
  };
}

export function cardRevisionsUsed(record: { revisions: Record<string, number> } | null | undefined, code: string): number {
  return record?.revisions[code.toUpperCase()] ?? 0;
}

export function canReviseCard(record: { revisions: Record<string, number> } | null | undefined, code: string): boolean {
  return cardRevisionsUsed(record, code) < CARD_REVISION_CAP;
}

export function withCardRevision<R extends CardSetRecord<string, string>>(record: R, code: string): R {
  return { ...record, revisions: { ...record.revisions, [code.toUpperCase()]: cardRevisionsUsed(record, code) + 1 } };
}

export function readCardGateFailure<Gate extends string>(
  value: unknown,
  readGate: (value: unknown) => Gate | null,
): CardGateFailure<Gate> | null {
  if (!isObject(value)) return null;
  const gate = readGate(asText(value.gate));
  const reason = asText(value.reason);
  if (!gate || !reason) return null;
  return { gate, reason };
}

function readItems<Gate extends string>(value: unknown, readGate: (value: unknown) => Gate | null): CardAuditItem<Gate>[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!isObject(entry)) return [];
    const code = asText(entry.code);
    const verdict =
      typeof entry.verdict === "string" && AUDIT_VERDICTS.has(entry.verdict as AuditVerdict) ? (entry.verdict as AuditVerdict) : null;
    if (!code || !verdict) return [];
    const statementFingerprint = asText(entry.statementFingerprint);
    const gateFailure = readCardGateFailure(entry.gateFailure, readGate);
    const skipped = Array.isArray(entry.skipped) ? entry.skipped.filter((id): id is string => typeof id === "string") : [];
    return [
      {
        code,
        verdict,
        ...(statementFingerprint ? { statementFingerprint } : {}),
        ...(gateFailure ? { gateFailure } : {}),
        ...(skipped.length ? { skipped } : {}),
        ...(entry.parentChanged === true ? { parentChanged: true as const } : {}),
      },
    ];
  });
}

function readLessons(value: unknown): CardAuditLesson[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((lesson) => {
    if (!isObject(lesson)) return [];
    const code = asText(lesson.code);
    const statement = asText(lesson.statement);
    const reason = asText(lesson.reason);
    return code && statement && reason ? [{ code, statement, reason }] : [];
  });
}

function readRevisions(value: unknown): Record<string, number> {
  if (!isObject(value)) return {};
  const out: Record<string, number> = {};
  for (const [code, count] of Object.entries(value)) {
    if (typeof count === "number" && Number.isFinite(count) && count > 0) out[code.toUpperCase()] = Math.floor(count);
  }
  return out;
}

export function emptyCardSetRecord<Schema extends string, Gate extends string>(schema: Schema): CardSetRecord<Schema, Gate> {
  return { schema, audit: null, auditLessons: [], revisions: {} };
}

/**
 * Reads a stored record of this schema; anything else reads as empty. Fields of the earlier set-wide
 * sibling audit (siblingSet, repairCount) are dropped.
 */
export function readCardSetRecord<Schema extends string, Gate extends string>(
  raw: unknown,
  schema: Schema,
  readGate: (value: unknown) => Gate | null,
): CardSetRecord<Schema, Gate> {
  if (!isObject(raw) || raw.schema !== schema) return emptyCardSetRecord(schema);
  const audit = isObject(raw.audit)
    ? { fingerprint: asText(raw.audit.fingerprint), items: readItems(raw.audit.items, readGate) }
    : null;
  return { schema, audit, auditLessons: readLessons(raw.auditLessons), revisions: readRevisions(raw.revisions) };
}

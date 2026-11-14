// What a Territory stores about its Angles (thinking_lab_territories.angle_set): the pass or fail of each
// Angle's current sentence, the sentences that already failed, and how many times each card was revised.
// Relative imports only: the MCP server loads this file.
import { readAngleCheckId, type AnglePassCheckId } from "./passChecklist";
import type { AuditVerdict } from "../shared/verdict";

export type AngleGateFailure = {
  gate: AnglePassCheckId;
  reason: string;
};

export type AngleAuditItem = {
  code: string;
  verdict: AuditVerdict;
  statementFingerprint?: string;
  gateFailure?: AngleGateFailure;
  /** Pass checks switched OFF when this item was saved: shown as "Tanpa cek". */
  skipped?: string[];
  /** An ancestor was rewritten after this item passed: shown as "Induk berubah". */
  parentChanged?: true;
};

/** A sentence that failed a check. Generate and Revise must not write it again. */
export type AngleAuditLesson = {
  code: string;
  statement: string;
  reason: string;
};

export type AngleSetRecord = {
  schema: "thinking-lab/angle-set/v1";
  audit: { fingerprint: string; items: AngleAuditItem[] } | null;
  auditLessons: AngleAuditLesson[];
  /** Revise clicks used per card, by upper-case code. */
  revisions: Record<string, number>;
};

/** Revise rewrites one card at most this many times. */
export const ANGLE_REVISION_CAP = 3;

export function emptyAngleSetRecord(): AngleSetRecord {
  return { schema: "thinking-lab/angle-set/v1", audit: null, auditLessons: [], revisions: {} };
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function mergeAngleAuditLessons(existing: AngleAuditLesson[], next: AngleAuditLesson[]): AngleAuditLesson[] {
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
 * The verdict of one Angle's current sentence: locked rows pass, a stored item counts only for the sentence
 * it was saved for, anything else is not checked yet (null).
 */
export function angleVerdict(
  row: { code: string; status?: string },
  record: AngleSetRecord | null | undefined,
  statementFingerprint: string,
): "AUDIT_PASS" | "AUDIT_FAIL" | null {
  if (row.status === "locked") return "AUDIT_PASS";
  const stored = record?.audit?.items.find((item) => item.code.toUpperCase() === row.code.toUpperCase());
  if (!stored || !statementFingerprint || stored.statementFingerprint !== statementFingerprint) return null;
  return stored.verdict === "AUDIT_PASS" || stored.verdict === "AUDIT_FAIL" ? stored.verdict : null;
}

/** Stores the result of one card's checks, replacing its earlier item. A fail also becomes a lesson. */
export function withAngleResult(
  record: AngleSetRecord,
  input: {
    code: string;
    statement: string;
    statementFingerprint: string;
    failure: AngleGateFailure | null;
    skipped?: readonly string[];
  },
): AngleSetRecord {
  const key = input.code.toUpperCase();
  const item: AngleAuditItem = input.failure
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
      items: [...(record.audit?.items ?? []).filter((entry) => entry.code.toUpperCase() !== key), item],
    },
    auditLessons: input.failure
      ? mergeAngleAuditLessons(record.auditLessons, [
          { code: input.code, statement: input.statement.trim(), reason: `${input.failure.gate}: ${input.failure.reason}` },
        ])
      : record.auditLessons,
  };
}

/** Drops a deleted card's item and revision count. */
export function withoutAngle(record: AngleSetRecord, code: string): AngleSetRecord {
  const key = code.toUpperCase();
  const revisions = { ...record.revisions };
  delete revisions[key];
  return {
    ...record,
    audit: record.audit ? { ...record.audit, items: record.audit.items.filter((item) => item.code.toUpperCase() !== key) } : null,
    revisions,
  };
}

export function angleRevisionsUsed(record: AngleSetRecord | null | undefined, code: string): number {
  return record?.revisions[code.toUpperCase()] ?? 0;
}

export function canReviseAngle(record: AngleSetRecord | null | undefined, code: string): boolean {
  return angleRevisionsUsed(record, code) < ANGLE_REVISION_CAP;
}

export function withAngleRevision(record: AngleSetRecord, code: string): AngleSetRecord {
  const key = code.toUpperCase();
  return { ...record, revisions: { ...record.revisions, [key]: angleRevisionsUsed(record, code) + 1 } };
}

const AUDIT_VERDICTS = new Set<AuditVerdict>(["AUDIT_PASS", "AUDIT_FAIL", "UNRESOLVED", "STALE"]);

export function readAngleGateFailure(value: unknown): AngleGateFailure | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as { gate?: unknown; reason?: unknown };
  const gate = readAngleCheckId(asText(row.gate));
  const reason = asText(row.reason);
  if (!gate || !reason) return null;
  return { gate, reason };
}

function readAngleAuditItems(value: unknown): AngleAuditItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const row = entry as {
      code?: unknown;
      verdict?: unknown;
      statementFingerprint?: unknown;
      gateFailure?: unknown;
      skipped?: unknown;
      parentChanged?: unknown;
    };
    const code = asText(row.code);
    const verdict =
      typeof row.verdict === "string" && AUDIT_VERDICTS.has(row.verdict as AuditVerdict) ? (row.verdict as AuditVerdict) : null;
    if (!code || !verdict) return [];
    const statementFingerprint = asText(row.statementFingerprint);
    const gateFailure = readAngleGateFailure(row.gateFailure);
    const skipped = Array.isArray(row.skipped) ? row.skipped.filter((id): id is string => typeof id === "string") : [];
    return [
      {
        code,
        verdict,
        ...(statementFingerprint ? { statementFingerprint } : {}),
        ...(gateFailure ? { gateFailure } : {}),
        ...(skipped.length ? { skipped } : {}),
        ...(row.parentChanged === true ? { parentChanged: true as const } : {}),
      },
    ];
  });
}

function readRevisions(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, number> = {};
  for (const [code, count] of Object.entries(value as Record<string, unknown>)) {
    if (typeof count === "number" && Number.isFinite(count) && count > 0) out[code.toUpperCase()] = Math.floor(count);
  }
  return out;
}

/** Reads a stored record. Fields of the earlier sibling audit (siblingSet, repairCount) are dropped. */
export function readAngleSetRecord(raw: unknown): AngleSetRecord {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return emptyAngleSetRecord();
  const row = raw as Record<string, unknown>;
  if (row.schema !== "thinking-lab/angle-set/v1") return emptyAngleSetRecord();
  const auditRaw = row.audit;
  const audit =
    auditRaw && typeof auditRaw === "object" && !Array.isArray(auditRaw)
      ? {
          fingerprint: asText((auditRaw as { fingerprint?: unknown }).fingerprint),
          items: readAngleAuditItems((auditRaw as { items?: unknown }).items),
        }
      : null;
  const auditLessons = Array.isArray(row.auditLessons)
    ? row.auditLessons.flatMap((lesson) => {
        if (!lesson || typeof lesson !== "object" || Array.isArray(lesson)) return [];
        const item = lesson as { code?: unknown; statement?: unknown; reason?: unknown };
        const code = asText(item.code);
        const statement = asText(item.statement);
        const reason = asText(item.reason);
        if (!code || !statement || !reason) return [];
        return [{ code, statement, reason }];
      })
    : [];
  return { schema: "thinking-lab/angle-set/v1", audit, auditLessons, revisions: readRevisions(row.revisions) };
}

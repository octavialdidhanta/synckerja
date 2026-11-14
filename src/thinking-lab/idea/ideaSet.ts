// What an Angle stores about its Ideas (thinking_lab_angles.idea_set): the situation chosen before
// Generate, and the pass mark each open Idea carries into Lock. Relative imports only: the MCP server loads this file.
import type { AuditVerdict } from "../shared/verdict";

export type IdeaAuditItem = {
  code: string;
  verdict: AuditVerdict;
  statementFingerprint?: string;
  /** Checks switched OFF when this item was saved: shown as "Tanpa cek". */
  skipped?: string[];
  /** An ancestor was rewritten after this item passed: shown as "Induk berubah". */
  parentChanged?: true;
};

export type IdeaDecision = {
  category: string;
  question: string;
  answer: string;
};

export type IdeaDiscovery = {
  angleFingerprint: string;
  decisions: IdeaDecision[];
};

export type IdeaSetRecord = {
  schema: "thinking-lab/idea-set/v1";
  audit: { fingerprint: string; items: IdeaAuditItem[] } | null;
  discovery: IdeaDiscovery | null;
};

export function emptyIdeaSetRecord(): IdeaSetRecord {
  return { schema: "thinking-lab/idea-set/v1", audit: null, discovery: null };
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function clip(value: unknown, limit: number): string {
  const text = asText(value).replace(/\s+/g, " ");
  return text && text.length <= limit ? text : "";
}

function readIdeaDiscovery(value: unknown): IdeaDiscovery | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const angleFingerprint = asText(row.angleFingerprint);
  if (!angleFingerprint || !Array.isArray(row.decisions)) return null;
  const decisions: IdeaDecision[] = [];
  for (const item of row.decisions) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const decision = item as Record<string, unknown>;
    const category = clip(decision.category, 80);
    const question = clip(decision.question, 240);
    const answer = clip(decision.answer, 160);
    if (!category || !question || !answer) continue;
    decisions.push({ category, question, answer });
    if (decisions.length === 3) break;
  }
  if (row.decisions.length > 0 && decisions.length === 0) return null;
  return { angleFingerprint, decisions };
}

const AUDIT_VERDICTS = new Set<AuditVerdict>(["AUDIT_PASS", "AUDIT_FAIL", "UNRESOLVED", "STALE"]);

function readIdeaAuditItems(value: unknown): IdeaAuditItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const row = entry as { code?: unknown; verdict?: unknown; statementFingerprint?: unknown; skipped?: unknown; parentChanged?: unknown };
    const code = asText(row.code);
    const verdict = typeof row.verdict === "string" && AUDIT_VERDICTS.has(row.verdict as AuditVerdict) ? (row.verdict as AuditVerdict) : null;
    if (!code || !verdict) return [];
    const statementFingerprint = asText(row.statementFingerprint);
    const skipped = Array.isArray(row.skipped) ? row.skipped.filter((id): id is string => typeof id === "string") : [];
    return [
      {
        code,
        verdict,
        ...(statementFingerprint ? { statementFingerprint } : {}),
        ...(skipped.length ? { skipped } : {}),
        ...(row.parentChanged === true ? { parentChanged: true as const } : {}),
      },
    ];
  });
}

/** A stored record. Older records carry sibling-audit fields; only these are read. */
export function readIdeaSetRecord(raw: unknown): IdeaSetRecord {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return emptyIdeaSetRecord();
  const row = raw as Record<string, unknown>;
  if (row.schema !== "thinking-lab/idea-set/v1") return emptyIdeaSetRecord();
  const auditRaw = row.audit;
  const audit =
    auditRaw && typeof auditRaw === "object" && !Array.isArray(auditRaw)
      ? {
          fingerprint: asText((auditRaw as { fingerprint?: unknown }).fingerprint),
          items: readIdeaAuditItems((auditRaw as { items?: unknown }).items),
        }
      : null;
  return { schema: "thinking-lab/idea-set/v1", audit, discovery: readIdeaDiscovery(row.discovery) };
}

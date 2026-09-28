import { parseModelJson } from "@/thinking-lab/shared/ai";
import { fingerprintsMatch } from "@/thinking-lab/shared/fingerprint";
import type { AuditVerdict } from "@/thinking-lab/shared/verdict";
import type { IdeaDownTopItem } from "@/thinking-lab/idea/downTop";

export type IdeaTriState = true | false | "unresolved";
export type IdeaResolution = "RESOLVED" | "UNRESOLVED";

export type IdeaPair = {
  ideaCodeA: string;
  ideaCodeB: string;
  explanation: string;
};

export type IdeaContainment = {
  containerCode: string;
  containedCode: string;
  explanation: string;
};

export type IdeaSetFacts = {
  fingerprint: string;
  coreDistinct: IdeaTriState;
  materialOverlapPairs: IdeaPair[];
  containmentPairs: IdeaContainment[];
  resolution: IdeaResolution;
  unresolvedReasons: string[];
  confidence?: number;
};

export type IdeaAuditItem = {
  code: string;
  verdict: AuditVerdict;
  statementFingerprint?: string;
};

export type IdeaSetRecord = {
  schema: "thinking-lab/idea-set/v1";
  repairCount: number;
  siblingSet: IdeaSetFacts | null;
  audit: { fingerprint: string; items: IdeaAuditItem[] } | null;
  downTop: { fingerprint: string; items: IdeaDownTopItem[] } | null;
};

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function repairCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function asReasons(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((row) => asText(row)).filter(Boolean);
}

function asTriState(value: unknown): IdeaTriState | null {
  if (value === true || value === false) return value;
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  if (normalized === "unresolved") return "unresolved";
  return null;
}

function asResolution(value: unknown): IdeaResolution {
  return value === "RESOLVED" || value === "UNRESOLVED" ? value : "UNRESOLVED";
}

function readPairs(value: unknown): IdeaPair[] | null {
  if (!Array.isArray(value)) return null;
  const pairs: IdeaPair[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object" || Array.isArray(row)) return null;
    const item = row as Record<string, unknown>;
    const ideaCodeA = asText(item.ideaCodeA || item.a);
    const ideaCodeB = asText(item.ideaCodeB || item.b);
    const explanation = asText(item.explanation);
    if (!ideaCodeA || !ideaCodeB || !explanation) return null;
    pairs.push({ ideaCodeA, ideaCodeB, explanation });
  }
  return pairs;
}

function readContainment(value: unknown): IdeaContainment[] | null {
  if (!Array.isArray(value)) return null;
  const pairs: IdeaContainment[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object" || Array.isArray(row)) return null;
    const item = row as Record<string, unknown>;
    const containerCode = asText(item.containerCode || item.container);
    const containedCode = asText(item.containedCode || item.contained);
    const explanation = asText(item.explanation);
    if (!containerCode || !containedCode || !explanation) return null;
    pairs.push({ containerCode, containedCode, explanation });
  }
  return pairs;
}

export function emptyIdeaSetRecord(): IdeaSetRecord {
  return { schema: "thinking-lab/idea-set/v1", repairCount: 0, siblingSet: null, audit: null, downTop: null };
}

export function unresolvedIdeaSet(fingerprint: string, reason: string): IdeaSetFacts {
  return {
    fingerprint,
    coreDistinct: "unresolved",
    materialOverlapPairs: [],
    containmentPairs: [],
    resolution: "UNRESOLVED",
    unresolvedReasons: [reason],
  };
}

export function normalizeIdeaSet(raw: unknown, fingerprint: string): IdeaSetFacts {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return unresolvedIdeaSet(fingerprint, "JUDGE_UNPARSEABLE");
  }
  const row = raw as Record<string, unknown>;
  const coreDistinct = asTriState(row.coreDistinct);
  const overlap = readPairs(row.materialOverlapPairs);
  const containment = readContainment(row.containmentPairs);
  if (coreDistinct == null || overlap == null || containment == null) {
    return unresolvedIdeaSet(fingerprint, "JUDGE_UNPARSEABLE");
  }
  const reasons = asReasons(row.unresolvedReasons);
  const hasConflict = overlap.length > 0 || containment.length > 0;
  if (coreDistinct === true && hasConflict) return unresolvedIdeaSet(fingerprint, "CONTRADICTORY_SET_FACTS");
  if (coreDistinct === false && !hasConflict) return unresolvedIdeaSet(fingerprint, "MISSING_CONFLICT_PAIR");
  if (coreDistinct === "unresolved" || reasons.length > 0) {
    return unresolvedIdeaSet(fingerprint, reasons[0] ?? "SET_UNRESOLVED");
  }
  const facts: IdeaSetFacts = {
    fingerprint,
    coreDistinct,
    materialOverlapPairs: overlap,
    containmentPairs: containment,
    resolution: asResolution(row.resolution),
    unresolvedReasons: [],
  };
  if (typeof row.confidence === "number" && Number.isFinite(row.confidence)) facts.confidence = row.confidence;
  if (facts.resolution !== "RESOLVED") return unresolvedIdeaSet(fingerprint, "SET_UNRESOLVED");
  return facts;
}

export function parseIdeaSet(script: string | null, fingerprint: string): IdeaSetFacts {
  if (!script?.trim()) return unresolvedIdeaSet(fingerprint, "JUDGE_UNAVAILABLE");
  return normalizeIdeaSet(parseModelJson(script), fingerprint);
}

/** Fail both sides of an overlap. For containment, fail only the unique smallest set that explains every containing edge. */
export function ideaConflictFailures(set: IdeaSetFacts): Set<string> {
  const failed = new Set<string>();
  for (const pair of set.materialOverlapPairs) {
    failed.add(pair.ideaCodeA.toUpperCase());
    failed.add(pair.ideaCodeB.toUpperCase());
  }
  const open = set.containmentPairs
    .map((pair) => [pair.containerCode.toUpperCase(), pair.containedCode.toUpperCase()] as const)
    .filter(([container, contained]) => !failed.has(container) && !failed.has(contained));
  if (open.length === 0) return failed;
  const nodes = [...new Set(open.flat())];
  let best: string[] | null = null;
  let unique = true;
  const limit = 1 << nodes.length;
  for (let mask = 1; mask < limit; mask += 1) {
    const cover = nodes.filter((_, index) => (mask & (1 << index)) !== 0);
    const coversAll = open.every(([container, contained]) => cover.includes(container) || cover.includes(contained));
    if (!coversAll) continue;
    if (!best || cover.length < best.length) {
      best = cover;
      unique = true;
    } else if (cover.length === best.length && cover.join("\n") !== best.join("\n")) {
      unique = false;
    }
  }
  const chosen = best && unique ? best : nodes;
  for (const code of chosen) failed.add(code);
  return failed;
}

export function scoreIdeaAudit(input: {
  codes: string[];
  siblingSet: IdeaSetFacts | null;
  siblingSetCurrent: boolean;
}): IdeaAuditItem[] {
  const failures = input.siblingSet ? ideaConflictFailures(input.siblingSet) : new Set<string>();
  return input.codes.map((code) => {
    const set = input.siblingSet;
    if (!input.siblingSetCurrent || !set) return { code, verdict: "STALE" };
    if (set.resolution !== "RESOLVED" || set.unresolvedReasons.length > 0 || set.coreDistinct === "unresolved") {
      return { code, verdict: "UNRESOLVED" };
    }
    if (failures.has(code.toUpperCase())) return { code, verdict: "AUDIT_FAIL" };
    if (set.coreDistinct === true || set.coreDistinct === false) return { code, verdict: "AUDIT_PASS" };
    return { code, verdict: "UNRESOLVED" };
  });
}

export function ideaSetIsCurrent(stored: IdeaSetFacts | null, fingerprint: string): boolean {
  if (!stored) return false;
  return fingerprintsMatch(stored.fingerprint, fingerprint);
}

export function buildIdeaSiblingPrompt(input: {
  parentStatement: string;
  rows: Array<{ code: string; statement: string }>;
}): string {
  const lines = input.rows.map((row) => `${row.code}: ${row.statement}`).join("\n");
  return [
    "You are the canonical sibling judge for one Idea set under a direct Angle.",
    "Each Idea was already admitted. Do not reclassify whether an individual Idea is valid.",
    "Decide only whether any two admitted Ideas occupy substantially the same situation, or whether one substantially contains the other.",
    "materialOverlapPairs lists pairs that would create substantially the same situation.",
    "Overlap requires that the audience would enter the same situation in both Ideas. A shared Angle, a shared cause, or a shared result is not overlap.",
    "containmentPairs lists a broader situation and the situation that sits inside it.",
    "coreDistinct is true only when both pair lists are empty.",
    "coreDistinct is false only when at least one pair explains the conflict.",
    "Every pair needs an explanation.",
    "Use exactly the keys ideaCodeA, ideaCodeB, containerCode, and containedCode. Do not rename them.",
    "Do not decide what a viewer would conclude. That belongs to the down-top test.",
    "Mark resolution RESOLVED only when distinctness is fully decided. Otherwise use UNRESOLVED.",
    "Write explanations in the same language as the Angle.",
    "Do not use examples from any specific industry, belief system, or brand.",
    "Return JSON only:",
    JSON.stringify({
      coreDistinct: true,
      materialOverlapPairs: [],
      containmentPairs: [],
      resolution: "RESOLVED",
      unresolvedReasons: [],
      confidence: 0,
    }),
    "",
    "Direct Angle:",
    input.parentStatement.trim(),
    "",
    "Admitted Ideas:",
    lines,
  ].join("\n");
}

export function readIdeaSetRecord(raw: unknown): IdeaSetRecord {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return emptyIdeaSetRecord();
  const row = raw as Record<string, unknown>;
  if (row.schema !== "thinking-lab/idea-set/v1") return emptyIdeaSetRecord();
  const siblingSet =
    row.siblingSet && typeof row.siblingSet === "object" && !Array.isArray(row.siblingSet)
      ? (row.siblingSet as IdeaSetFacts)
      : null;
  const auditRaw = row.audit;
  const audit =
    auditRaw && typeof auditRaw === "object" && !Array.isArray(auditRaw)
      ? {
          fingerprint: asText((auditRaw as { fingerprint?: unknown }).fingerprint),
          items: Array.isArray((auditRaw as { items?: unknown }).items)
            ? ((auditRaw as { items: IdeaAuditItem[] }).items ?? [])
            : [],
        }
      : null;
  const downTopRaw = row.downTop;
  const downTop =
    downTopRaw && typeof downTopRaw === "object" && !Array.isArray(downTopRaw)
      ? {
          fingerprint: asText((downTopRaw as { fingerprint?: unknown }).fingerprint),
          items: Array.isArray((downTopRaw as { items?: unknown }).items)
            ? ((downTopRaw as { items: IdeaDownTopItem[] }).items ?? [])
            : [],
        }
      : null;
  return {
    schema: "thinking-lab/idea-set/v1",
    repairCount: repairCount(row.repairCount),
    siblingSet,
    audit,
    downTop,
  };
}

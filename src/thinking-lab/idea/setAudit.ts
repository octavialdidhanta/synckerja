import { parseModelJson } from "@/thinking-lab/shared/ai";
import { fingerprintsMatch } from "@/thinking-lab/shared/fingerprint";
import type { AuditVerdict } from "@/thinking-lab/shared/verdict";

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

export type IdeaAuditLesson = {
  code: string;
  statement: string;
  reason: string;
};

export type IdeaSetRecord = {
  schema: "thinking-lab/idea-set/v1";
  repairCount: number;
  siblingSet: IdeaSetFacts | null;
  audit: { fingerprint: string; items: IdeaAuditItem[] } | null;
  downTop: { fingerprint: string; items: unknown[] } | null;
  auditLessons: IdeaAuditLesson[];
};

/** Open Ideas that already passed stay passed when a later sibling is audited. */
export function ideaCodesHeldPass(
  rows: Array<{ code: string; status?: string }>,
  verdicts: Array<AuditVerdict | null | undefined>,
): string[] {
  return rows.flatMap((row, index) =>
    row.status === "locked" || verdicts[index] === "AUDIT_PASS" ? [row.code] : [],
  );
}

/** An Idea that already passed stays passed. Later scoring can change only the other rows. */
export function holdPassingIdeaVerdicts(scored: IdeaAuditItem[], passingCodes: string[]): IdeaAuditItem[] {
  const passing = new Set(passingCodes.map((code) => code.toUpperCase()));
  return scored.map((item) => (passing.has(item.code.toUpperCase()) ? { ...item, verdict: "AUDIT_PASS" } : item));
}

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
  return {
    schema: "thinking-lab/idea-set/v1",
    repairCount: 0,
    siblingSet: null,
    audit: null,
    downTop: null,
    auditLessons: [],
  };
}

export function ideaFailureLessons(input: {
  rows: Array<{ code: string; statement: string }>;
  items: IdeaAuditItem[];
  siblingSet: IdeaSetFacts | null;
}): IdeaAuditLesson[] {
  const failed = new Set(
    input.items.filter((item) => item.verdict === "AUDIT_FAIL").map((item) => item.code.toUpperCase()),
  );
  return input.rows.flatMap((row) => {
    const code = row.code.toUpperCase();
    if (!failed.has(code)) return [];
    const reasons = [
      ...(input.siblingSet?.materialOverlapPairs ?? [])
        .filter((pair) => pair.ideaCodeA.toUpperCase() === code || pair.ideaCodeB.toUpperCase() === code)
        .map((pair) => `${pair.ideaCodeA} · ${pair.ideaCodeB}: ${pair.explanation}`),
      ...(input.siblingSet?.containmentPairs ?? [])
        .filter((pair) => pair.containerCode.toUpperCase() === code || pair.containedCode.toUpperCase() === code)
        .map((pair) => `${pair.containerCode} covers ${pair.containedCode}: ${pair.explanation}`),
    ];
    return [
      {
        code: row.code,
        statement: row.statement,
        reason: reasons.join(" ") || "Sibling audit failed this Idea.",
      },
    ];
  });
}

const GENERIC_IDEA_FAIL = "Sibling audit failed this Idea.";

/** Drop a generic fail note when the same statement already has the real conflict. */
export function usableIdeaFixLessons(lessons: IdeaAuditLesson[], code: string): IdeaAuditLesson[] {
  const mine = lessons.filter((lesson) => lesson.code.toUpperCase() === code.toUpperCase());
  const explained = new Set(
    mine
      .filter((lesson) => lesson.reason.trim() !== GENERIC_IDEA_FAIL)
      .map((lesson) => lesson.statement.trim().toLowerCase()),
  );
  return mine.filter(
    (lesson) => lesson.reason.trim() !== GENERIC_IDEA_FAIL || !explained.has(lesson.statement.trim().toLowerCase()),
  );
}

export function mergeIdeaAuditLessons(existing: IdeaAuditLesson[], next: IdeaAuditLesson[]): IdeaAuditLesson[] {
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
  sealed?: Array<{ code: string; statement: string }>;
}): string {
  const lines = input.rows.map((row) => `${row.code}: ${row.statement}`).join("\n");
  const sealed = (input.sealed ?? []).filter((row) => row.statement.trim());
  return [
    "You are the canonical sibling judge for one Idea set under a direct Angle.",
    "Each Idea was already admitted. Do not reclassify whether an individual Idea is valid.",
    "Decide only whether any two admitted Ideas use substantially the same mechanism, or whether one substantially contains the other.",
    "materialOverlapPairs lists pairs that would set up substantially the same mechanism.",
    "Overlap requires the same setup in both Ideas. A shared Angle, a shared cause, or a shared result is not overlap.",
    "containmentPairs lists a broader mechanism and the mechanism that sits inside it.",
    "coreDistinct is true only when both pair lists are empty.",
    "coreDistinct is false only when at least one pair explains the conflict.",
    "Every pair needs an explanation.",
    "Use exactly the keys ideaCodeA, ideaCodeB, containerCode, and containedCode. Do not rename them.",
    "Do not decide what a viewer would conclude.",
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
    ...(sealed.length > 0
      ? [
          "",
          "Locked Ideas already sealed. An admitted Idea that uses the same mechanism as a locked Idea is a material overlap. Pair the admitted code with the locked code. Do not pair two locked Ideas.",
          sealed.map((row) => `${row.code}: ${row.statement}`).join("\n"),
        ]
      : []),
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
            ? ((downTopRaw as { items: unknown[] }).items ?? [])
            : [],
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
  return {
    schema: "thinking-lab/idea-set/v1",
    repairCount: repairCount(row.repairCount),
    siblingSet,
    audit,
    downTop,
    auditLessons,
  };
}

import { parseModelJson } from "@/thinking-lab/shared/ai";
import { fingerprintsMatch } from "@/thinking-lab/shared/fingerprint";
import type { AuditVerdict } from "@/thinking-lab/shared/verdict";
import type {
  TerritoryChallengerResult,
  TerritoryContainment,
  TerritoryCoverage,
  TerritoryPair,
  TerritoryResolution,
  TerritorySetFacts,
  TerritoryTriState,
} from "@/thinking-lab/territory/types";

export type TerritoryAuditItem = {
  code: string;
  verdict: AuditVerdict;
  statementFingerprint?: string;
};

/** A Territory that already passed stays passed. Later scoring can change only the other rows. */
export function holdPassingTerritoryVerdicts(
  scored: TerritoryAuditItem[],
  passingCodes: string[],
): TerritoryAuditItem[] {
  const passing = new Set(passingCodes.map((code) => code.toUpperCase()));
  return scored.map((item) => (passing.has(item.code.toUpperCase()) ? { ...item, verdict: "AUDIT_PASS" } : item));
}

export type TerritoryAuditLesson = {
  code: string;
  statement: string;
  reason: string;
};

export type TerritorySetRecord = {
  schema: "thinking-lab/territory-set/v1";
  repairCount: number;
  siblingSet: TerritorySetFacts | null;
  audit: { fingerprint: string; items: TerritoryAuditItem[] } | null;
  challenger: { fingerprint: string; result: TerritoryChallengerResult } | null;
  auditLessons: TerritoryAuditLesson[];
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

function asTriState(value: unknown): TerritoryTriState | null {
  if (value === true || value === false) return value;
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  if (normalized === "unresolved") return "unresolved";
  return null;
}

function asResolution(value: unknown): TerritoryResolution {
  return value === "RESOLVED" || value === "UNRESOLVED" ? value : "UNRESOLVED";
}

function readPairs(value: unknown): TerritoryPair[] | null {
  if (!Array.isArray(value)) return null;
  const pairs: TerritoryPair[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object" || Array.isArray(row)) return null;
    const item = row as Record<string, unknown>;
    const territoryCodeA = asText(item.territoryCodeA || item.territory1 || item.a);
    const territoryCodeB = asText(item.territoryCodeB || item.territory2 || item.b);
    const explanation = asText(item.explanation);
    if (!territoryCodeA || !territoryCodeB || !explanation) return null;
    pairs.push({ territoryCodeA, territoryCodeB, explanation });
  }
  return pairs;
}

function readContainment(value: unknown): TerritoryContainment[] | null {
  if (!Array.isArray(value)) return null;
  const pairs: TerritoryContainment[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object" || Array.isArray(row)) return null;
    const item = row as Record<string, unknown>;
    const containerCode = asText(item.containerCode || item.broaderTerritory || item.container);
    const containedCode = asText(item.containedCode || item.containedTerritory || item.contained);
    const explanation = asText(item.explanation);
    if (!containerCode || !containedCode || !explanation) return null;
    pairs.push({ containerCode, containedCode, explanation });
  }
  return pairs;
}

export function emptyTerritorySetRecord(): TerritorySetRecord {
  return {
    schema: "thinking-lab/territory-set/v1",
    repairCount: 0,
    siblingSet: null,
    audit: null,
    challenger: null,
    auditLessons: [],
  };
}

export function territoryFailureLessons(input: {
  rows: Array<{ code: string; statement: string }>;
  items: TerritoryAuditItem[];
  siblingSet: TerritorySetFacts | null;
}): TerritoryAuditLesson[] {
  const failed = new Set(
    input.items.filter((item) => item.verdict === "AUDIT_FAIL").map((item) => item.code.toUpperCase()),
  );
  return input.rows.flatMap((row) => {
    const code = row.code.toUpperCase();
    if (!failed.has(code)) return [];
    const reasons = [
      ...(input.siblingSet?.materialOverlapPairs ?? [])
        .filter((pair) => pair.territoryCodeA.toUpperCase() === code || pair.territoryCodeB.toUpperCase() === code)
        .map((pair) => `${pair.territoryCodeA} · ${pair.territoryCodeB}: ${pair.explanation}`),
      ...(input.siblingSet?.containmentPairs ?? [])
        .filter((pair) => pair.containerCode.toUpperCase() === code || pair.containedCode.toUpperCase() === code)
        .map((pair) => `${pair.containerCode} covers ${pair.containedCode}: ${pair.explanation}`),
    ];
    return [
      {
        code: row.code,
        statement: row.statement,
        reason: reasons.join(" ") || "Sibling audit failed this Territory.",
      },
    ];
  });
}

export function mergeTerritoryAuditLessons(
  existing: TerritoryAuditLesson[],
  next: TerritoryAuditLesson[],
): TerritoryAuditLesson[] {
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

export function unresolvedTerritorySet(fingerprint: string, reason: string): TerritorySetFacts {
  return {
    fingerprint,
    coreDistinct: "unresolved",
    materialOverlapPairs: [],
    containmentPairs: [],
    coverage: "UNRESOLVED",
    resolution: "UNRESOLVED",
    unresolvedReasons: [reason],
  };
}

export function normalizeTerritorySet(raw: unknown, fingerprint: string): TerritorySetFacts {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return unresolvedTerritorySet(fingerprint, "JUDGE_UNPARSEABLE");
  }
  const row = raw as Record<string, unknown>;
  const coreDistinct = asTriState(row.coreDistinct);
  const overlap = readPairs(row.materialOverlapPairs);
  const containment = readContainment(row.containmentPairs);
  if (coreDistinct == null || overlap == null || containment == null) {
    return unresolvedTerritorySet(fingerprint, "JUDGE_UNPARSEABLE");
  }
  const reasons = asReasons(row.unresolvedReasons);
  const hasConflict = overlap.length > 0 || containment.length > 0;
  if (coreDistinct === true && hasConflict) return unresolvedTerritorySet(fingerprint, "CONTRADICTORY_SET_FACTS");
  if (coreDistinct === false && !hasConflict) return unresolvedTerritorySet(fingerprint, "MISSING_CONFLICT_PAIR");
  if (coreDistinct === "unresolved" || reasons.length > 0) {
    return unresolvedTerritorySet(fingerprint, reasons[0] ?? "SET_UNRESOLVED");
  }
  const facts: TerritorySetFacts = {
    fingerprint,
    coreDistinct,
    materialOverlapPairs: overlap,
    containmentPairs: containment,
    coverage: "UNRESOLVED",
    resolution: asResolution(row.resolution),
    unresolvedReasons: [],
  };
  if (typeof row.confidence === "number" && Number.isFinite(row.confidence)) facts.confidence = row.confidence;
  if (facts.resolution !== "RESOLVED") return unresolvedTerritorySet(fingerprint, "SET_UNRESOLVED");
  return facts;
}

export function parseTerritorySet(script: string | null, fingerprint: string): TerritorySetFacts {
  if (!script?.trim()) return unresolvedTerritorySet(fingerprint, "JUDGE_UNAVAILABLE");
  return normalizeTerritorySet(parseModelJson(script), fingerprint);
}

/** Fail both sides of an overlap. For containment, fail only the unique smallest set that explains every containing edge, so one broad newcomer does not fail the spaces it swallows. */
export function territoryConflictFailures(set: TerritorySetFacts): Set<string> {
  const failed = new Set<string>();
  for (const pair of set.materialOverlapPairs) {
    failed.add(pair.territoryCodeA.toUpperCase());
    failed.add(pair.territoryCodeB.toUpperCase());
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

export function scoreTerritoryAudit(input: {
  codes: string[];
  siblingSet: TerritorySetFacts | null;
  siblingSetCurrent: boolean;
}): TerritoryAuditItem[] {
  const failures = input.siblingSet ? territoryConflictFailures(input.siblingSet) : new Set<string>();
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

export function territorySetIsCurrent(stored: TerritorySetFacts | null, fingerprint: string): boolean {
  if (!stored) return false;
  return fingerprintsMatch(stored.fingerprint, fingerprint);
}

export function applyChallengerCoverage(set: TerritorySetFacts, coverage: TerritoryCoverage): TerritorySetFacts {
  return { ...set, coverage };
}

export function buildTerritorySiblingPrompt(input: {
  parentStatement: string;
  rows: Array<{ code: string; statement: string }>;
}): string {
  const lines = input.rows.map((row) => `${row.code}: ${row.statement}`).join("\n");
  return [
    "You are the canonical sibling judge for one Territory set under a direct Big Thought.",
    "Each Territory was already admitted. Do not reclassify whether an individual Territory is valid.",
    "Decide only whether any two admitted Territories occupy substantially the same exploration space, or whether one substantially contains the other.",
    "materialOverlapPairs lists pairs that would host substantially the same angles.",
    "Overlap requires that the same angles would live in both spaces. A shared topic, a support relation, a prerequisite, a foundation, or a result is not overlap.",
    "containmentPairs lists a broader space and the space that sits inside it.",
    "Containment requires that every angle in the narrower space would also live in the broader space. One space enabling, grounding, or resulting from another is not containment.",
    "coreDistinct is true only when both pair lists are empty.",
    "coreDistinct is false only when at least one pair explains the conflict.",
    "Every pair needs an explanation of the shared or containing space.",
    "Use exactly the keys territoryCodeA, territoryCodeB, containerCode, and containedCode. Do not rename them.",
    "Do not decide whether another Territory is still missing. Coverage belongs to the challenger.",
    "Mark resolution RESOLVED only when distinctness is fully decided. Otherwise use UNRESOLVED.",
    "Write explanations in the same language as the Big Thought.",
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
    "Direct Big Thought:",
    input.parentStatement.trim(),
    "",
    "Admitted Territories:",
    lines,
  ].join("\n");
}

export function readTerritorySetRecord(raw: unknown): TerritorySetRecord {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return emptyTerritorySetRecord();
  const row = raw as Record<string, unknown>;
  if (row.schema !== "thinking-lab/territory-set/v1") return emptyTerritorySetRecord();
  const siblingSet =
    row.siblingSet && typeof row.siblingSet === "object" && !Array.isArray(row.siblingSet)
      ? (row.siblingSet as TerritorySetFacts)
      : null;
  const auditRaw = row.audit;
  const audit =
    auditRaw && typeof auditRaw === "object" && !Array.isArray(auditRaw)
      ? {
          fingerprint: asText((auditRaw as { fingerprint?: unknown }).fingerprint),
          items: Array.isArray((auditRaw as { items?: unknown }).items)
            ? ((auditRaw as { items: TerritoryAuditItem[] }).items ?? [])
            : [],
        }
      : null;
  const challengerRaw = row.challenger;
  const challenger =
    challengerRaw && typeof challengerRaw === "object" && !Array.isArray(challengerRaw)
      ? {
          fingerprint: asText((challengerRaw as { fingerprint?: unknown }).fingerprint),
          result: (challengerRaw as { result?: TerritoryChallengerResult }).result ?? {
            status: "UNRESOLVED" as const,
            unresolvedReasons: ["JUDGE_UNPARSEABLE"],
          },
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
    schema: "thinking-lab/territory-set/v1",
    repairCount: repairCount(row.repairCount),
    siblingSet,
    audit,
    challenger,
    auditLessons,
  };
}

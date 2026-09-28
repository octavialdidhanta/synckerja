import { parseModelJson } from "@/thinking-lab/shared/ai";
import { fingerprintsMatch } from "@/thinking-lab/shared/fingerprint";
import type { AuditVerdict } from "@/thinking-lab/shared/verdict";
import type {
  AngleChallengerResult,
  AngleContainment,
  AngleCoverage,
  AnglePair,
  AngleResolution,
  AngleSetFacts,
  AngleTriState,
} from "@/thinking-lab/angle/types";

export type AngleAuditItem = {
  code: string;
  verdict: AuditVerdict;
  statementFingerprint?: string;
};

export type AngleSetRecord = {
  schema: "thinking-lab/angle-set/v1";
  repairCount: number;
  siblingSet: AngleSetFacts | null;
  audit: { fingerprint: string; items: AngleAuditItem[] } | null;
  challenger: { fingerprint: string; result: AngleChallengerResult } | null;
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

function asTriState(value: unknown): AngleTriState | null {
  if (value === true || value === false) return value;
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  if (normalized === "unresolved") return "unresolved";
  return null;
}

function asResolution(value: unknown): AngleResolution {
  return value === "RESOLVED" || value === "UNRESOLVED" ? value : "UNRESOLVED";
}

function readPairs(value: unknown): AnglePair[] | null {
  if (!Array.isArray(value)) return null;
  const pairs: AnglePair[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object" || Array.isArray(row)) return null;
    const item = row as Record<string, unknown>;
    const angleCodeA = asText(item.angleCodeA || item.angle1 || item.a);
    const angleCodeB = asText(item.angleCodeB || item.angle2 || item.b);
    const explanation = asText(item.explanation);
    if (!angleCodeA || !angleCodeB || !explanation) return null;
    pairs.push({ angleCodeA, angleCodeB, explanation });
  }
  return pairs;
}

function readContainment(value: unknown): AngleContainment[] | null {
  if (!Array.isArray(value)) return null;
  const pairs: AngleContainment[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object" || Array.isArray(row)) return null;
    const item = row as Record<string, unknown>;
    const containerCode = asText(item.containerCode || item.broaderAngle || item.container);
    const containedCode = asText(item.containedCode || item.containedAngle || item.contained);
    const explanation = asText(item.explanation);
    if (!containerCode || !containedCode || !explanation) return null;
    pairs.push({ containerCode, containedCode, explanation });
  }
  return pairs;
}

export function emptyAngleSetRecord(): AngleSetRecord {
  return { schema: "thinking-lab/angle-set/v1", repairCount: 0, siblingSet: null, audit: null, challenger: null };
}

export function unresolvedAngleSet(fingerprint: string, reason: string): AngleSetFacts {
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

export function normalizeAngleSet(raw: unknown, fingerprint: string): AngleSetFacts {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return unresolvedAngleSet(fingerprint, "JUDGE_UNPARSEABLE");
  }
  const row = raw as Record<string, unknown>;
  const coreDistinct = asTriState(row.coreDistinct);
  const overlap = readPairs(row.materialOverlapPairs);
  const containment = readContainment(row.containmentPairs);
  if (coreDistinct == null || overlap == null || containment == null) {
    return unresolvedAngleSet(fingerprint, "JUDGE_UNPARSEABLE");
  }
  const reasons = asReasons(row.unresolvedReasons);
  const hasConflict = overlap.length > 0 || containment.length > 0;
  if (coreDistinct === true && hasConflict) return unresolvedAngleSet(fingerprint, "CONTRADICTORY_SET_FACTS");
  if (coreDistinct === false && !hasConflict) return unresolvedAngleSet(fingerprint, "MISSING_CONFLICT_PAIR");
  if (coreDistinct === "unresolved" || reasons.length > 0) {
    return unresolvedAngleSet(fingerprint, reasons[0] ?? "SET_UNRESOLVED");
  }
  const facts: AngleSetFacts = {
    fingerprint,
    coreDistinct,
    materialOverlapPairs: overlap,
    containmentPairs: containment,
    coverage: "UNRESOLVED",
    resolution: asResolution(row.resolution),
    unresolvedReasons: [],
  };
  if (typeof row.confidence === "number" && Number.isFinite(row.confidence)) facts.confidence = row.confidence;
  if (facts.resolution !== "RESOLVED") return unresolvedAngleSet(fingerprint, "SET_UNRESOLVED");
  return facts;
}

export function parseAngleSet(script: string | null, fingerprint: string): AngleSetFacts {
  if (!script?.trim()) return unresolvedAngleSet(fingerprint, "JUDGE_UNAVAILABLE");
  return normalizeAngleSet(parseModelJson(script), fingerprint);
}

/** Fail both sides of an overlap. For containment, fail only the unique smallest set that explains every containing edge. */
export function angleConflictFailures(set: AngleSetFacts): Set<string> {
  const failed = new Set<string>();
  for (const pair of set.materialOverlapPairs) {
    failed.add(pair.angleCodeA.toUpperCase());
    failed.add(pair.angleCodeB.toUpperCase());
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

export function scoreAngleAudit(input: {
  codes: string[];
  siblingSet: AngleSetFacts | null;
  siblingSetCurrent: boolean;
}): AngleAuditItem[] {
  const failures = input.siblingSet ? angleConflictFailures(input.siblingSet) : new Set<string>();
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

export function angleSetIsCurrent(stored: AngleSetFacts | null, fingerprint: string): boolean {
  if (!stored) return false;
  return fingerprintsMatch(stored.fingerprint, fingerprint);
}

export function applyAngleChallengerCoverage(set: AngleSetFacts, coverage: AngleCoverage): AngleSetFacts {
  return { ...set, coverage };
}

export function buildAngleSiblingPrompt(input: {
  parentStatement: string;
  rows: Array<{ code: string; statement: string }>;
}): string {
  const lines = input.rows.map((row) => `${row.code}: ${row.statement}`).join("\n");
  return [
    "You are the canonical sibling judge for one Angle set under a direct Territory.",
    "Each Angle was already admitted. Do not reclassify whether an individual Angle is valid.",
    "Decide only whether any two admitted Angles occupy substantially the same point of view, or whether one substantially contains the other.",
    "materialOverlapPairs lists pairs that would host substantially the same ideas.",
    "Overlap requires that the same ideas would live in both points of view. A shared topic, a support relation, a prerequisite, a foundation, or a result is not overlap.",
    "containmentPairs lists a broader point of view and the point of view that sits inside it.",
    "Containment requires that every idea in the narrower point of view would also live in the broader one. One point of view enabling, grounding, or resulting from another is not containment.",
    "coreDistinct is true only when both pair lists are empty.",
    "coreDistinct is false only when at least one pair explains the conflict.",
    "Every pair needs an explanation of the shared or containing point of view.",
    "Use exactly the keys angleCodeA, angleCodeB, containerCode, and containedCode. Do not rename them.",
    "Do not decide whether another Angle is still missing. Coverage belongs to the challenger.",
    "Mark resolution RESOLVED only when distinctness is fully decided. Otherwise use UNRESOLVED.",
    "Write explanations in the same language as the Territory.",
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
    "Direct Territory:",
    input.parentStatement.trim(),
    "",
    "Admitted Angles:",
    lines,
  ].join("\n");
}

export function readAngleSetRecord(raw: unknown): AngleSetRecord {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return emptyAngleSetRecord();
  const row = raw as Record<string, unknown>;
  if (row.schema !== "thinking-lab/angle-set/v1") return emptyAngleSetRecord();
  const siblingSet =
    row.siblingSet && typeof row.siblingSet === "object" && !Array.isArray(row.siblingSet)
      ? (row.siblingSet as AngleSetFacts)
      : null;
  const auditRaw = row.audit;
  const audit =
    auditRaw && typeof auditRaw === "object" && !Array.isArray(auditRaw)
      ? {
          fingerprint: asText((auditRaw as { fingerprint?: unknown }).fingerprint),
          items: Array.isArray((auditRaw as { items?: unknown }).items)
            ? ((auditRaw as { items: AngleAuditItem[] }).items ?? [])
            : [],
        }
      : null;
  const challengerRaw = row.challenger;
  const challenger =
    challengerRaw && typeof challengerRaw === "object" && !Array.isArray(challengerRaw)
      ? {
          fingerprint: asText((challengerRaw as { fingerprint?: unknown }).fingerprint),
          result: (challengerRaw as { result?: AngleChallengerResult }).result ?? {
            status: "UNRESOLVED" as const,
            unresolvedReasons: ["JUDGE_UNPARSEABLE"],
          },
        }
      : null;
  return { schema: "thinking-lab/angle-set/v1", repairCount: repairCount(row.repairCount), siblingSet, audit, challenger };
}

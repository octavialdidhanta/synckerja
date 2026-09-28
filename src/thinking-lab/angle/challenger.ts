import { parseModelJson } from "@/thinking-lab/shared/ai";
import type { AngleChallengerResult, AngleChallengerStatus, AngleCoverage } from "@/thinking-lab/angle/types";

const STATUSES = new Set<AngleChallengerStatus>(["COMPLETE", "MATERIAL_GAP", "UNRESOLVED"]);

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asReasons(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((row) => asText(row)).filter(Boolean);
}

export function unresolvedAngleChallenger(reason: string): AngleChallengerResult {
  return { status: "UNRESOLVED", unresolvedReasons: [reason] };
}

export function normalizeAngleChallenger(raw: unknown): AngleChallengerResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return unresolvedAngleChallenger("JUDGE_UNPARSEABLE");
  const row = raw as Record<string, unknown>;
  const status = STATUSES.has(row.status as AngleChallengerStatus) ? (row.status as AngleChallengerStatus) : "UNRESOLVED";
  const description = asText(row.materialGapDescription);
  const reasons = asReasons(row.unresolvedReasons);
  if (status === "UNRESOLVED" || reasons.length > 0) {
    return unresolvedAngleChallenger(reasons[0] ?? "CHALLENGER_UNRESOLVED");
  }
  if (status === "MATERIAL_GAP" && !description) return unresolvedAngleChallenger("MISSING_GAP_DESCRIPTION");
  const facts: AngleChallengerResult = {
    status,
    unresolvedReasons: [],
  };
  if (status === "MATERIAL_GAP") facts.materialGapDescription = description;
  if (typeof row.confidence === "number" && Number.isFinite(row.confidence)) facts.confidence = row.confidence;
  return facts;
}

export function parseAngleChallenger(script: string | null): AngleChallengerResult {
  if (!script?.trim()) return unresolvedAngleChallenger("JUDGE_UNAVAILABLE");
  return normalizeAngleChallenger(parseModelJson(script));
}

export function coverageFromAngleChallenger(result: AngleChallengerResult): AngleCoverage {
  if (result.status === "COMPLETE" && result.unresolvedReasons.length === 0) return "SUFFICIENT";
  if (result.status === "MATERIAL_GAP" && result.materialGapDescription?.trim()) return "MATERIAL_GAP";
  return "UNRESOLVED";
}

export function buildAngleChallengerPrompt(input: {
  parentStatement: string;
  rows: Array<{ code: string; statement: string }>;
}): string {
  const lines = input.rows.map((row) => `${row.code}: ${row.statement}`).join("\n");
  return [
    "You are the canonical coverage judge for one Angle set.",
    "These Angles already passed sibling audit. Do not reclassify overlap or containment.",
    "Decide whether a materially different point of view is still missing under the direct Territory.",
    "A missing point of view must be able to hold several substantively different ideas that the current set does not already host.",
    "Do not demand another Angle merely because the parent could be named again.",
    "status is COMPLETE, MATERIAL_GAP, or UNRESOLVED.",
    "When status is MATERIAL_GAP, materialGapDescription is required and names the missing point of view.",
    "When status is COMPLETE, leave materialGapDescription empty.",
    "Write the description in the same language as the Territory.",
    "Do not use examples from any specific industry, belief system, or brand.",
    "Return JSON only:",
    JSON.stringify({
      status: "COMPLETE",
      materialGapDescription: "",
      unresolvedReasons: [],
      confidence: 0,
    }),
    "",
    "Direct Territory:",
    input.parentStatement.trim(),
    "",
    "Audited Angles:",
    lines,
  ].join("\n");
}

export function angleChallengerCanRun(verdicts: Array<"AUDIT_PASS" | "AUDIT_FAIL" | "UNRESOLVED" | "STALE">): boolean {
  return verdicts.length >= 3 && verdicts.every((verdict) => verdict === "AUDIT_PASS");
}

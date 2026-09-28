import { parseModelJson } from "@/thinking-lab/shared/ai";
import type { TerritoryChallengerResult, TerritoryChallengerStatus, TerritoryCoverage } from "@/thinking-lab/territory/types";

const STATUSES = new Set<TerritoryChallengerStatus>(["COMPLETE", "MATERIAL_GAP", "UNRESOLVED"]);

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asReasons(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((row) => asText(row)).filter(Boolean);
}

export function unresolvedTerritoryChallenger(reason: string): TerritoryChallengerResult {
  return { status: "UNRESOLVED", unresolvedReasons: [reason] };
}

export function normalizeTerritoryChallenger(raw: unknown): TerritoryChallengerResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return unresolvedTerritoryChallenger("JUDGE_UNPARSEABLE");
  const row = raw as Record<string, unknown>;
  const status = STATUSES.has(row.status as TerritoryChallengerStatus)
    ? (row.status as TerritoryChallengerStatus)
    : "UNRESOLVED";
  const description = asText(row.materialGapDescription);
  const reasons = asReasons(row.unresolvedReasons);
  if (status === "UNRESOLVED" || reasons.length > 0) {
    return unresolvedTerritoryChallenger(reasons[0] ?? "CHALLENGER_UNRESOLVED");
  }
  if (status === "MATERIAL_GAP" && !description) return unresolvedTerritoryChallenger("MISSING_GAP_DESCRIPTION");
  const facts: TerritoryChallengerResult = {
    status,
    unresolvedReasons: [],
  };
  if (status === "MATERIAL_GAP") facts.materialGapDescription = description;
  if (typeof row.confidence === "number" && Number.isFinite(row.confidence)) facts.confidence = row.confidence;
  return facts;
}

export function parseTerritoryChallenger(script: string | null): TerritoryChallengerResult {
  if (!script?.trim()) return unresolvedTerritoryChallenger("JUDGE_UNAVAILABLE");
  return normalizeTerritoryChallenger(parseModelJson(script));
}

export function coverageFromChallenger(result: TerritoryChallengerResult): TerritoryCoverage {
  if (result.status === "COMPLETE" && result.unresolvedReasons.length === 0) return "SUFFICIENT";
  if (result.status === "MATERIAL_GAP" && result.materialGapDescription?.trim()) return "MATERIAL_GAP";
  return "UNRESOLVED";
}

export function buildTerritoryChallengerPrompt(input: {
  parentStatement: string;
  rows: Array<{ code: string; statement: string }>;
}): string {
  const lines = input.rows.map((row) => `${row.code}: ${row.statement}`).join("\n");
  return [
    "You are the canonical coverage judge for one Territory set.",
    "These Territories already passed sibling audit. Do not reclassify overlap or containment.",
    "Decide whether a materially different exploration space is still missing under the direct Big Thought.",
    "A missing space must be able to hold several substantively different angles that the current set does not already host.",
    "Do not demand another Territory merely because the parent could be named again.",
    "status is COMPLETE, MATERIAL_GAP, or UNRESOLVED.",
    "When status is MATERIAL_GAP, materialGapDescription is required and names the missing space.",
    "When status is COMPLETE, leave materialGapDescription empty.",
    "Write the description in the same language as the Big Thought.",
    "Do not use examples from any specific industry, belief system, or brand.",
    "Return JSON only:",
    JSON.stringify({
      status: "COMPLETE",
      materialGapDescription: "",
      unresolvedReasons: [],
      confidence: 0,
    }),
    "",
    "Direct Big Thought:",
    input.parentStatement.trim(),
    "",
    "Audited Territories:",
    lines,
  ].join("\n");
}

export function territoryChallengerCanRun(verdicts: AuditVerdictLike[]): boolean {
  return verdicts.length >= 3 && verdicts.every((verdict) => verdict === "AUDIT_PASS");
}

type AuditVerdictLike = "AUDIT_PASS" | "AUDIT_FAIL" | "UNRESOLVED" | "STALE";

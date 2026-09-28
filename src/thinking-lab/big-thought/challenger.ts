import { parseModelJson } from "@/thinking-lab/shared/ai";
import type { Resolution } from "@/thinking-lab/shared/verdict";
import type { AuditVerdict } from "@/thinking-lab/shared/verdict";
import type { ChallengerFacts, ChallengerStatus } from "@/thinking-lab/big-thought/types";

const STATUSES = new Set<ChallengerStatus>(["COMPLETE", "MISSING_MATERIAL_SUPPORT", "UNRESOLVED"]);

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asResolution(value: unknown): Resolution {
  return value === "RESOLVED" || value === "UNRESOLVED" ? value : "UNRESOLVED";
}

function asReasons(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((row) => asText(row)).filter(Boolean);
}

export function unresolvedChallenger(setFingerprint: string, reason: string): ChallengerFacts {
  return {
    setFingerprint,
    status: "UNRESOLVED",
    missingWhyDescription: "",
    missingWhyBoundary: "",
    resolution: "UNRESOLVED",
    unresolvedReasons: [reason],
  };
}

export function normalizeChallenger(raw: unknown, setFingerprint: string): ChallengerFacts {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return unresolvedChallenger(setFingerprint, "JUDGE_UNPARSEABLE");
  }
  const row = raw as Record<string, unknown>;
  const status = STATUSES.has(row.status as ChallengerStatus)
    ? (row.status as ChallengerStatus)
    : "UNRESOLVED";
  const description = asText(row.missingWhyDescription);
  const boundary = asText(row.missingWhyBoundary);
  const reasons = asReasons(row.unresolvedReasons);
  if (status === "MISSING_MATERIAL_SUPPORT" && (!description || !boundary)) {
    return unresolvedChallenger(setFingerprint, "MISSING_WHY_BOUNDARY");
  }
  const facts: ChallengerFacts = {
    setFingerprint,
    status,
    missingWhyDescription: status === "MISSING_MATERIAL_SUPPORT" ? description : "",
    missingWhyBoundary: status === "MISSING_MATERIAL_SUPPORT" ? boundary : "",
    resolution: status === "UNRESOLVED" ? "UNRESOLVED" : asResolution(row.resolution),
    unresolvedReasons: reasons,
  };
  if (typeof row.confidence === "number" && Number.isFinite(row.confidence)) {
    facts.confidence = row.confidence;
  }
  if (facts.status !== "UNRESOLVED" && (facts.resolution !== "RESOLVED" || facts.unresolvedReasons.length > 0)) {
    return unresolvedChallenger(setFingerprint, "CHALLENGER_UNRESOLVED");
  }
  return facts;
}

export function parseChallenger(script: string | null, setFingerprint: string): ChallengerFacts {
  if (!script?.trim()) return unresolvedChallenger(setFingerprint, "JUDGE_UNAVAILABLE");
  return normalizeChallenger(parseModelJson(script), setFingerprint);
}

export function buildChallengerPrompt(input: {
  parentStatement: string;
  rows: Array<{ code: string; statement: string }>;
}): string {
  const lines = input.rows.map((row) => `${row.code}: ${row.statement}`).join("\n");
  return [
    "You are the canonical completeness judge for one Big Thought set.",
    "The rows below already passed set audit. Do not reclassify them and do not mark any row pass or fail.",
    "Decide whether a distinct material support is still missing from the set.",
    "A missing support must be a distinct material reason, basis, or evidence that the Master Thought is true, important, or defensible.",
    "It may be a premise, reason, or evidence.",
    "It must not be a restatement, paraphrase, or unpacking of the Master Thought itself.",
    "It must not be a reasoning job already held by an audited Big Thought.",
    "If every distinct material support is already present, or the only apparent gap is the parent claim or an existing Big Thought, return COMPLETE.",
    "Do not demand another support merely because the parent could be said again more specifically.",
    "status is COMPLETE, MISSING_MATERIAL_SUPPORT, or UNRESOLVED.",
    "When status is MISSING_MATERIAL_SUPPORT, missingWhyDescription and missingWhyBoundary are both required.",
    "missingWhyDescription says what distinct material support is absent.",
    "missingWhyBoundary says what that support covers and what it must not collapse into.",
    "Mark resolution RESOLVED only when the status is fully decided.",
    "confidence is optional debug metadata. It does not decide the judgment.",
    "Write natural-language fields in the same language as the Master Thought.",
    "Do not use examples from any specific industry, belief system, or brand.",
    "Return JSON only:",
    JSON.stringify({
      status: "COMPLETE",
      missingWhyDescription: "",
      missingWhyBoundary: "",
      resolution: "RESOLVED",
      unresolvedReasons: [],
      confidence: 0,
    }),
    "",
    "Master Thought:",
    input.parentStatement.trim(),
    "",
    "Audited Big Thoughts:",
    lines,
  ].join("\n");
}

export function challengerCanRun(input: {
  auditPassCount: number;
  activeCount: number;
  anyFail: boolean;
  anyStale: boolean;
  anyUnresolved: boolean;
}): boolean {
  return (
    input.auditPassCount >= 3 &&
    input.auditPassCount === input.activeCount &&
    !input.anyFail &&
    !input.anyStale &&
    !input.anyUnresolved
  );
}

export function currentMissingWhy(
  challenger: ChallengerFacts | null,
  currentSetFingerprint: string,
): { description: string; boundary: string } | null {
  if (!challenger) return null;
  if (challenger.setFingerprint !== currentSetFingerprint) return null;
  if (challenger.status !== "MISSING_MATERIAL_SUPPORT") return null;
  if (!challenger.missingWhyDescription.trim() || !challenger.missingWhyBoundary.trim()) return null;
  return {
    description: challenger.missingWhyDescription.trim(),
    boundary: challenger.missingWhyBoundary.trim(),
  };
}

export function auditHasBlocker(verdicts: Array<AuditVerdict | null>): boolean {
  return verdicts.some((verdict) => verdict === "AUDIT_FAIL" || verdict === "STALE" || verdict === "UNRESOLVED" || verdict == null);
}

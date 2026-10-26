import type { AncestorStake } from "@/thinking-lab/shared/ancestorStake";
import { ancestorStakeBlock } from "@/thinking-lab/shared/ancestorStake";
import type { ExecutionRelation, PillarRecommendation } from "@/thinking-lab/execution/types";

const PILLAR_RECOMMEND = new Set<ExecutionRelation>(["MECHANISM_HIDDEN", "PILLAR_OUTSIDE", "PILLAR_NOT_SELLING"]);

export const PILLAR_CHOICE_LIMIT = 3;

export function limitPillarChoices<T>(choices: readonly T[]): T[] {
  return choices.slice(0, PILLAR_CHOICE_LIMIT);
}

export type RecommendablePillar = {
  name: string;
  funnel?: string | null;
  category?: string | null;
  description?: string | null;
};

export function pillarNeedsRecommendation(relation: ExecutionRelation): boolean {
  return PILLAR_RECOMMEND.has(relation);
}

export function pillarWasRecommended(pillarName: string, recommendations: Array<string | null | undefined>): boolean {
  const name = pillarName.trim().toLowerCase();
  if (!name) return false;
  return recommendations.some((value) => (value ?? "").trim().toLowerCase() === name);
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function clip(value: string | null | undefined, limit: number): string {
  const text = value?.trim().replace(/\s+/g, " ") ?? "";
  if (!text) return "";
  return text.length > limit ? text.slice(0, limit) : text;
}

export function parsePillarRecommendation(
  raw: unknown,
  pillars: string[],
  failedPillar: string,
): PillarRecommendation | null {
  const row = asRecord(raw);
  if (!row) return null;
  const named = asText(row.pillar ?? row.pillarName);
  const reason = clip(asText(row.reason), 500);
  if (!named || !reason) return null;
  const failed = failedPillar.trim().toLowerCase();
  const match = pillars.find((pillar) => pillar.trim().toLowerCase() === named.toLowerCase());
  if (!match || match.trim().toLowerCase() === failed) return null;
  return { pillarName: match.trim(), reason };
}

export function buildPillarFitChoicePrompt(input: {
  masterStatement: string;
  ideaStatement: string;
  failedPillar: string;
  explanation?: string | null;
  ancestors?: AncestorStake[];
  pillar: RecommendablePillar;
}): string {
  const detail = [input.pillar.funnel, input.pillar.category, clip(input.pillar.description, 240)].filter(Boolean).join(" — ");
  return [
    "Decide whether this pillar format can carry the Idea.",
    "Judge the format. A sentence in a script can be rewritten, so do not fail the format because a script added a solution.",
    "pass is true when this format can show the Idea without forcing a message the Idea does not contain.",
    "pass is false when the format itself cannot carry the Idea unless it adds a message the Idea does not contain.",
    "When pass is false, reason says why in the same language as the Idea.",
    "When pass is true, reason says in one sentence why this format fits.",
    'Return JSON only: {"pass":true,"reason":""} or {"pass":false,"reason":"..."}',
    "",
    `Pillar: ${input.pillar.name.trim()}`,
    ...(detail ? [`Detail: ${detail}`] : []),
    "",
    "Failed pillar:",
    input.failedPillar.trim(),
    ...(input.explanation?.trim() ? ["", "Why the failed pillar could not carry the Idea:", input.explanation.trim()] : []),
    "",
    "Master Thought:",
    input.masterStatement.trim(),
    ...ancestorStakeBlock(input.ancestors),
    "",
    "Idea:",
    input.ideaStatement.trim(),
  ].join("\n");
}

export function parsePillarFitChoice(raw: unknown, pillarName: string): { pillarName: string; reason: string } | null {
  const row = asRecord(raw);
  if (!row || row.pass !== true) return null;
  const reason = clip(asText(row.reason), 500);
  const name = pillarName.trim();
  if (!name || !reason) return null;
  return { pillarName: name, reason };
}

export function buildPillarRecommendationPrompt(input: {
  masterStatement: string;
  ideaStatement: string;
  failedPillar: string;
  explanation?: string | null;
  ancestors?: AncestorStake[];
  pillars: RecommendablePillar[];
}): string {
  const failed = input.failedPillar.trim();
  const choices = input.pillars
    .map((pillar) => {
      const name = pillar.name.trim();
      if (!name || name.toLowerCase() === failed.toLowerCase()) return "";
      const detail = [pillar.funnel, pillar.category, clip(pillar.description, 240)].filter(Boolean).join(" — ");
      return detail ? `- ${name}: ${detail}` : `- ${name}`;
    })
    .filter(Boolean);
  return [
    "The script for this pillar did not pass.",
    "The pillar is a format. It must realize the Idea, not add a message the Idea does not carry.",
    "Recommend one other pillar from the list. The user should not have to try the formats one by one.",
    "Choose the format that can show this Idea without the message named in the explanation.",
    "Use a pillar name exactly as listed. Do not invent a pillar. Do not recommend the failed pillar.",
    "Write the reason in the same language as the Idea, in one or two sentences.",
    "Name why this format fits this Idea.",
    "Return JSON only:",
    JSON.stringify({ pillar: "", reason: "" }),
    "",
    "Failed pillar:",
    failed,
    ...(input.explanation?.trim() ? ["", "Why it failed:", input.explanation.trim()] : []),
    "",
    "Master Thought:",
    input.masterStatement.trim(),
    ...ancestorStakeBlock(input.ancestors),
    "",
    "Idea:",
    input.ideaStatement.trim(),
    "",
    "Other pillars:",
    choices.join("\n") || "(none)",
  ].join("\n");
}

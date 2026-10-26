import { parseModelJson } from "@/thinking-lab/shared/ai";
import type { PillarFitStatus, StoredPillarReview } from "@/thinking-lab/creative-idea/types";
import { PILLAR_REVIEW_LIMIT } from "@/thinking-lab/creative-idea/types";

export type ReviewablePillar = {
  id: string;
  name: string;
  category?: string | null;
  description?: string | null;
  funnel?: string | null;
};

export type PillarReview = {
  contentPillarId: string;
  pillarName: string;
  status: PillarFitStatus;
  reason: string;
  development: string;
};

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function clip(value: string, limit: number): string {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > limit ? text.slice(0, limit) : text;
}

function wordsOf(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 3);
}

export function selectPillarReviewSet<T extends ReviewablePillar>(
  pillars: readonly T[],
  context: string,
  limit = PILLAR_REVIEW_LIMIT,
): { reviewed: T[]; unreviewed: T[] } {
  const words = wordsOf(context);
  const ranked = [...pillars].sort((left, right) => {
    const score = (pillar: T) => {
      const haystack = `${pillar.name} ${pillar.category ?? ""} ${pillar.description ?? ""}`.toLowerCase();
      return words.reduce((total, word) => total + (haystack.includes(word) ? 1 : 0), 0);
    };
    const difference = score(right) - score(left);
    if (difference !== 0) return difference;
    return left.name.localeCompare(right.name);
  });
  const reviewed = ranked.slice(0, Math.max(0, limit));
  const reviewedIds = new Set(reviewed.map((pillar) => pillar.id));
  return {
    reviewed,
    unreviewed: pillars.filter((pillar) => !reviewedIds.has(pillar.id)),
  };
}

function fitStatus(value: string): Exclude<PillarFitStatus, "NOT_REVIEWED"> | null {
  const text = value.toUpperCase().replace(/[\s-]+/g, "_");
  if (text === "RECOMMENDED") return "RECOMMENDED";
  if (text === "POSSIBLE_WITH_ADAPTATION" || text === "POSSIBLE") return "POSSIBLE_WITH_ADAPTATION";
  if (text === "NOT_SUITABLE" || text === "UNSUITABLE") return "NOT_SUITABLE";
  return null;
}

export function parsePillarReviews(raw: unknown, reviewed: readonly ReviewablePillar[]): StoredPillarReview[] {
  const row = asRecord(raw);
  const list = Array.isArray(raw) ? raw : Array.isArray(row?.reviews) ? row.reviews : [];
  const seen = new Set<string>();
  return list.flatMap((item) => {
    const entry = asRecord(item);
    if (!entry) return [];
    const named = asText(entry.pillar ?? entry.pillarName ?? entry.name);
    const status = fitStatus(asText(entry.status) || "RECOMMENDED");
    const reason = clip(asText(entry.reason), 500);
    const development = clip(asText(entry.development ?? entry.idea ?? entry.becomes), 700);
    if (!named || status !== "RECOMMENDED" || !reason || !development) return [];
    const match = reviewed.find((pillar) => pillar.name.trim().toLowerCase() === named.toLowerCase());
    if (!match || seen.has(match.id) || development.toLowerCase() === match.name.trim().toLowerCase()) return [];
    seen.add(match.id);
    return [{ contentPillarId: match.id, pillarName: match.name.trim(), status: "RECOMMENDED", reason, development }];
  });
}

export function mergePillarReviews(pillars: readonly ReviewablePillar[], parsed: readonly StoredPillarReview[]): PillarReview[] {
  const byId = new Map(parsed.map((review) => [review.contentPillarId, review]));
  return pillars.map((pillar) => {
    const found = byId.get(pillar.id);
    if (!found) return { contentPillarId: pillar.id, pillarName: pillar.name.trim(), status: "NOT_REVIEWED", reason: "", development: "" };
    return found;
  });
}

export function reviewsToStore(reviews: readonly PillarReview[]): StoredPillarReview[] {
  return reviews.flatMap((review) => {
    if (review.status !== "RECOMMENDED" || !review.reason.trim() || !review.development.trim()) return [];
    return [
      {
        contentPillarId: review.contentPillarId,
        pillarName: review.pillarName,
        status: "RECOMMENDED",
        reason: review.reason.trim(),
        development: review.development.trim(),
      },
    ];
  });
}

export function buildPillarReviewPrompt(input: {
  context: string;
  pillars: readonly ReviewablePillar[];
  keep?: number;
  excludedNames?: readonly string[];
}): string {
  const keep = input.keep ?? 3;
  const lines = input.pillars.map((pillar) => {
    const detail = [pillar.funnel, pillar.category, clip(pillar.description ?? "", 180)].filter(Boolean).join(" — ");
    return detail ? `- ${pillar.name.trim()}: ${detail}` : `- ${pillar.name.trim()}`;
  });
  const excluded = (input.excludedNames ?? []).map((name) => name.trim()).filter(Boolean);
  return [
    "Recommend only the pillars listed below that can carry this conceptual idea.",
    "Use a pillar name exactly as listed. Do not invent a pillar.",
    "Do not force a pillar to fit. Omit it when you cannot show the idea living in that pillar.",
    `Return exactly ${keep} recommendations, strongest first. If fewer than ${keep} pillars can carry the idea, return only those that can.`,
    ...(excluded.length > 0
      ? ["These pillars are already locked. Do not recommend them:", ...excluded.map((name) => `- ${name}`)]
      : []),
    "development shows what this same conceptual idea becomes in that pillar. Keep its substance. Show the pillar's way of carrying it.",
    "development is not a title, a pillar label, a script, or a new idea.",
    "reason says why this pillar can carry the idea without replacing it. A label is not a reason.",
    "Write development and reason in the same language as the idea.",
    "Return JSON only:",
    JSON.stringify({ reviews: [{ pillar: "", development: "", reason: "" }] }),
    "",
    "Conceptual idea and its context:",
    input.context.trim(),
    "",
    "Pillars to review:",
    lines.join("\n") || "(none)",
  ].join("\n");
}

export function buildPillarRecommendationCheckPrompt(input: {
  context: string;
  pillar: ReviewablePillar;
  development: string;
  claim: string;
}): string {
  const detail = [input.pillar.funnel, input.pillar.category, clip(input.pillar.description ?? "", 240)].filter(Boolean).join(" — ");
  return [
    "Check this pillar recommendation. The proposal is not proof.",
    "PASS only when the development keeps the conceptual idea and shows how this pillar carries it, and the claim explains that fit.",
    "FAIL when the development replaces the idea, only names the pillar, or the claim does not show why the pillar fits.",
    "When pass is true, reason is the evidence in the idea's language, in one or two sentences.",
    "When pass is false, reason says what is missing.",
    'Return JSON only: {"pass":true,"reason":""} or {"pass":false,"reason":"..."}',
    "",
    `Pillar: ${input.pillar.name.trim()}`,
    ...(detail ? [`Pillar detail: ${detail}`] : []),
    "",
    "Conceptual idea:",
    input.context.trim(),
    "",
    "What the idea becomes in this pillar:",
    input.development.trim(),
    "",
    "Claimed reason:",
    input.claim.trim(),
  ].join("\n");
}

export function parsePillarRecommendationCheck(raw: unknown): { pass: boolean; reason: string } | null {
  const row = asRecord(raw);
  if (!row || typeof row.pass !== "boolean") return null;
  const reason = clip(asText(row.reason), 500);
  if (!reason) return null;
  return { pass: row.pass === true, reason };
}

export async function reviewContentPillars(input: {
  pillars: readonly ReviewablePillar[];
  context: string;
  excludeIds?: readonly string[];
  keep?: number;
  ask: (prompt: string) => Promise<string | null>;
}): Promise<PillarReview[]> {
  const blocked = new Set(input.excludeIds ?? []);
  const open = input.pillars.filter((pillar) => !blocked.has(pillar.id));
  const { reviewed } = selectPillarReviewSet(open, input.context);
  if (reviewed.length === 0) return [];
  const keep = input.keep ?? 3;
  const excludedNames = input.pillars.filter((pillar) => blocked.has(pillar.id)).map((pillar) => pillar.name);
  const raw = await input.ask(
    buildPillarReviewPrompt({ context: input.context, pillars: reviewed, keep, excludedNames }),
  );
  const proposed = parsePillarReviews(raw ? parseModelJson(raw) : null, reviewed);
  const confirmed: PillarReview[] = [];
  for (const item of proposed) {
    if (confirmed.length >= keep) break;
    const pillar = reviewed.find((candidate) => candidate.id === item.contentPillarId);
    if (!pillar) continue;
    const checkRaw = await input.ask(
      buildPillarRecommendationCheckPrompt({
        context: input.context,
        pillar,
        development: item.development,
        claim: item.reason,
      }),
    );
    const check = parsePillarRecommendationCheck(checkRaw ? parseModelJson(checkRaw) : null);
    if (!check?.pass) continue;
    confirmed.push({ ...item, reason: check.reason });
  }
  return confirmed;
}

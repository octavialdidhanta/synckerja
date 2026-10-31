import type { CreativeFormat, DevelopmentPath, PillarFitStatus, StoredPillarReview } from "@/thinking-lab/creative-idea/types";
import { CREATIVE_FORMATS } from "@/thinking-lab/creative-idea/types";

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readFormat(value: unknown): CreativeFormat | null | undefined {
  if (value === null) return null;
  const text = asText(value);
  if (!text) return undefined;
  return CREATIVE_FORMATS.find((format) => format === text) ?? undefined;
}

function asFitStatus(value: unknown): PillarFitStatus {
  const text = asText(value);
  if (text === "RECOMMENDED" || text === "POSSIBLE_WITH_ADAPTATION" || text === "NOT_SUITABLE" || text === "NOT_REVIEWED") {
    return text;
  }
  return "NOT_REVIEWED";
}

function readReviews(value: unknown): StoredPillarReview[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((item) => {
    const row = asRecord(item);
    if (!row) return [];
    const contentPillarId = asText(row.contentPillarId);
    const pillarName = asText(row.pillarName);
    const status = asFitStatus(row.status);
    const reason = asText(row.reason);
    const development = asText(row.development);
    const offer = asText(row.offer);
    const comment = asText(row.comment);
    const trigger = asText(row.trigger);
    if (!contentPillarId || !pillarName || status !== "RECOMMENDED" || !reason || !development || seen.has(contentPillarId)) return [];
    seen.add(contentPillarId);
    return [{
      contentPillarId,
      pillarName,
      status,
      reason,
      development,
      ...(offer ? { offer } : {}),
      ...(comment ? { comment } : {}),
      ...(trigger ? { trigger } : {}),
    }];
  });
}

function readPath(value: unknown): DevelopmentPath | null {
  const row = asRecord(value);
  if (!row) return null;
  const contentPillarId = asText(row.contentPillarId);
  const pillarName = asText(row.pillarName);
  const format = readFormat(row.format);
  if (!contentPillarId || !pillarName || format === undefined) return null;
  const savedAt = asText(row.savedAt) || new Date(0).toISOString();
  return {
    contentPillarId,
    pillarName,
    format,
    status: asFitStatus(row.status),
    reason: asText(row.reason),
    reviews: readReviews(row.reviews),
    savedAt,
  };
}

export function pathKey(contentPillarId: string, format: CreativeFormat | null): string {
  return `${contentPillarId}:${format ?? "locked"}`;
}

export function readDevelopmentPaths(raw: unknown): DevelopmentPath[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  return raw.flatMap((item) => {
    const path = readPath(item);
    if (!path) return [];
    const key = pathKey(path.contentPillarId, path.format);
    if (seen.has(key)) return [];
    seen.add(key);
    return [path];
  });
}

export function upsertDevelopmentPath(paths: readonly DevelopmentPath[], next: DevelopmentPath): DevelopmentPath[] {
  const key = pathKey(next.contentPillarId, next.format);
  const kept = paths.filter((path) => pathKey(path.contentPillarId, path.format) !== key);
  return [...kept, next];
}

export function findDevelopmentPath(
  paths: readonly DevelopmentPath[],
  contentPillarId: string,
  format: CreativeFormat,
): DevelopmentPath | null {
  return paths.find((path) => path.contentPillarId === contentPillarId && path.format === format) ?? null;
}

export function latestPathReviews(paths: readonly DevelopmentPath[]): StoredPillarReview[] {
  const latest = [...paths].sort((left, right) => right.savedAt.localeCompare(left.savedAt))[0];
  return latest?.reviews ?? [];
}

export type LockedPillarCard = {
  contentPillarId: string;
  pillarName: string;
  development: string;
  reason: string;
  format: CreativeFormat | null;
  /** True when this lock came from Review pillar Lead Magnet. */
  leadMagnet?: boolean;
};

export function lockedPillarCards(
  paths: readonly DevelopmentPath[],
  reviews?: readonly StoredPillarReview[] | null,
): LockedPillarCard[] {
  const order: string[] = [];
  const byId = new Map<string, LockedPillarCard>();
  for (const path of [...paths].sort((left, right) => left.savedAt.localeCompare(right.savedAt))) {
    const review =
      reviews?.find((item) => item.contentPillarId === path.contentPillarId) ??
      path.reviews.find((item) => item.contentPillarId === path.contentPillarId);
    const previous = byId.get(path.contentPillarId);
    if (!previous) order.push(path.contentPillarId);
    byId.set(path.contentPillarId, {
      contentPillarId: path.contentPillarId,
      pillarName: review?.pillarName.trim() || path.pillarName.trim() || previous?.pillarName || "",
      development: review?.development.trim() || previous?.development || "",
      reason: review?.reason.trim() || path.reason.trim() || previous?.reason || "",
      format: path.format ?? previous?.format ?? null,
      leadMagnet: review ? Boolean(review.offer?.trim()) : Boolean(previous?.leadMagnet),
    });
  }
  return order.flatMap((id) => {
    const card = byId.get(id);
    return card?.pillarName.trim() ? [card] : [];
  });
}

export function mergeLockedPillar(cards: readonly LockedPillarCard[], pending: LockedPillarCard | null): LockedPillarCard[] {
  if (!pending?.contentPillarId || !pending.pillarName.trim()) return [...cards];
  const index = cards.findIndex((card) => card.contentPillarId === pending.contentPillarId);
  if (index < 0) return [...cards, pending];
  const current = cards[index];
  const next = [...cards];
  next[index] = {
    ...current,
    pillarName: pending.pillarName.trim() || current.pillarName,
    development: pending.development.trim() || current.development,
    reason: pending.reason.trim() || current.reason,
    format: pending.format ?? current.format,
    leadMagnet: pending.leadMagnet ?? current.leadMagnet,
  };
  return next;
}

export type LeadMagnetPillarBrief = {
  offer: string;
  comment: string;
  trigger: string;
  pillarName: string;
  development: string;
};

/** Review that still carries an offer for this pillar. Comment may be empty. */
export function leadMagnetBriefForPillar(
  paths: readonly DevelopmentPath[],
  contentPillarId: string,
  reviews?: readonly StoredPillarReview[] | null,
): LeadMagnetPillarBrief | null {
  const sources: StoredPillarReview[] = [
    ...(reviews ?? []),
    ...[...paths]
      .sort((left, right) => right.savedAt.localeCompare(left.savedAt))
      .flatMap((path) => path.reviews),
  ];
  const review = sources.find(
    (item) => item.contentPillarId === contentPillarId && Boolean(item.offer?.trim()),
  );
  const offer = review?.offer?.trim() ?? "";
  if (!review || !offer) return null;
  return {
    offer,
    comment: review.comment?.trim() ?? "",
    trigger: review.trigger?.trim() ?? "",
    pillarName: review.pillarName.trim(),
    development: review.development.trim(),
  };
}

export function developmentForPillar(
  paths: readonly DevelopmentPath[],
  contentPillarId: string,
  reviews?: readonly StoredPillarReview[],
): string {
  const live = reviews?.find((review) => review.contentPillarId === contentPillarId)?.development.trim();
  if (live) return live;
  for (const path of [...paths].sort((left, right) => right.savedAt.localeCompare(left.savedAt))) {
    const found = path.reviews.find((review) => review.contentPillarId === contentPillarId)?.development.trim();
    if (found) return found;
  }
  return "";
}

export function developmentPathPatch(paths: readonly DevelopmentPath[]): { development_paths: DevelopmentPath[] } {
  return { development_paths: [...paths] };
}

export const PUBLISH_PLATFORM_ORDER = [
  "Facebook",
  "Instagram",
  "LinkedIn",
  "TikTok",
  "YouTube",
] as const;

export type PublishAttemptOutcome = "published" | "failed" | "retry_wait" | "in_progress";

export function publishPlatformRank(platform: string): number {
  const index = PUBLISH_PLATFORM_ORDER.indexOf(
    platform.trim() as (typeof PUBLISH_PLATFORM_ORDER)[number],
  );
  return index === -1 ? PUBLISH_PLATFORM_ORDER.length : index;
}

export function classifyPublishAttempt(row: {
  status?: string | null;
  external_post_id?: string | null;
  next_retry_at?: string | null;
} | null): PublishAttemptOutcome {
  if (!row) return "in_progress";
  if (row.status === "published" || String(row.external_post_id ?? "").trim()) return "published";
  if (row.status === "failed") return "failed";
  if (row.status === "pending" && row.next_retry_at) return "retry_wait";
  return "in_progress";
}

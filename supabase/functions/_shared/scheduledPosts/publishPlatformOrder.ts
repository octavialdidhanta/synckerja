export const PUBLISH_PLATFORM_ORDER = [
  "Facebook",
  "Instagram",
  "LinkedIn",
  "TikTok",
  "YouTube",
] as const;

export function publishPlatformRank(platform: string): number {
  const index = PUBLISH_PLATFORM_ORDER.indexOf(
    platform.trim() as (typeof PUBLISH_PLATFORM_ORDER)[number],
  );
  return index === -1 ? 100 : index;
}

export function compareScheduledPostsForPublish(
  a: { platform: string; platform_account_id?: string | null },
  b: { platform: string; platform_account_id?: string | null },
): number {
  const rank = publishPlatformRank(a.platform) - publishPlatformRank(b.platform);
  if (rank !== 0) return rank;
  return String(a.platform_account_id ?? "").localeCompare(String(b.platform_account_id ?? ""));
}

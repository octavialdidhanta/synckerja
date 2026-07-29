export type ScheduleRow = {
  id: string;
  platform: string;
  status: string;
  created_at: string;
  published_at: string | null;
  provider_config: Record<string, unknown> | null;
  platform_account_id?: string | null;
};

const ACTIVE_STATUSES = new Set(["pending", "publishing"]);

export function getAccountIdFromProviderConfig(
  platform: string,
  providerConfig: Record<string, unknown> | null | undefined,
): string | null {
  const cfg = providerConfig ?? {};
  switch (platform.trim()) {
    case "TikTok":
      return String(cfg.open_id ?? "").trim() || null;
    case "YouTube":
      return String(cfg.channel_id ?? "").trim() || null;
    case "Instagram":
      return String(cfg.instagram_business_account_id ?? "").trim() || null;
    case "Facebook":
      return String(cfg.facebook_page_id ?? "").trim() || null;
    case "LinkedIn":
      return String(cfg.page_id ?? "").trim() || null;
    default:
      return null;
  }
}

export function pickAccountScheduleForModal(
  rows: ScheduleRow[],
  platform: string,
  accountId: string,
): ScheduleRow | null {
  const accountTrim = accountId.trim();
  const filtered = rows
    .filter((s) => {
      if (s.platform !== platform || s.status === "cancelled") return false;
      const rowAccountId =
        String(s.platform_account_id ?? "").trim()
        || getAccountIdFromProviderConfig(platform, s.provider_config);
      return rowAccountId === accountTrim;
    })
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  if (!filtered.length) return null;
  return filtered.find((s) => ACTIVE_STATUSES.has(s.status)) ?? filtered[0];
}

export function pickPlatformScheduleForModal(
  rows: ScheduleRow[],
  platform: string,
): ScheduleRow | null {
  const filtered = rows
    .filter((s) => s.platform === platform && s.status !== "cancelled")
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  if (!filtered.length) return null;
  return filtered.find((s) => ACTIVE_STATUSES.has(s.status)) ?? filtered[0];
}

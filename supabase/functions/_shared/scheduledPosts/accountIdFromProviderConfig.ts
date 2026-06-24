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
    case "LinkedIn":
      return String(cfg.page_id ?? "").trim() || null;
    default:
      return null;
  }
}

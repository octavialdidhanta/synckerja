export const TIKTOK_ADS_DIGITAL_MARKETING_BASE_PATH = "/digital-marketing/tiktok-ads";
export const TIKTOK_ADS_DIGITAL_MARKETING_SETTINGS_PATH =
  "/digital-marketing/tiktok-ads/settings";
export const TIKTOK_ADS_OMNICHANNEL_SETTINGS_PATH = "/omnichannel/settings/offline-conversion";

export const TIKTOK_ADS_OAUTH_RETURN_PATHS = [
  TIKTOK_ADS_OMNICHANNEL_SETTINGS_PATH,
  TIKTOK_ADS_DIGITAL_MARKETING_SETTINGS_PATH,
] as const;

export type TikTokAdsOAuthReturnPath = (typeof TIKTOK_ADS_OAUTH_RETURN_PATHS)[number];

export function isTikTokAdsSettingsPath(pathname: string): boolean {
  return (
    pathname === TIKTOK_ADS_DIGITAL_MARKETING_SETTINGS_PATH ||
    pathname.startsWith(TIKTOK_ADS_OMNICHANNEL_SETTINGS_PATH)
  );
}

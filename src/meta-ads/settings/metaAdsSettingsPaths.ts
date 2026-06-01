export const META_ADS_DIGITAL_MARKETING_BASE_PATH = "/digital-marketing/meta-ads";
export const META_ADS_DIGITAL_MARKETING_SETTINGS_PATH =
  "/digital-marketing/meta-ads/settings";
export const META_ADS_OMNICHANNEL_SETTINGS_PATH = "/omnichannel/settings/offline-conversion";

export const META_ADS_OAUTH_RETURN_PATHS = [
  META_ADS_OMNICHANNEL_SETTINGS_PATH,
  META_ADS_DIGITAL_MARKETING_SETTINGS_PATH,
  "/omnichannel/settings/google-ads",
] as const;

export type MetaAdsOAuthReturnPath = (typeof META_ADS_OAUTH_RETURN_PATHS)[number];

export function isMetaAdsSettingsPath(pathname: string): boolean {
  return (
    pathname === META_ADS_DIGITAL_MARKETING_SETTINGS_PATH ||
    pathname.startsWith(META_ADS_OMNICHANNEL_SETTINGS_PATH) ||
    pathname.startsWith("/omnichannel/settings/google-ads")
  );
}

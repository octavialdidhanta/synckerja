export const GOOGLE_ADS_DIGITAL_MARKETING_BASE_PATH = "/digital-marketing/google-ads";
export const GOOGLE_ADS_DIGITAL_MARKETING_SETTINGS_PATH =
  "/digital-marketing/google-ads/settings";
export const GOOGLE_ADS_OMNICHANNEL_SETTINGS_PATH = "/omnichannel/settings/google-ads";

/** Allowed post-OAuth redirect targets (must match edge function allowlist). */
export const GOOGLE_ADS_OAUTH_RETURN_PATHS = [
  GOOGLE_ADS_OMNICHANNEL_SETTINGS_PATH,
  GOOGLE_ADS_DIGITAL_MARKETING_SETTINGS_PATH,
] as const;

export type GoogleAdsOAuthReturnPath = (typeof GOOGLE_ADS_OAUTH_RETURN_PATHS)[number];

export function isGoogleAdsSettingsPath(pathname: string): boolean {
  return (
    pathname === GOOGLE_ADS_DIGITAL_MARKETING_SETTINGS_PATH ||
    pathname.startsWith(`${GOOGLE_ADS_OMNICHANNEL_SETTINGS_PATH}`)
  );
}

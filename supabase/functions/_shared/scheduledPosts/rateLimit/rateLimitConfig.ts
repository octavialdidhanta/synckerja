export const PER_ORG_PER_TICK = 3;
export const RATE_WINDOW_MINUTES = 5;
export const DEFAULT_MAX_PER_ORG_WINDOW = 3;
/** @deprecated Use loadSchedulerConfig().tiktok_global_in_flight */
export const TIKTOK_GLOBAL_IN_FLIGHT = 12;
export const INTERNAL_DEFER_SECONDS = 90;
export const INTERNAL_DEFER_JITTER_SECONDS = 15;

export type RateLimitDeferReason = "rate_limited:org" | "rate_limited:platform" | "rate_limited:global";

/** @deprecated Use globalInFlightCapForPlatform from config/globalInFlightCap.ts */
export function globalInFlightCapForPlatform(platform: string): number | null {
  if (platform === "TikTok") return TIKTOK_GLOBAL_IN_FLIGHT;
  if (platform === "YouTube") return 6;
  if (platform === "Instagram") return 4;
  if (platform === "LinkedIn") return 4;
  return null;
}

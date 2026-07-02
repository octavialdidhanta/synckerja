import type { SchedulerConfig } from "./schedulerConfigTypes.ts";

const PLATFORM_IN_FLIGHT_KEYS: Record<string, keyof SchedulerConfig> = {
  TikTok: "tiktok_global_in_flight",
  YouTube: "youtube_global_in_flight",
  Instagram: "instagram_global_in_flight",
  Facebook: "facebook_global_in_flight",
  LinkedIn: "linkedin_global_in_flight",
};

export function globalInFlightCapForPlatform(
  platform: string,
  config: SchedulerConfig,
): number | null {
  const key = PLATFORM_IN_FLIGHT_KEYS[platform.trim()];
  if (!key) return null;
  const cap = config[key];
  return typeof cap === "number" && cap > 0 ? cap : null;
}

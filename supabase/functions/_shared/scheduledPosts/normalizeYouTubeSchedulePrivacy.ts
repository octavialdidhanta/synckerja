export const YOUTUBE_SCHEDULE_PRIVACY_LEVELS = ["PUBLIC", "UNLISTED", "PRIVATE"] as const;

export type YouTubeSchedulePrivacyLevel = (typeof YOUTUBE_SCHEDULE_PRIVACY_LEVELS)[number];

export const DEFAULT_YOUTUBE_SCHEDULE_PRIVACY: YouTubeSchedulePrivacyLevel = "PUBLIC";

export function normalizeYouTubeSchedulePrivacy(raw: unknown): YouTubeSchedulePrivacyLevel | null {
  const level = String(raw ?? "").trim().toUpperCase();
  if ((YOUTUBE_SCHEDULE_PRIVACY_LEVELS as readonly string[]).includes(level)) {
    return level as YouTubeSchedulePrivacyLevel;
  }
  return null;
}

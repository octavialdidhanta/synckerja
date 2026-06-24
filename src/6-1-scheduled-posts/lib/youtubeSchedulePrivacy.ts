export const YOUTUBE_SCHEDULE_PRIVACY_LEVELS = ['PUBLIC', 'UNLISTED', 'PRIVATE'] as const;

export type YouTubeSchedulePrivacyLevel = (typeof YOUTUBE_SCHEDULE_PRIVACY_LEVELS)[number];

export const DEFAULT_YOUTUBE_SCHEDULE_PRIVACY: YouTubeSchedulePrivacyLevel = 'PUBLIC';

export function isYouTubeSchedulePrivacyLevel(value: unknown): value is YouTubeSchedulePrivacyLevel {
  const level = String(value ?? '').trim().toUpperCase();
  return (YOUTUBE_SCHEDULE_PRIVACY_LEVELS as readonly string[]).includes(level);
}

export function normalizeYouTubeSchedulePrivacyLevel(value: unknown): YouTubeSchedulePrivacyLevel | null {
  const level = String(value ?? '').trim().toUpperCase();
  return isYouTubeSchedulePrivacyLevel(level) ? level : null;
}

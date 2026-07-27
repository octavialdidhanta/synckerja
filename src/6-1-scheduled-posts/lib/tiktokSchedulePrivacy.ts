export const TIKTOK_SCHEDULE_PRIVACY_LEVELS = [
  'PUBLIC_TO_EVERYONE',
  'FOLLOWER_OF_CREATOR',
  'MUTUAL_FOLLOW_FRIENDS',
  'SELF_ONLY',
] as const;

export type TikTokSchedulePrivacyLevel = (typeof TIKTOK_SCHEDULE_PRIVACY_LEVELS)[number];

/**
 * Default after Direct Post audit approval (Synckerja Office — Live).
 * Runtime still respects creator_info.privacy_level_options from TikTok.
 */
export const DEFAULT_TIKTOK_SCHEDULE_PRIVACY: TikTokSchedulePrivacyLevel = 'PUBLIC_TO_EVERYONE';

export function isTikTokSchedulePrivacyLevel(value: unknown): value is TikTokSchedulePrivacyLevel {
  const level = String(value ?? '').trim().toUpperCase();
  return (TIKTOK_SCHEDULE_PRIVACY_LEVELS as readonly string[]).includes(level);
}

export function normalizeTikTokSchedulePrivacyLevel(value: unknown): TikTokSchedulePrivacyLevel | null {
  const level = String(value ?? '').trim().toUpperCase();
  return isTikTokSchedulePrivacyLevel(level) ? level : null;
}

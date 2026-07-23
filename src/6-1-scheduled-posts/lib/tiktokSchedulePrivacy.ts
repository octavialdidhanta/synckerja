export const TIKTOK_SCHEDULE_PRIVACY_LEVELS = [
  'SELF_ONLY',
  'PUBLIC_TO_EVERYONE',
  'FOLLOWER_OF_CREATOR',
  'MUTUAL_FOLLOW_FRIENDS',
] as const;

export type TikTokSchedulePrivacyLevel = (typeof TIKTOK_SCHEDULE_PRIVACY_LEVELS)[number];

/**
 * Default while Direct Post audit is pending.
 * Unaudited apps can only post SELF_ONLY to Private TikTok accounts.
 */
export const DEFAULT_TIKTOK_SCHEDULE_PRIVACY: TikTokSchedulePrivacyLevel = 'SELF_ONLY';

export function isTikTokSchedulePrivacyLevel(value: unknown): value is TikTokSchedulePrivacyLevel {
  const level = String(value ?? '').trim().toUpperCase();
  return (TIKTOK_SCHEDULE_PRIVACY_LEVELS as readonly string[]).includes(level);
}

export function normalizeTikTokSchedulePrivacyLevel(value: unknown): TikTokSchedulePrivacyLevel | null {
  const level = String(value ?? '').trim().toUpperCase();
  return isTikTokSchedulePrivacyLevel(level) ? level : null;
}

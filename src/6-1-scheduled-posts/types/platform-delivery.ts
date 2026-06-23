export const AUTO_SCHEDULE_PLATFORMS = ['TikTok'] as const;
export type AutoSchedulePlatform = (typeof AUTO_SCHEDULE_PLATFORMS)[number];

export function platformSupportsAutoSchedule(platform: string): boolean {
  return AUTO_SCHEDULE_PLATFORMS.includes(platform.trim() as AutoSchedulePlatform);
}

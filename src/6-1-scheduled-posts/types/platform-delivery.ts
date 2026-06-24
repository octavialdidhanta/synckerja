export const PLATFORM_DELIVERY_CONFIG = {
  TikTok: { deliveryMode: 'api_auto' as const, scheduleReady: true },
  Instagram: { deliveryMode: 'api_auto' as const, scheduleReady: true },
  Facebook: { deliveryMode: 'manual_only' as const, scheduleReady: false },
  YouTube: { deliveryMode: 'api_auto' as const, scheduleReady: true },
  LinkedIn: { deliveryMode: 'api_auto' as const, scheduleReady: true },
} as const;

export type PlatformDeliveryKey = keyof typeof PLATFORM_DELIVERY_CONFIG;

export const AUTO_SCHEDULE_PLATFORMS = (
  Object.entries(PLATFORM_DELIVERY_CONFIG) as [PlatformDeliveryKey, (typeof PLATFORM_DELIVERY_CONFIG)[PlatformDeliveryKey]][]
)
  .filter(([, cfg]) => cfg.scheduleReady)
  .map(([platform]) => platform) as readonly PlatformDeliveryKey[];

export type AutoSchedulePlatform = (typeof AUTO_SCHEDULE_PLATFORMS)[number];

export function platformSupportsAutoSchedule(platform: string): boolean {
  const key = platform.trim() as PlatformDeliveryKey;
  return PLATFORM_DELIVERY_CONFIG[key]?.scheduleReady === true;
}

export function getPlatformDeliveryMode(platform: string): 'api_auto' | 'manual_only' | null {
  const key = platform.trim() as PlatformDeliveryKey;
  return PLATFORM_DELIVERY_CONFIG[key]?.deliveryMode ?? null;
}

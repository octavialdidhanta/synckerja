export type PlatformStubCode = "manual_only" | "not_implemented";

export type PlatformScheduleCapability =
  | { deliveryMode: "api_auto"; implemented: true }
  | { deliveryMode: "manual_only"; implemented: false; stubCode: "manual_only" }
  | { deliveryMode: "api_auto"; implemented: false; stubCode: "not_implemented" };

export const PLATFORM_SCHEDULE_REGISTRY: Record<string, PlatformScheduleCapability> = {
  TikTok: { deliveryMode: "api_auto", implemented: true },
  Instagram: { deliveryMode: "api_auto", implemented: true },
  Facebook: { deliveryMode: "manual_only", implemented: false, stubCode: "manual_only" },
  YouTube: { deliveryMode: "api_auto", implemented: true },
  LinkedIn: { deliveryMode: "api_auto", implemented: true },
};

export function normalizeSchedulePlatform(platform: string): string {
  return platform.trim();
}

export function getPlatformScheduleCapability(platform: string): PlatformScheduleCapability | null {
  const key = normalizeSchedulePlatform(platform);
  return PLATFORM_SCHEDULE_REGISTRY[key] ?? null;
}

export function assertPlatformCanSchedule(platform: string): void {
  const capability = getPlatformScheduleCapability(platform);
  if (!capability) {
    throw new Error(`schedule_stub:not_implemented:${normalizeSchedulePlatform(platform)}:Unknown platform`);
  }
  if (!capability.implemented) {
    throw new Error(
      `schedule_stub:${capability.stubCode}:${normalizeSchedulePlatform(platform)}:${capability.deliveryMode}`,
    );
  }
}

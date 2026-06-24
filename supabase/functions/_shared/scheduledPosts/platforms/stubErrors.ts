import type { PlatformStubCode } from "../platformRegistry.ts";

const STUB_MESSAGES: Record<PlatformStubCode, string> = {
  manual_only:
    "Auto-schedule is not available for this platform. Add the post link manually in the publish modal.",
  not_implemented:
    "API auto-publish for this platform is not implemented yet.",
};

export function buildScheduleStubError(
  stubCode: PlatformStubCode,
  platform: string,
  deliveryMode: string,
): string {
  const base = STUB_MESSAGES[stubCode];
  return `schedule_stub:${stubCode}:${platform}:${deliveryMode} — ${base}`;
}

export function isScheduleStubError(message: string): boolean {
  return message.startsWith("schedule_stub:");
}

export function parseScheduleStubError(
  message: string,
): { stubCode: PlatformStubCode; platform: string } | null {
  if (!isScheduleStubError(message)) return null;
  const parts = message.split(":");
  if (parts.length < 3) return null;
  const stubCode = parts[1] as PlatformStubCode;
  const platform = parts[2];
  if (stubCode !== "manual_only" && stubCode !== "not_implemented") return null;
  return { stubCode, platform };
}

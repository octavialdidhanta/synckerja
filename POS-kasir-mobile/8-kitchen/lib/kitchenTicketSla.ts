import { POS_KITCHEN_I18N } from "./kitchenTicketStatus";

export type KitchenSlaBucket = "ok" | "warn" | "critical";

/** Minutes elapsed before SLA ring turns amber. */
export const KITCHEN_SLA_WARN_MINUTES = 10;
/** Minutes elapsed before SLA ring turns red. */
export const KITCHEN_SLA_CRITICAL_MINUTES = 20;
/** Ring fills toward critical at this duration (ms). */
export const KITCHEN_SLA_RING_FULL_MS = KITCHEN_SLA_CRITICAL_MINUTES * 60_000;

export function kitchenSlaBucket(elapsedMs: number): KitchenSlaBucket {
  const minutes = Math.floor(Math.max(0, elapsedMs) / 60_000);
  if (minutes >= KITCHEN_SLA_CRITICAL_MINUTES) return "critical";
  if (minutes >= KITCHEN_SLA_WARN_MINUTES) return "warn";
  return "ok";
}

export function kitchenSlaRingColor(
  bucket: KitchenSlaBucket,
  statusColors?: { on_time: string; caution: string; late: string },
): string {
  if (statusColors) {
    if (bucket === "critical") return statusColors.late;
    if (bucket === "warn") return statusColors.caution;
    return statusColors.on_time;
  }
  if (bucket === "critical") return "#DC2626";
  if (bucket === "warn") return "#D97706";
  return "#64748B";
}

export function kitchenSlaRingProgress(elapsedMs: number): number {
  return Math.min(1, Math.max(0, elapsedMs / KITCHEN_SLA_RING_FULL_MS));
}

type TranslateFn = (key: string, fallback: string, vars?: Record<string, string | number>) => string;

/**
 * Mockup-style live label: `5 Sec`, `12 Min`, `1h 12m`.
 */
export function formatKitchenWaitDuration(
  elapsedMs: number,
  t: TranslateFn,
): string {
  const totalSeconds = Math.floor(Math.max(0, elapsedMs) / 1_000);
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return t(POS_KITCHEN_I18N.waitHoursMinutes, "{{h}}h {{m}}m", {
      h: hours,
      m: minutes,
    });
  }
  if (minutes > 0) {
    return t(POS_KITCHEN_I18N.waitMinutesLabel, "{{m}} Min", { m: minutes });
  }
  return t(POS_KITCHEN_I18N.waitSecondsLabel, "{{s}} Sec", { s: seconds });
}

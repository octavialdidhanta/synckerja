export function isInternalRateLimitMessage(message: string): boolean {
  return message.startsWith("rate_limited:");
}

export function parseRetryAfterSeconds(message: string): number | null {
  const match = message.match(/retry-after:(\d+)/i);
  if (!match) return null;
  const seconds = parseInt(match[1], 10);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

/** ISO timestamp after TikTok HTTP 429 Retry-After (clamped 60s–15m). */
export function computeNextRetryAtFrom429(retryAfterSeconds?: number): string {
  const seconds = Math.min(900, Math.max(60, retryAfterSeconds ?? 120));
  return new Date(Date.now() + seconds * 1000).toISOString();
}

/** Transient TikTok / network errors — keep schedule pending and retry via cron. */
export function isTransientScheduledPublishError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    /\bhttp\s*503\b/.test(m) ||
    /\bhttp\s*502\b/.test(m) ||
    /\bhttp\s*504\b/.test(m) ||
    /\bhttp\s*429\b/.test(m) ||
    m.includes("publish_timeout") ||
    m.includes("econnreset") ||
    m.includes("network error")
  );
}

export function isTransientYouTubePublishError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    isTransientScheduledPublishError(message) ||
    m.includes("quotaexceeded") ||
    m.includes("uploadtimeout") ||
    m.includes("processing_timeout") ||
    m.includes("backenderror")
  );
}

export function isTransientMetaPublishError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    isTransientScheduledPublishError(message) ||
    m.includes("application request limit") ||
    m.includes("(#4)") ||
    m.includes("(#613)") ||
    m.includes("media_not_ready") ||
    m.includes("transient")
  );
}

export function isTransientLinkedInPublishError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    isTransientScheduledPublishError(message) ||
    m.includes("throttle") ||
    m.includes("rate limit") ||
    m.includes("service unavailable")
  );
}

export function isTransientPublishErrorForPlatform(platform: string, message: string): boolean {
  switch (platform.trim()) {
    case "TikTok":
      return isTransientScheduledPublishError(message);
    case "YouTube":
      return isTransientYouTubePublishError(message);
    case "Instagram":
      return isTransientMetaPublishError(message);
    case "LinkedIn":
      return isTransientLinkedInPublishError(message);
    default:
      return isTransientScheduledPublishError(message);
  }
}

export const SCHEDULED_POST_MAX_RETRIES_TRANSIENT = 8;
export const SCHEDULED_POST_MAX_RETRIES_DEFAULT = 2;

const RETRY_BACKOFF_MINUTES = [2, 5, 15, 30, 60] as const;

export function resolveScheduleStatusAfterFailure(
  retryCount: number,
  errorMessage: string,
  platform?: string,
): "pending" | "failed" {
  const max = isTransientPublishErrorForPlatform(platform ?? "TikTok", errorMessage)
    ? SCHEDULED_POST_MAX_RETRIES_TRANSIENT
    : SCHEDULED_POST_MAX_RETRIES_DEFAULT;
  return retryCount >= max ? "failed" : "pending";
}

/** ISO timestamp for next claim attempt; null when row should stay failed. */
export function computeNextRetryAt(
  retryCount: number,
  errorMessage: string,
  platform?: string,
): string | null {
  const nextStatus = resolveScheduleStatusAfterFailure(retryCount, errorMessage, platform);
  if (nextStatus === "failed") return null;

  const retryAfterSeconds = parseRetryAfterSeconds(errorMessage);
  if (retryAfterSeconds !== null) {
    return computeNextRetryAtFrom429(retryAfterSeconds);
  }

  const idx = Math.min(Math.max(retryCount, 1), RETRY_BACKOFF_MINUTES.length) - 1;
  const minutes = RETRY_BACKOFF_MINUTES[idx] ?? 60;
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

export function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

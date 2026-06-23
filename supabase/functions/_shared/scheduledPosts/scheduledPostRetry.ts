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

export const SCHEDULED_POST_MAX_RETRIES_TRANSIENT = 8;
export const SCHEDULED_POST_MAX_RETRIES_DEFAULT = 2;

export function resolveScheduleStatusAfterFailure(
  retryCount: number,
  errorMessage: string,
): "pending" | "failed" {
  const max = isTransientScheduledPublishError(errorMessage)
    ? SCHEDULED_POST_MAX_RETRIES_TRANSIENT
    : SCHEDULED_POST_MAX_RETRIES_DEFAULT;
  return retryCount >= max ? "failed" : "pending";
}

export function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

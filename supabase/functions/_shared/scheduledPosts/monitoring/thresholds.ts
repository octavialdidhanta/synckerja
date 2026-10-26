/** Grace after scheduled_at before counting as late (1-min cron + buffer). */
export const PENDING_LATE_GRACE_MINUTES = 3;

/**
 * No heartbeat for this long means the worker died.
 * Live uploads refresh locked_at; a single byte upload times out sooner than this.
 */
export const STUCK_PUBLISHING_MINUTES = 10;

/** Window for recent failures in monitoring. */
export const FAILED_MONITORING_HOURS = 24;

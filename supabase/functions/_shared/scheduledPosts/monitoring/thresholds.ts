/** Grace after scheduled_at before counting as late (1-min cron + buffer). */
export const PENDING_LATE_GRACE_MINUTES = 3;

/** Max time in publishing before counting as stuck (video upload). */
export const STUCK_PUBLISHING_MINUTES = 20;

/** Window for recent failures in monitoring. */
export const FAILED_MONITORING_HOURS = 24;

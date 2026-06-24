import { isSchedulerDryRunEnvEnabled } from "../config/loadSchedulerConfig.ts";
import type { ScheduledPostRow } from "../scheduledPostTypes.ts";

export function isLoadTestScheduleRow(schedule: ScheduledPostRow): boolean {
  const providerConfig = schedule.provider_config ?? {};
  if (providerConfig.load_test === true || providerConfig.load_test === "true") {
    return true;
  }
  const snapshot = String(schedule.media_url_snapshot ?? "");
  return snapshot.startsWith("load-test://");
}

export function shouldDryRunPublish(schedule: ScheduledPostRow): boolean {
  if (!isSchedulerDryRunEnvEnabled()) return false;
  return isLoadTestScheduleRow(schedule);
}

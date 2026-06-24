import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  FAILED_MONITORING_HOURS,
  PENDING_LATE_GRACE_MINUTES,
  STUCK_PUBLISHING_MINUTES,
} from "./thresholds.ts";

export type ScheduleMonitoringSummary = {
  pending_late_count: number;
  stuck_publishing_count: number;
  failed_24h_count: number;
  rate_deferred_count: number;
  pending_due_now_count: number;
};

function minutesAgoIso(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function hoursAgoIso(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}

async function fetchMonitoringSummaryFallback(
  admin: SupabaseClient,
): Promise<ScheduleMonitoringSummary> {
  const pendingLateBefore = minutesAgoIso(PENDING_LATE_GRACE_MINUTES);
  const stuckPublishingBefore = minutesAgoIso(STUCK_PUBLISHING_MINUTES);
  const failedSince = hoursAgoIso(FAILED_MONITORING_HOURS);

  const [pendingLate, stuckPublishing, failed24h] = await Promise.all([
    admin
      .from("social_media_scheduled_posts")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .lt("scheduled_at", pendingLateBefore),
    admin
      .from("social_media_scheduled_posts")
      .select("id", { count: "exact", head: true })
      .eq("status", "publishing")
      .lt("updated_at", stuckPublishingBefore),
    admin
      .from("social_media_scheduled_posts")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed")
      .gte("updated_at", failedSince),
  ]);

  return {
    pending_late_count: pendingLate.count ?? 0,
    stuck_publishing_count: stuckPublishing.count ?? 0,
    failed_24h_count: failed24h.count ?? 0,
    rate_deferred_count: 0,
    pending_due_now_count: 0,
  };
}

export async function fetchScheduleMonitoringSummary(
  admin: SupabaseClient,
): Promise<ScheduleMonitoringSummary> {
  const { data, error } = await admin.rpc("get_social_media_schedule_monitoring_summary");
  if (error || !data || typeof data !== "object") {
    console.warn("fetchScheduleMonitoringSummary rpc fallback:", error?.message);
    return fetchMonitoringSummaryFallback(admin);
  }

  const row = data as Record<string, unknown>;
  const summary: ScheduleMonitoringSummary = {
    pending_late_count: Number(row.pending_late_count ?? 0),
    stuck_publishing_count: Number(row.stuck_publishing_count ?? 0),
    failed_24h_count: Number(row.failed_24h_count ?? 0),
    rate_deferred_count: Number(row.rate_deferred_count ?? 0),
    pending_due_now_count: Number(row.pending_due_now_count ?? 0),
  };

  if (
    summary.pending_late_count > 0 ||
    summary.stuck_publishing_count > 0 ||
    summary.failed_24h_count > 0 ||
    summary.rate_deferred_count > 0
  ) {
    console.warn("social-media-scheduler monitoring:", JSON.stringify(summary));
  }

  return summary;
}

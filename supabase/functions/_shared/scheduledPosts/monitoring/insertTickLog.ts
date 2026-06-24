import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { SchedulerConfig } from "../config/schedulerConfigTypes.ts";
import type { ScheduleMonitoringSummary } from "./queries.ts";

export type TickLogInput = {
  startedAt: Date;
  finishedAt: Date;
  durationMs: number;
  dryRun: boolean;
  claimed: number;
  resumed: number;
  processed: number;
  publishedOk: number;
  deferredRateLimited: number;
  failed: number;
  recoveredStale: number;
  monitoring: ScheduleMonitoringSummary;
  config: SchedulerConfig;
};

export async function insertTickLog(
  admin: SupabaseClient,
  input: TickLogInput,
): Promise<void> {
  const { error } = await admin.from("social_media_scheduler_tick_logs").insert({
    started_at: input.startedAt.toISOString(),
    finished_at: input.finishedAt.toISOString(),
    duration_ms: input.durationMs,
    dry_run: input.dryRun,
    claimed: input.claimed,
    resumed: input.resumed,
    processed: input.processed,
    published_ok: input.publishedOk,
    deferred_rate_limited: input.deferredRateLimited,
    failed: input.failed,
    recovered_stale: input.recoveredStale,
    pending_due_now: input.monitoring.pending_due_now_count,
    pending_late: input.monitoring.pending_late_count,
    rate_deferred: input.monitoring.rate_deferred_count,
    config_snapshot: input.config,
  });

  if (error) {
    console.warn("insertTickLog failed:", error.message);
  }
}

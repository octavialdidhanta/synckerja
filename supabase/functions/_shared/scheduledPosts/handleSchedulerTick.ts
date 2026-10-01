import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { SchedulerConfig } from "./config/schedulerConfigTypes.ts";
import { isSchedulerDryRunEnvEnabled, loadSchedulerConfig } from "./config/loadSchedulerConfig.ts";
import {
  claimDueScheduledPosts,
  claimResumePublishingPosts,
} from "./claim/claimDueScheduledPosts.ts";
import { recoverStalePublishingRows } from "./claim/recoverStalePublishing.ts";
import { insertTickLog } from "./monitoring/insertTickLog.ts";
import { fetchScheduleMonitoringSummary } from "./monitoring/queries.ts";
import { runWithConcurrency } from "./process/runWithConcurrency.ts";
import { clearOrgRateLimitCache } from "./rateLimit/acquirePublishSlot.ts";
import { runScheduledPostJob } from "./runScheduledPostJob.ts";
import type { RunScheduledPostJobResult } from "./runScheduledPostJob.ts";
import { instagramPublishShouldFollowPeers } from "./sharedPublishContext.ts";
import type { ScheduledPostRow } from "./scheduledPostTypes.ts";

/** @deprecated Use loadSchedulerConfig — kept for imports that read batch default. */
export const SCHEDULER_BATCH_SIZE = 20;
export const SCHEDULER_RESUME_BATCH_SIZE = 10;

/** pg_cron HTTP timeout is 45s. Leave headroom before starting another video upload. */
const SCHEDULER_UPLOAD_BUDGET_MS = 40_000;

export type SchedulerTickResult = {
  processed: number;
  claimed: number;
  resumed: number;
  recovered_stale: number;
  deferred_rate_limited: number;
  published_ok: number;
  failed: number;
  batch_size: number;
  duration_ms: number;
  dry_run: boolean;
  config_snapshot: SchedulerConfig;
  results: RunScheduledPostJobResult[];
  monitoring: Awaited<ReturnType<typeof fetchScheduleMonitoringSummary>>;
};

function tallyResults(results: RunScheduledPostJobResult[]): {
  deferredRateLimited: number;
  publishedOk: number;
  failed: number;
} {
  let deferredRateLimited = 0;
  let publishedOk = 0;
  let failed = 0;

  for (const result of results) {
    if (result.deferred) deferredRateLimited += 1;
    else if (result.ok && !result.skipped) publishedOk += 1;
    else if (!result.ok && !result.skipped) failed += 1;
  }

  return { deferredRateLimited, publishedOk, failed };
}

async function releaseInstagramForNextTick(
  admin: SupabaseClient,
  row: ScheduledPostRow,
): Promise<RunScheduledPostJobResult> {
  const now = new Date().toISOString();
  const nextRetryAt = new Date(Date.now() + 15_000).toISOString();
  await admin
    .from("social_media_scheduled_posts")
    .update({
      status: "pending",
      locked_at: null,
      next_retry_at: nextRetryAt,
      updated_at: now,
    })
    .eq("id", row.id)
    .eq("status", "publishing");

  return {
    id: row.id,
    ok: false,
    platform: row.platform,
    deferred: "instagram_after_peers",
  };
}

async function processClaimedRows(
  admin: SupabaseClient,
  rows: Awaited<ReturnType<typeof claimDueScheduledPosts>>,
  config: SchedulerConfig,
  tickStartMs: number,
): Promise<RunScheduledPostJobResult[]> {
  if (rows.length === 0) return [];

  const runRow = (row: ScheduledPostRow) =>
    runScheduledPostJob(admin, row.id, {
      preloadedRow: row,
      fromClaim: true,
      schedulerConfig: config,
    });

  const instagramAfterPeers = rows.filter((row) => instagramPublishShouldFollowPeers(row));
  const withPeers = rows.filter((row) => !instagramPublishShouldFollowPeers(row));

  const peerResults = await runWithConcurrency(withPeers, config.tick_concurrency, runRow);
  const instagramResults: RunScheduledPostJobResult[] = [];

  for (const row of instagramAfterPeers) {
    if (Date.now() - tickStartMs > SCHEDULER_UPLOAD_BUDGET_MS) {
      instagramResults.push(await releaseInstagramForNextTick(admin, row));
      continue;
    }
    instagramResults.push(await runRow(row));
  }

  return [...peerResults, ...instagramResults];
}

export async function handleSchedulerTick(
  admin: SupabaseClient,
): Promise<SchedulerTickResult> {
  const startedAt = new Date();
  const tickStartMs = startedAt.getTime();
  const config = await loadSchedulerConfig(admin);
  const dryRunEnv = isSchedulerDryRunEnvEnabled();

  clearOrgRateLimitCache();

  const recoveredStale = await recoverStalePublishingRows(admin);
  const claimedResume = await claimResumePublishingPosts(admin, config.resume_batch_size);
  const resumeResults = await processClaimedRows(admin, claimedResume, config, tickStartMs);

  let totalClaimed = 0;
  const allResults: RunScheduledPostJobResult[] = [...resumeResults];

  while (Date.now() - tickStartMs < config.tick_time_budget_ms) {
    const remainingMs = config.tick_time_budget_ms - (Date.now() - tickStartMs);
    if (remainingMs < 500) break;

    const claimLimit = Math.min(config.batch_size, config.tick_concurrency);
    const claimedPending = await claimDueScheduledPosts(
      admin,
      claimLimit,
      config.per_org_per_tick,
    );
    if (claimedPending.length === 0) break;

    totalClaimed += claimedPending.length;
    const batchResults = await processClaimedRows(
      admin,
      claimedPending,
      config,
      tickStartMs,
    );
    allResults.push(...batchResults);
  }

  const { deferredRateLimited, publishedOk, failed } = tallyResults(allResults);
  const monitoring = await fetchScheduleMonitoringSummary(admin);
  const finishedAt = new Date();
  const durationMs = finishedAt.getTime() - tickStartMs;

  await insertTickLog(admin, {
    startedAt,
    finishedAt,
    durationMs,
    dryRun: dryRunEnv,
    claimed: totalClaimed,
    resumed: claimedResume.length,
    processed: allResults.length,
    publishedOk,
    deferredRateLimited,
    failed,
    recoveredStale,
    monitoring,
    config,
  });

  return {
    processed: allResults.length,
    claimed: totalClaimed,
    resumed: claimedResume.length,
    recovered_stale: recoveredStale,
    deferred_rate_limited: deferredRateLimited,
    published_ok: publishedOk,
    failed,
    batch_size: config.batch_size,
    duration_ms: durationMs,
    dry_run: dryRunEnv,
    config_snapshot: config,
    results: allResults,
    monitoring,
  };
}

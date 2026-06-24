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

/** @deprecated Use loadSchedulerConfig — kept for imports that read batch default. */
export const SCHEDULER_BATCH_SIZE = 20;
export const SCHEDULER_RESUME_BATCH_SIZE = 10;

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

async function processClaimedRows(
  admin: SupabaseClient,
  rows: Awaited<ReturnType<typeof claimDueScheduledPosts>>,
  config: SchedulerConfig,
): Promise<RunScheduledPostJobResult[]> {
  if (rows.length === 0) return [];

  return runWithConcurrency(rows, config.tick_concurrency, (row) =>
    runScheduledPostJob(admin, row.id, {
      preloadedRow: row,
      fromClaim: true,
      schedulerConfig: config,
    })
  );
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
  const resumeResults = await processClaimedRows(admin, claimedResume, config);

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

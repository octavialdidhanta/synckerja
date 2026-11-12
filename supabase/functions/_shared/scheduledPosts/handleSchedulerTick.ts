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
import { syncPlanCompletionStateForPlan } from "./syncPlanCompletionStateDb.ts";
import { compareScheduledPostsForPublish } from "./publishPlatformOrder.ts";
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

function groupRowsByPlan(rows: ScheduledPostRow[]): ScheduledPostRow[][] {
  const groups: ScheduledPostRow[][] = [];
  const indexByPlan = new Map<string, number>();
  for (const row of rows) {
    const key = row.social_media_plan_id || row.id;
    const existing = indexByPlan.get(key);
    if (existing === undefined) {
      indexByPlan.set(key, groups.length);
      groups.push([row]);
    } else {
      groups[existing].push(row);
    }
  }
  return groups;
}

function tallyResults(results: RunScheduledPostJobResult[]): {
  deferredRateLimited: number;
  publishedOk: number;
  failed: number;
} {
  let deferredRateLimited = 0;
  let publishedOk = 0;
  let failed = 0;

  for (const result of results) {
    if (result.deferred === "rate_limit" || result.deferred === "rate_limit_global") {
      deferredRateLimited += 1;
    }
    else if (result.ok && !result.skipped) publishedOk += 1;
    else if (!result.ok && !result.skipped) failed += 1;
  }

  return { deferredRateLimited, publishedOk, failed };
}

async function releaseRowForNextTick(
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
    deferred: "tick_budget",
  };
}

async function processClaimedRows(
  admin: SupabaseClient,
  rows: Awaited<ReturnType<typeof claimDueScheduledPosts>>,
  config: SchedulerConfig,
  tickStartMs: number,
): Promise<RunScheduledPostJobResult[]> {
  if (rows.length === 0) return [];

  const ordered = [...rows].sort((a, b) =>
    compareScheduledPostsForPublish(
      {
        platform: a.platform,
        platform_account_id: String((a as { platform_account_id?: string }).platform_account_id ?? ""),
      },
      {
        platform: b.platform,
        platform_account_id: String((b as { platform_account_id?: string }).platform_account_id ?? ""),
      },
    )
  );
  const groups = groupRowsByPlan(ordered).map((group) =>
    [...group].sort((a, b) =>
      compareScheduledPostsForPublish(
        {
          platform: a.platform,
          platform_account_id: String((a as { platform_account_id?: string }).platform_account_id ?? ""),
        },
        {
          platform: b.platform,
          platform_account_id: String((b as { platform_account_id?: string }).platform_account_id ?? ""),
        },
      )
    )
  );

  const groupResults = await runWithConcurrency(
    groups,
    config.tick_concurrency,
    async (group) => {
      const results: RunScheduledPostJobResult[] = [];
      for (const row of group) {
        if (Date.now() - tickStartMs > SCHEDULER_UPLOAD_BUDGET_MS) {
          results.push(await releaseRowForNextTick(admin, row));
          continue;
        }
        const result = await runScheduledPostJob(admin, row.id, {
          preloadedRow: row,
          fromClaim: true,
          schedulerConfig: config,
        });
        results.push(result);
        if (!result.ok) {
          for (const waiting of group.slice(group.indexOf(row) + 1)) {
            results.push(await releaseRowForNextTick(admin, waiting));
          }
          break;
        }
      }
      return results;
    },
  );

  return groupResults.flat();
}

/** Plans published before completion sync ran after status=published stay done=false. */
async function reconcileStuckPublishedPlans(admin: SupabaseClient): Promise<void> {
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const { data: rows, error } = await admin
    .from("social_media_scheduled_posts")
    .select("social_media_plan_id")
    .eq("status", "published")
    .gte("published_at", since)
    .order("published_at", { ascending: false })
    .limit(80);
  if (error || !rows?.length) return;

  const planIds = [
    ...new Set(
      rows
        .map((row) => String(row.social_media_plan_id ?? "").trim())
        .filter(Boolean),
    ),
  ];
  if (!planIds.length) return;

  const { data: plans } = await admin
    .from("social_media_plans")
    .select("id")
    .in("id", planIds)
    .eq("done", false)
    .limit(15);

  for (const plan of plans ?? []) {
    await syncPlanCompletionStateForPlan(admin, String(plan.id));
  }
}

export async function handleSchedulerTick(
  admin: SupabaseClient,
): Promise<SchedulerTickResult> {
  const startedAt = new Date();
  const tickStartMs = startedAt.getTime();
  const config = await loadSchedulerConfig(admin);
  const dryRunEnv = isSchedulerDryRunEnvEnabled();

  clearOrgRateLimitCache();
  await reconcileStuckPublishedPlans(admin);

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

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { executeScheduledPost } from "./executeScheduledPost.ts";
import type { SchedulerConfig } from "./config/schedulerConfigTypes.ts";
import { DEFAULT_SCHEDULER_CONFIG } from "./config/schedulerConfigTypes.ts";
import { shouldDryRunPublish } from "./dryRun/shouldDryRunPublish.ts";
import { parseScheduleStubError, isScheduleStubError } from "./platforms/stubErrors.ts";
import { acquirePublishSlot } from "./rateLimit/acquirePublishSlot.ts";
import { countGlobalInFlightPublishing } from "./rateLimit/countGlobalInFlight.ts";
import { globalInFlightCapForPlatform } from "./config/globalInFlightCap.ts";
import {
  deferForRateLimit,
  isPublishResumeRow,
  stripPublishResumeFlags,
} from "./rateLimit/deferForRateLimit.ts";
import {
  computeNextRetryAt,
  isInternalRateLimitMessage,
  resolveScheduleStatusAfterFailure,
} from "./scheduledPostRetry.ts";
import type { ScheduledPostRow } from "./scheduledPostTypes.ts";
import type { SharedPublishContext } from "./sharedPublishContext.ts";

export type RunScheduledPostJobResult = {
  id: string;
  ok: boolean;
  platform: string;
  error?: string;
  stubCode?: "manual_only" | "not_implemented";
  published_url?: string;
  external_post_id?: string;
  tiktok_publish_path?: "pull" | "file_upload";
  retry_count?: number;
  skipped?: "already_published" | "already_claimed";
  deferred?: "rate_limit" | "rate_limit_global";
};

export type RunScheduledPostJobOptions = {
  /** Row already transitioned to publishing by claim RPC. */
  fromClaim?: boolean;
  /** post_now: row inserted as publishing. */
  skipPublishingTransition?: boolean;
  preloadedRow?: ScheduledPostRow;
  schedulerConfig?: SchedulerConfig;
  /** Shared Drive download for plan bulk orchestrator */
  sharedPublishContext?: SharedPublishContext;
};


async function enforcePublishRateLimits(
  admin: SupabaseClient,
  row: ScheduledPostRow,
  schedulerConfig: SchedulerConfig,
): Promise<
  | { allowed: true }
  | { allowed: false; deferred: "rate_limit" | "rate_limit_global"; reason: string }
> {
  if (shouldDryRunPublish(row)) {
    return { allowed: true };
  }

  const providerConfig = row.provider_config ?? {};
  const isResume = isPublishResumeRow(row.platform, providerConfig);
  const globalCap = globalInFlightCapForPlatform(row.platform, schedulerConfig);

  if (globalCap !== null) {
    const inFlight = await countGlobalInFlightPublishing(admin, row.platform);
    if (inFlight > globalCap) {
      const reason = "rate_limited:global";
      await deferForRateLimit(admin, row.id, reason);
      return { allowed: false, deferred: "rate_limit_global", reason };
    }
  }

  if (!isResume) {
    const acquired = await acquirePublishSlot(admin, row.organization_id, row.platform);
    if (!acquired) {
      const reason = "rate_limited:org";
      await deferForRateLimit(admin, row.id, reason);
      return { allowed: false, deferred: "rate_limit", reason };
    }
  }

  return { allowed: true };
}

export async function runScheduledPostJob(
  admin: SupabaseClient,
  scheduleId: string,
  options?: RunScheduledPostJobOptions,
): Promise<RunScheduledPostJobResult> {
  let row: ScheduledPostRow | null = options?.preloadedRow ?? null;

  if (!row) {
    const { data: schedule, error: schedErr } = await admin
      .from("social_media_scheduled_posts")
      .select("*")
      .eq("id", scheduleId)
      .maybeSingle();

    if (schedErr || !schedule) {
      return { id: scheduleId, ok: false, platform: "unknown", error: "Schedule not found" };
    }
    row = schedule as ScheduledPostRow;
  }

  const platform = row.platform;

  if (row.status === "published" || row.external_post_id) {
    return {
      id: scheduleId,
      ok: true,
      platform,
      published_url: row.published_url ?? undefined,
      external_post_id: row.external_post_id,
      skipped: "already_published",
    };
  }

  if (row.status !== "pending" && row.status !== "publishing") {
    return {
      id: scheduleId,
      ok: false,
      platform,
      error: `Schedule not runnable (${row.status})`,
    };
  }

  if (options?.fromClaim) {
    if (row.status !== "publishing") {
      return {
        id: scheduleId,
        ok: false,
        platform,
        error: "Claimed row not in publishing state",
      };
    }
  } else if (options?.skipPublishingTransition) {
    if (row.status !== "publishing") {
      return {
        id: scheduleId,
        ok: false,
        platform,
        error: "post_now row must be publishing",
      };
    }
  } else if (row.status === "publishing") {
    return {
      id: scheduleId,
      ok: false,
      platform,
      error: "already_claimed",
      skipped: "already_claimed",
    };
  } else {
    const now = new Date().toISOString();
    const { data: locked, error: lockErr } = await admin
      .from("social_media_scheduled_posts")
      .update({
        status: "publishing",
        locked_at: now,
        updated_at: now,
      })
      .eq("id", scheduleId)
      .eq("status", "pending")
      .select("*")
      .maybeSingle();

    if (lockErr) {
      return { id: scheduleId, ok: false, platform, error: lockErr.message };
    }
    if (!locked) {
      return {
        id: scheduleId,
        ok: false,
        platform,
        error: "already_claimed",
        skipped: "already_claimed",
      };
    }
    row = locked as ScheduledPostRow;
  }

  const schedulerConfig = options?.schedulerConfig ?? DEFAULT_SCHEDULER_CONFIG;

  const rateLimit = await enforcePublishRateLimits(admin, row, schedulerConfig);
  if (!rateLimit.allowed) {
    return {
      id: scheduleId,
      ok: false,
      platform,
      error: rateLimit.reason,
      deferred: rateLimit.deferred,
    };
  }

  try {
    const result = await executeScheduledPost(admin, row, options?.sharedPublishContext);
    const cleanedConfig = stripPublishResumeFlags(platform, row.provider_config ?? {});
    await admin
      .from("social_media_scheduled_posts")
      .update({
        status: "published",
        published_url: result.published_url,
        external_post_id: result.external_post_id,
        published_at: new Date().toISOString(),
        error_message: null,
        next_retry_at: null,
        locked_at: null,
        last_error_at: null,
        provider_config: cleanedConfig,
        updated_at: new Date().toISOString(),
      })
      .eq("id", scheduleId);

    return {
      id: scheduleId,
      ok: true,
      platform,
      published_url: result.published_url,
      external_post_id: result.external_post_id,
      tiktok_publish_path: result.tiktok_publish_path,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "publish_failed";
    const stub = parseScheduleStubError(msg);
    const retryCount = isInternalRateLimitMessage(msg)
      ? Number(row.retry_count ?? 0)
      : Number(row.retry_count ?? 0) + 1;
    const nextStatus = stub || isScheduleStubError(msg)
      ? "failed"
      : resolveScheduleStatusAfterFailure(retryCount, msg, platform);
    const nextRetryAt = nextStatus === "pending"
      ? computeNextRetryAt(retryCount, msg, platform)
      : null;
    const now = new Date().toISOString();

    await admin
      .from("social_media_scheduled_posts")
      .update({
        status: nextStatus,
        error_message: msg,
        retry_count: retryCount,
        next_retry_at: nextRetryAt,
        last_error_at: now,
        locked_at: null,
        updated_at: now,
      })
      .eq("id", scheduleId);

    return {
      id: scheduleId,
      ok: false,
      platform,
      error: msg,
      stubCode: stub?.stubCode,
      retry_count: retryCount,
    };
  }
}

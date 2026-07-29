import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  insertPostNowScheduleForTarget,
  type PlanPublishTargetInput,
} from "./createPlatformScheduleRow.ts";
import { runScheduledPostJob } from "./runScheduledPostJob.ts";
import type { ScheduledPostRow } from "./scheduledPostTypes.ts";
import {
  buildSharedPublishContext,
  isPlanPublishSequential,
  type SharedPublishContext,
} from "./sharedPublishContext.ts";

export type PlanBulkPostNowTargetResult = {
  platform: string;
  account_label: string;
  schedule_id: string;
  ok: boolean;
  processing?: boolean;
  error?: string;
  published_url?: string;
  external_post_id?: string;
  tiktok_publish_path?: "pull" | "file_upload";
};

export type RunPlanBulkPostNowArgs = {
  organizationId: string;
  planId: string;
  driveLink: string;
  caption: string | null;
  title: string | null;
  employeeId: string | null;
  userId: string | null;
  targets: PlanPublishTargetInput[];
};

export type RunPlanBulkPostNowResponse = {
  ok: boolean;
  processing: boolean;
  schedules: ScheduledPostRow[];
  results?: PlanBulkPostNowTargetResult[];
};

async function publishScheduleWithContext(
  admin: SupabaseClient,
  scheduleId: string,
  row: ScheduledPostRow,
  sharedCtx: SharedPublishContext,
): Promise<PlanBulkPostNowTargetResult> {
  const job = await runScheduledPostJob(admin, scheduleId, {
    skipPublishingTransition: true,
    preloadedRow: row,
    sharedPublishContext: sharedCtx,
  });

  return {
    platform: row.platform,
    account_label: String((row.provider_config as { account_label?: string })?.account_label ?? ""),
    schedule_id: scheduleId,
    ok: job.ok,
    processing: false,
    error: job.error,
    published_url: job.published_url,
    external_post_id: job.external_post_id,
    tiktok_publish_path: job.tiktok_publish_path,
  };
}

export async function runPlanBulkPostNowJob(
  admin: SupabaseClient,
  args: RunPlanBulkPostNowArgs,
  schedules: ScheduledPostRow[],
): Promise<PlanBulkPostNowTargetResult[]> {
  const platforms = schedules.map((s) => s.platform);
  const downloadStart = Date.now();

  let sharedCtx: SharedPublishContext;
  try {
    sharedCtx = await buildSharedPublishContext(args.driveLink, platforms);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "drive_download_failed";
    console.error(
      `plan_bulk_publish drive_download_failed planId=${args.planId} error=${msg}`,
    );
    const results: PlanBulkPostNowTargetResult[] = [];
    for (const row of schedules) {
      await admin
        .from("social_media_scheduled_posts")
        .update({
          status: "failed",
          error_message: msg,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      results.push({
        platform: row.platform,
        account_label: String(
          (row.provider_config as { account_label?: string })?.account_label ?? "",
        ),
        schedule_id: row.id,
        ok: false,
        error: msg,
      });
    }
    return results;
  }

  const downloadMs = Date.now() - downloadStart;
  console.info(
    `plan_bulk_publish download_ok planId=${args.planId} platforms=${platforms.join(",")} download_ms=${downloadMs} preloaded_bytes=${sharedCtx.preloadedVideo?.bytes.byteLength ?? 0}`,
  );

  const sequential = isPlanPublishSequential();

  if (sequential) {
    const results: PlanBulkPostNowTargetResult[] = [];
    for (const row of schedules) {
      try {
        results.push(await publishScheduleWithContext(admin, row.id, row, sharedCtx));
      } catch (e) {
        const msg = e instanceof Error ? e.message : "publish_failed";
        results.push({
          platform: row.platform,
          account_label: String(
            (row.provider_config as { account_label?: string })?.account_label ?? "",
          ),
          schedule_id: row.id,
          ok: false,
          error: msg,
        });
      }
    }
    logPlanBulkSummary(args.planId, platforms, downloadMs, results);
    return results;
  }

  const settled = await Promise.allSettled(
    schedules.map((row) => publishScheduleWithContext(admin, row.id, row, sharedCtx)),
  );

  const results = settled.map((outcome, index) => {
    const row = schedules[index];
    if (outcome.status === "fulfilled") return outcome.value;
    return {
      platform: row.platform,
      account_label: String(
        (row.provider_config as { account_label?: string })?.account_label ?? "",
      ),
      schedule_id: row.id,
      ok: false,
      error: "publish_failed",
    };
  });

  logPlanBulkSummary(args.planId, platforms, downloadMs, results);
  return results;
}

function logPlanBulkSummary(
  planId: string,
  platforms: string[],
  downloadMs: number,
  results: PlanBulkPostNowTargetResult[],
): void {
  const summary = results
    .map((r) => `${r.platform}:${r.ok ? "ok" : "fail"}`)
    .join(",");
  const tiktokPath = results.find((r) => r.platform === "TikTok")?.tiktok_publish_path ?? "none";
  console.info(
    `plan_bulk_publish complete planId=${planId} platforms=${platforms.join(",")} download_ms=${downloadMs} tiktok_path=${tiktokPath} results=${summary}`,
  );
}

export async function preparePlanBulkPostNow(
  admin: SupabaseClient,
  args: RunPlanBulkPostNowArgs,
): Promise<RunPlanBulkPostNowResponse> {
  const schedules: ScheduledPostRow[] = [];
  const insertErrors: PlanBulkPostNowTargetResult[] = [];

  for (const target of args.targets) {
    try {
      const row = await insertPostNowScheduleForTarget(admin, {
        organizationId: args.organizationId,
        planId: args.planId,
        driveLink: args.driveLink,
        caption: args.caption,
        title: args.title,
        employeeId: args.employeeId,
        userId: args.userId,
        target,
      });
      schedules.push(row);
    } catch (e) {
      insertErrors.push({
        platform: target.platform,
        account_label: target.account_label,
        schedule_id: "",
        ok: false,
        error: e instanceof Error ? e.message : "schedule_insert_failed",
      });
    }
  }

  if (schedules.length === 0) {
    return {
      ok: false,
      processing: false,
      schedules: [],
      results: insertErrors,
    };
  }

  return {
    ok: true,
    processing: true,
    schedules,
    results: insertErrors.length > 0 ? insertErrors : undefined,
  };
}

/** Delete one published Threads post, then clear the plan link and schedule. */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getThreadsAccessToken } from "../../threadsContentAuth.ts";
import { syncPlanCompletionStateForPlan } from "../syncPlanCompletionStateDb.ts";

const THREADS_GRAPH_BASE = "https://graph.threads.net/v1.0";

export type ThreadsMediaDeleteResult =
  | { ok: true; alreadyDeleted: boolean }
  | { ok: false; error: string };

export type ThreadsMediaDeleteCaller = {
  deleteMedia: (mediaId: string) => Promise<{ status: number; message: string; success?: boolean }>;
};

export type DeleteThreadsPublishedPostResult =
  | {
    ok: true;
    already_deleted: boolean;
    nothing_to_delete_on_platform: boolean;
    cleanup: {
      linksDeleted: number;
      schedulesUpdated: number;
      locksRemoved: number;
    };
  }
  | { ok: false; error: string };

type ScheduleRow = {
  id: string;
  status: string;
  external_post_id: string | null;
  provider_config: Record<string, unknown> | null;
  platform_account_id: string | null;
};

type LinkRow = {
  id: string;
  external_post_id: string | null;
  platform_account_open_id: string | null;
};

function mediaGone(message: string): boolean {
  return /does not exist|not exist/i.test(message);
}

export function interpretThreadsMediaDelete(row: {
  status: number;
  message: string;
  success?: boolean;
}): ThreadsMediaDeleteResult {
  if (row.status >= 200 && row.status < 300 && row.success !== false) {
    return { ok: true, alreadyDeleted: false };
  }
  if (mediaGone(row.message)) return { ok: true, alreadyDeleted: true };
  return { ok: false, error: row.message || `http_${row.status}` };
}

export async function deleteThreadsMedia(
  mediaId: string,
  caller: ThreadsMediaDeleteCaller,
): Promise<ThreadsMediaDeleteResult> {
  const id = String(mediaId ?? "").trim();
  if (!id) return { ok: false, error: "missing_media_id" };
  return interpretThreadsMediaDelete(await caller.deleteMedia(id));
}

export function createThreadsMediaDeleteCaller(accessToken: string): ThreadsMediaDeleteCaller {
  return {
    async deleteMedia(mediaId) {
      const qs = new URLSearchParams({ access_token: accessToken });
      const res = await fetch(`${THREADS_GRAPH_BASE}/${mediaId}?${qs.toString()}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({})) as {
        success?: boolean;
        error?: { message?: string };
      };
      return {
        status: res.status,
        success: data.success,
        message: String(data.error?.message ?? ""),
      };
    },
  };
}

function scheduleAccountId(row: ScheduleRow): string {
  return String(row.platform_account_id ?? "").trim()
    || String(row.provider_config?.threads_user_id ?? "").trim();
}

async function resolveMediaId(
  admin: SupabaseClient,
  planId: string,
  threadsUserId: string,
): Promise<string | null> {
  const { data: scheduleRows } = await admin
    .from("social_media_scheduled_posts")
    .select("id, status, external_post_id, provider_config, platform_account_id, created_at")
    .eq("social_media_plan_id", planId)
    .eq("platform", "Threads")
    .order("created_at", { ascending: false });

  for (const row of (scheduleRows ?? []) as ScheduleRow[]) {
    const accountId = scheduleAccountId(row);
    if (accountId && accountId !== threadsUserId) continue;
    const mediaId = String(row.external_post_id ?? "").trim();
    if (mediaId) return mediaId;
  }

  const { data: linkRows } = await admin
    .from("social_media_links")
    .select("id, external_post_id, platform_account_open_id")
    .eq("social_media_plan_id", planId)
    .eq("platform", "Threads");

  for (const link of (linkRows ?? []) as LinkRow[]) {
    const openId = String(link.platform_account_open_id ?? "").trim();
    if (openId && openId !== threadsUserId) continue;
    const mediaId = String(link.external_post_id ?? "").trim();
    if (mediaId) return mediaId;
  }

  return null;
}

async function clearThreadsPlanPublishState(
  admin: SupabaseClient,
  planId: string,
  threadsUserId: string,
): Promise<{ linksDeleted: number; schedulesUpdated: number; locksRemoved: number }> {
  const { data: linkRows } = await admin
    .from("social_media_links")
    .select("id, platform_account_open_id")
    .eq("social_media_plan_id", planId)
    .eq("platform", "Threads");

  const linksToDelete = (linkRows ?? []).filter((row) => {
    const openId = String(row.platform_account_open_id ?? "").trim();
    if (!openId) return true;
    return openId === threadsUserId;
  });

  let linksDeleted = 0;
  if (linksToDelete.length > 0) {
    const ids = linksToDelete.map((row) => row.id);
    const { error } = await admin.from("social_media_links").delete().in("id", ids);
    if (!error) linksDeleted = ids.length;
    else console.error("clearThreadsPlanPublishState links:", error.message);
  }

  const { data: scheduleRows } = await admin
    .from("social_media_scheduled_posts")
    .select("id, status, provider_config, platform_account_id, external_post_id")
    .eq("social_media_plan_id", planId)
    .eq("platform", "Threads")
    .neq("status", "cancelled");

  let schedulesUpdated = 0;
  const now = new Date().toISOString();
  for (const row of (scheduleRows ?? []) as ScheduleRow[]) {
    const accountId = scheduleAccountId(row);
    const hasPost = Boolean(String(row.external_post_id ?? "").trim()) || row.status === "published";
    if (accountId && accountId !== threadsUserId) continue;
    if (!accountId && !hasPost) continue;

    const { error } = await admin
      .from("social_media_scheduled_posts")
      .update({
        status: "cancelled",
        error_message: "deleted_by_user",
        published_url: null,
        external_post_id: null,
        updated_at: now,
      })
      .eq("id", row.id);
    if (!error) schedulesUpdated += 1;
    else console.error("clearThreadsPlanPublishState schedule:", error.message);
  }

  const { data: lockRows, error: lockError } = await admin
    .from("social_media_plan_schedule_manual_locks")
    .delete()
    .eq("social_media_plan_id", planId)
    .eq("platform", "Threads")
    .eq("platform_account_id", threadsUserId)
    .select("id");
  if (lockError) console.error("clearThreadsPlanPublishState locks:", lockError.message);

  const { count: remainingLinks } = await admin
    .from("social_media_links")
    .select("id", { count: "exact", head: true })
    .eq("social_media_plan_id", planId);
  if ((remainingLinks ?? 0) === 0) {
    await admin
      .from("social_media_plans")
      .update({ post_link_created_by: null, updated_at: now })
      .eq("id", planId);
  }

  await syncPlanCompletionStateForPlan(admin, planId);

  return {
    linksDeleted,
    schedulesUpdated,
    locksRemoved: lockRows?.length ?? 0,
  };
}

export async function deleteThreadsPublishedPost(
  admin: SupabaseClient,
  args: {
    organizationId: string;
    planId: string;
    threadsUserId: string;
  },
  caller?: ThreadsMediaDeleteCaller,
): Promise<DeleteThreadsPublishedPostResult> {
  const organizationId = args.organizationId.trim();
  const planId = args.planId.trim();
  const threadsUserId = args.threadsUserId.trim();
  if (!organizationId || !planId || !threadsUserId) {
    return { ok: false, error: "missing_required_fields" };
  }

  const { data: plan } = await admin
    .from("social_media_plans")
    .select("id, organization_id")
    .eq("id", planId)
    .maybeSingle();
  if (!plan || plan.organization_id !== organizationId) {
    return { ok: false, error: "plan_not_found" };
  }

  const mediaId = await resolveMediaId(admin, planId, threadsUserId);
  let alreadyDeleted = false;
  if (mediaId) {
    const deleteCaller = caller ?? await (async () => {
      const accessToken = await getThreadsAccessToken(admin, organizationId, threadsUserId);
      if (!accessToken) return null;
      return createThreadsMediaDeleteCaller(accessToken);
    })();
    if (!deleteCaller) return { ok: false, error: "threads_account_not_found" };

    const deleted = await deleteThreadsMedia(mediaId, deleteCaller);
    if (deleted.ok === false) return { ok: false, error: deleted.error };
    alreadyDeleted = deleted.alreadyDeleted;
  }

  const cleanup = await clearThreadsPlanPublishState(admin, planId, threadsUserId);
  return {
    ok: true,
    already_deleted: alreadyDeleted,
    nothing_to_delete_on_platform: !mediaId,
    cleanup,
  };
}

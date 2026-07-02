import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveMetaContentAccount } from "../../metaContentAuth.ts";
import { deleteInstagramMedia } from "../../metaContent/metaFacebookReelsPublishApi.ts";
import { clearMetaPlanPublishState } from "./clearMetaPlanPublishState.ts";

export type DeleteInstagramPublishedPostResult =
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
  created_at: string;
};

type LinkRow = {
  id: string;
  url: string;
  external_post_id: string | null;
  platform_account_open_id: string | null;
};

async function resolveMediaId(
  admin: SupabaseClient,
  planId: string,
  igAccountId: string,
): Promise<string | null> {
  const { data: scheduleRows } = await admin
    .from("social_media_scheduled_posts")
    .select("id, status, external_post_id, provider_config, platform_account_id, created_at")
    .eq("social_media_plan_id", planId)
    .eq("platform", "Instagram")
    .order("created_at", { ascending: false });

  for (const row of (scheduleRows ?? []) as ScheduleRow[]) {
    const rowAccount =
      String(row.platform_account_id ?? "").trim()
      || String(row.provider_config?.instagram_business_account_id ?? "").trim();
    if (rowAccount && rowAccount !== igAccountId) continue;
    const fromSchedule = String(row.external_post_id ?? "").trim();
    if (fromSchedule) return fromSchedule;
  }

  const { data: linkRows } = await admin
    .from("social_media_links")
    .select("id, url, external_post_id, platform_account_open_id")
    .eq("social_media_plan_id", planId)
    .eq("platform", "Instagram");

  for (const link of (linkRows ?? []) as LinkRow[]) {
    const openId = String(link.platform_account_open_id ?? "").trim();
    if (openId && openId !== igAccountId) continue;
    const fromLink = String(link.external_post_id ?? "").trim();
    if (fromLink) return fromLink;
  }

  return null;
}

export async function deleteInstagramPublishedPost(
  admin: SupabaseClient,
  args: {
    organizationId: string;
    planId: string;
    instagramBusinessAccountId: string;
  },
): Promise<DeleteInstagramPublishedPostResult> {
  const organizationId = args.organizationId.trim();
  const planId = args.planId.trim();
  const igAccountId = args.instagramBusinessAccountId.trim();

  if (!organizationId || !planId || !igAccountId) {
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

  const mediaId = await resolveMediaId(admin, planId, igAccountId);
  let alreadyDeleted = false;

  if (mediaId) {
    const account = await resolveMetaContentAccount(
      admin,
      organizationId,
      "instagram",
      igAccountId,
    );
    if (!account?.pageAccessToken) {
      return { ok: false, error: "instagram_account_not_found" };
    }

    const deleteResult = await deleteInstagramMedia(mediaId, account.pageAccessToken);
    if (!deleteResult.ok) {
      return { ok: false, error: deleteResult.error ?? "delete_failed" };
    }
    alreadyDeleted = deleteResult.alreadyDeleted;
  }

  const cleanup = await clearMetaPlanPublishState(admin, {
    planId,
    platform: "Instagram",
    accountId: igAccountId,
  });

  return {
    ok: true,
    already_deleted: alreadyDeleted,
    nothing_to_delete_on_platform: !mediaId,
    cleanup,
  };
}

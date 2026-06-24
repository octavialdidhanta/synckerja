import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveMetaContentAccount } from "../metaContentAuth.ts";
import {
  buildInstagramReelsFallbackUrl,
  createInstagramReelsContainer,
  fetchInstagramMediaPermalink,
  publishInstagramReelsContainer,
  uploadInstagramReelsVideo,
} from "../metaContent/metaReelsPublishApi.ts";
import { downloadGoogleDriveVideo } from "./googleDriveVideoDownload.ts";
import {
  isPlanEligibleForInstagramAutoSchedule,
  shouldCancelScheduleDueToDriveMismatch,
} from "./scheduledPostEligibility.ts";
import { buildPlanPostMetadataUpdates } from "./syncPlanPostMetadata.ts";
import { syncPlanDoneStateForPlan } from "./syncPlanDoneStateDb.ts";
import type { InstagramProviderConfig, ScheduledPostRow } from "./scheduledPostTypes.ts";

const INSTAGRAM_PUBLISH_SCOPES = ["instagram_content_publish"] as const;

function metaScopesIncludePublish(granted: string[]): boolean {
  const grantedSet = new Set(granted.map((s) => s.toLowerCase()));
  return INSTAGRAM_PUBLISH_SCOPES.every((s) => grantedSet.has(s.toLowerCase()));
}

type PlanRow = {
  id: string;
  organization_id: string;
  post_date: string | null;
  post_link_created_by: string | null;
  approved: boolean;
  production_approved: boolean;
  google_drive_link: string | null;
  content_type?: { name?: string } | null;
};

async function loadPlan(admin: SupabaseClient, planId: string): Promise<PlanRow | null> {
  const { data, error } = await admin
    .from("social_media_plans")
    .select(
      "id, organization_id, post_date, approved, production_approved, google_drive_link, post_link_created_by, content_type:content_types(name)",
    )
    .eq("id", planId)
    .maybeSingle();
  if (error || !data) return null;
  return data as PlanRow;
}

function planEligibilityInput(plan: PlanRow) {
  return {
    post_date: plan.post_date,
    approved: plan.approved,
    production_approved: plan.production_approved,
    google_drive_link: plan.google_drive_link,
    content_type_name: plan.content_type?.name ?? null,
  };
}

async function persistInstagramProviderConfig(
  admin: SupabaseClient,
  scheduleId: string,
  base: Record<string, unknown>,
  patch: Partial<InstagramProviderConfig>,
): Promise<Record<string, unknown>> {
  const next = { ...base, ...patch };
  await admin
    .from("social_media_scheduled_posts")
    .update({ provider_config: next, updated_at: new Date().toISOString() })
    .eq("id", scheduleId);
  return next;
}

async function upsertInstagramLink(
  admin: SupabaseClient,
  plan: PlanRow,
  args: {
    url: string;
    accountId: string;
    accountLabel: string;
    externalPostId: string;
    employeeId?: string;
  },
): Promise<void> {
  const { data: existing } = await admin
    .from("social_media_links")
    .select("id")
    .eq("social_media_plan_id", plan.id)
    .eq("platform", "Instagram")
    .maybeSingle();

  const payload = {
    platform: "Instagram",
    url: args.url,
    social_media_name: args.accountLabel,
    external_post_id: args.externalPostId,
    platform_account_open_id: args.accountId,
    updated_at: new Date().toISOString(),
  };

  if (existing?.id) {
    await admin.from("social_media_links").update(payload).eq("id", existing.id);
  } else {
    await admin.from("social_media_links").insert({ ...payload, social_media_plan_id: plan.id });
    if (!plan.post_link_created_by && args.employeeId) {
      await admin
        .from("social_media_plans")
        .update({ post_link_created_by: args.employeeId })
        .eq("id", plan.id);
    }
  }

  const meta = buildPlanPostMetadataUpdates(plan.post_date);
  await admin
    .from("social_media_plans")
    .update({ ...meta, updated_at: new Date().toISOString() })
    .eq("id", plan.id);
  await syncPlanDoneStateForPlan(admin, plan.id);
}

export async function executeInstagramScheduledPost(
  admin: SupabaseClient,
  schedule: ScheduledPostRow,
): Promise<{ published_url: string; external_post_id: string | null }> {
  const plan = await loadPlan(admin, schedule.social_media_plan_id);
  if (!plan) throw new Error("plan_not_found");
  if (!isPlanEligibleForInstagramAutoSchedule(planEligibilityInput(plan))) {
    throw new Error("plan_not_eligible");
  }
  if (shouldCancelScheduleDueToDriveMismatch(schedule.media_url_snapshot, plan.google_drive_link)) {
    throw new Error("google_drive_link_changed");
  }

  const cfg = schedule.provider_config as InstagramProviderConfig;
  const igAccountId = String(cfg.instagram_business_account_id ?? "").trim();
  if (!igAccountId) throw new Error("missing_instagram_business_account_id");

  const account = await resolveMetaContentAccount(
    admin,
    schedule.organization_id,
    "instagram",
    igAccountId,
  );
  if (!account?.pageAccessToken) {
    throw new Error("instagram_account_not_found");
  }
  if (!metaScopesIncludePublish(account.grantedScopes)) {
    throw new Error("publish_scopes_not_granted");
  }

  let providerConfig = { ...(schedule.provider_config as Record<string, unknown>) };
  const caption = schedule.caption?.trim() || schedule.title?.trim() || "";

  if (cfg.ig_container_id && cfg.ig_upload_phase === "uploaded") {
    const { mediaId } = await publishInstagramReelsContainer(
      igAccountId,
      account.pageAccessToken,
      cfg.ig_container_id,
    );
    const permalink = await fetchInstagramMediaPermalink(mediaId, account.pageAccessToken);
    const publishedUrl = permalink ?? buildInstagramReelsFallbackUrl(mediaId);
    const accountLabel = String(cfg.account_label ?? account.accountLabel ?? "Instagram");
    await upsertInstagramLink(admin, plan, {
      url: publishedUrl,
      accountId: igAccountId,
      accountLabel,
      externalPostId: mediaId,
      employeeId: cfg.employee_id,
    });
    return { published_url: publishedUrl, external_post_id: mediaId };
  }

  const driveUrl = plan.google_drive_link?.trim() ?? schedule.media_url_snapshot;
  const { bytes: videoBytes } = await downloadGoogleDriveVideo(driveUrl);

  let containerId = String(cfg.ig_container_id ?? "").trim();
  let uploadUri = "";

  if (!containerId) {
    const container = await createInstagramReelsContainer(
      igAccountId,
      account.pageAccessToken,
      { caption },
    );
    containerId = container.containerId;
    uploadUri = container.uploadUri;
    providerConfig = await persistInstagramProviderConfig(admin, schedule.id, providerConfig, {
      ig_container_id: containerId,
      ig_upload_phase: "created",
    });
  }

  if (cfg.ig_upload_phase !== "uploaded") {
    if (!uploadUri && cfg.ig_upload_session_id) {
      uploadUri = String(cfg.ig_upload_session_id);
    }
    if (!uploadUri) {
      const container = await createInstagramReelsContainer(
        igAccountId,
        account.pageAccessToken,
        { caption },
      );
      containerId = container.containerId;
      uploadUri = container.uploadUri;
      providerConfig = await persistInstagramProviderConfig(admin, schedule.id, providerConfig, {
        ig_container_id: containerId,
        ig_upload_session_id: uploadUri,
        ig_upload_phase: "created",
      });
    }

    await uploadInstagramReelsVideo(uploadUri, account.pageAccessToken, videoBytes);
    providerConfig = await persistInstagramProviderConfig(admin, schedule.id, providerConfig, {
      ig_upload_phase: "uploaded",
    });
  }

  const { mediaId } = await publishInstagramReelsContainer(
    igAccountId,
    account.pageAccessToken,
    containerId,
  );
  const permalink = await fetchInstagramMediaPermalink(mediaId, account.pageAccessToken);
  const publishedUrl = permalink ?? buildInstagramReelsFallbackUrl(mediaId);
  const accountLabel = String(cfg.account_label ?? account.accountLabel ?? "Instagram");

  await upsertInstagramLink(admin, plan, {
    url: publishedUrl,
    accountId: igAccountId,
    accountLabel,
    externalPostId: mediaId,
    employeeId: cfg.employee_id,
  });

  return { published_url: publishedUrl, external_post_id: mediaId };
}

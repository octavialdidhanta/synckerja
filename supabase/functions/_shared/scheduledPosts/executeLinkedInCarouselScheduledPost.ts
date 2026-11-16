import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildLinkedInAuthorUrn } from "../linkedinContentApi.ts";
import {
  linkedInPublishScopesOk,
  normalizeLinkedInAccountKind,
  resolveLinkedInPublishAccount,
} from "../linkedinContentOrgResolver.ts";
import {
  createLinkedInImagePost,
  createLinkedInMultiImagePost,
  downloadCarouselImageBytes,
  initializeLinkedInImageUpload,
  uploadLinkedInImageBytes,
  waitForLinkedInImageAvailable,
} from "../linkedinContent/linkedinImagePublishApi.ts";
import { buildLinkedInPostUrl } from "../linkedinContent/linkedinVideoPublishApi.ts";
import { publicCarouselImageUrl } from "../metaContent/instagramCarouselPublishApi.ts";
import {
  assertCarouselPublishPaths,
  carouselMediaSnapshot,
  loadCarouselStoragePaths,
} from "./carouselImagePaths.ts";
import {
  isCarouselContentType,
  isPlanEligibleForLinkedInAutoSchedule,
} from "./scheduledPostEligibility.ts";
import { syncPlanCompletionStateForPlan } from "./syncPlanCompletionStateDb.ts";
import type { LinkedInProviderConfig, ScheduledPostRow } from "./scheduledPostTypes.ts";

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

async function persistLinkedInProviderConfig(
  admin: SupabaseClient,
  scheduleId: string,
  base: Record<string, unknown>,
  patch: Partial<LinkedInProviderConfig>,
): Promise<Record<string, unknown>> {
  const next = { ...base, ...patch };
  await admin
    .from("social_media_scheduled_posts")
    .update({ provider_config: next, updated_at: new Date().toISOString() })
    .eq("id", scheduleId);
  return next;
}

async function upsertLinkedInLink(
  admin: SupabaseClient,
  plan: PlanRow,
  args: {
    url: string;
    pageId: string;
    accountLabel: string;
    externalPostId: string;
    employeeId?: string;
  },
): Promise<void> {
  const { data: existing } = await admin
    .from("social_media_links")
    .select("id")
    .eq("social_media_plan_id", plan.id)
    .eq("platform", "LinkedIn")
    .eq("platform_account_open_id", args.pageId)
    .maybeSingle();

  let existingId = existing?.id as string | undefined;
  if (!existingId) {
    const { data: legacyRows } = await admin
      .from("social_media_links")
      .select("id, platform_account_open_id")
      .eq("social_media_plan_id", plan.id)
      .eq("platform", "LinkedIn");
    const legacy = (legacyRows ?? []).find((row) => {
      const ownedBy = String(
        (row as { platform_account_open_id?: string | null }).platform_account_open_id ?? "",
      ).trim();
      return !ownedBy;
    });
    existingId = legacy?.id as string | undefined;
  }

  const payload = {
    platform: "LinkedIn",
    url: args.url,
    social_media_name: args.accountLabel,
    external_post_id: args.externalPostId,
    platform_account_open_id: args.pageId,
    updated_at: new Date().toISOString(),
  };

  if (existingId) {
    await admin.from("social_media_links").update(payload).eq("id", existingId);
  } else {
    await admin.from("social_media_links").insert({ ...payload, social_media_plan_id: plan.id });
    if (!plan.post_link_created_by && args.employeeId) {
      await admin
        .from("social_media_plans")
        .update({ post_link_created_by: args.employeeId })
        .eq("id", plan.id);
    }
  }

  await syncPlanCompletionStateForPlan(admin, plan.id);
}

function storedImageUrns(config: Record<string, unknown>): string[] {
  const raw = config.linkedin_image_urns;
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => String(item ?? "").trim()).filter(Boolean);
}

export function shouldExecuteLinkedInCarousel(
  schedule: ScheduledPostRow,
  plan: PlanRow,
): boolean {
  if (String(schedule.media_source ?? "").trim() === "carousel_images") return true;
  return isCarouselContentType(plan.content_type?.name);
}

export async function executeLinkedInCarouselScheduledPost(
  admin: SupabaseClient,
  schedule: ScheduledPostRow,
  plan: PlanRow,
): Promise<{ published_url: string; external_post_id: string | null }> {
  const storagePaths = assertCarouselPublishPaths(
    await loadCarouselStoragePaths(admin, plan.id),
  );
  const imageCount = storagePaths.length;
  if (!isPlanEligibleForLinkedInAutoSchedule({
    post_date: plan.post_date,
    approved: plan.approved,
    production_approved: plan.production_approved,
    google_drive_link: plan.google_drive_link,
    content_type_name: plan.content_type?.name ?? null,
    carousel_image_count: imageCount,
  })) {
    throw new Error("plan_not_eligible");
  }
  if (schedule.media_url_snapshot !== carouselMediaSnapshot(storagePaths)) {
    throw new Error("carousel_images_changed");
  }

  const cfg = schedule.provider_config as LinkedInProviderConfig;
  const pageId = String(cfg.page_id ?? "").trim();
  if (!pageId) throw new Error("missing_page_id");

  const publishAccount = await resolveLinkedInPublishAccount(
    admin,
    schedule.organization_id,
    pageId,
  );
  if (!publishAccount) {
    throw new Error("linkedin_token_missing: Re-authorize LinkedIn in Digital Marketing settings");
  }

  const accountKind = normalizeLinkedInAccountKind(
    cfg.account_kind ?? publishAccount.accountKind,
  );
  if (!linkedInPublishScopesOk(publishAccount.grantedScopes, accountKind)) {
    throw new Error("publish_scopes_not_granted");
  }

  const accessToken = publishAccount.accessToken;
  const authorUrn = String(
    cfg.organization_urn?.trim() ||
      buildLinkedInAuthorUrn(accountKind, pageId),
  );
  const accountLabel = String(
    cfg.account_label ?? publishAccount.accountLabel ?? "LinkedIn",
  );
  const commentary = schedule.caption?.trim() || schedule.title?.trim() || "";

  if (cfg.linkedin_post_urn) {
    const publishedUrl = buildLinkedInPostUrl(cfg.linkedin_post_urn);
    await upsertLinkedInLink(admin, plan, {
      url: publishedUrl,
      pageId,
      accountLabel,
      externalPostId: cfg.linkedin_post_urn,
      employeeId: cfg.employee_id,
    });
    return { published_url: publishedUrl, external_post_id: cfg.linkedin_post_urn };
  }

  let providerConfig = { ...(schedule.provider_config as Record<string, unknown>) };
  let imageUrns = storedImageUrns(providerConfig);

  console.info(
    `linkedin_publish_path=carousel scheduleId=${schedule.id} images=${imageCount} resume=${imageUrns.length > 0 ? 1 : 0} kind=${accountKind}`,
  );

  if (imageUrns.length < imageCount) {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim() ?? "";
    if (!supabaseUrl) throw new Error("supabase_url_missing");

    for (let i = imageUrns.length; i < imageCount; i++) {
      const imageUrl = publicCarouselImageUrl(supabaseUrl, storagePaths[i]);
      const { bytes, contentType } = await downloadCarouselImageBytes(imageUrl);
      const init = await initializeLinkedInImageUpload(accessToken, authorUrn);
      await uploadLinkedInImageBytes(init.uploadUrl, accessToken, bytes, contentType);
      await waitForLinkedInImageAvailable(accessToken, init.imageUrn);
      imageUrns = [...imageUrns, init.imageUrn];
      providerConfig = await persistLinkedInProviderConfig(admin, schedule.id, providerConfig, {
        linkedin_image_urns: imageUrns,
        organization_urn: authorUrn,
        account_kind: accountKind,
      });
    }
  }

  if (imageUrns.length !== imageCount) {
    throw new Error("carousel_images_changed");
  }

  const { postUrn } = imageUrns.length === 1
    ? await createLinkedInImagePost(accessToken, authorUrn, imageUrns[0], commentary)
    : await createLinkedInMultiImagePost(accessToken, authorUrn, imageUrns, commentary);

  providerConfig = await persistLinkedInProviderConfig(admin, schedule.id, providerConfig, {
    linkedin_post_urn: postUrn,
  });

  const publishedUrl = buildLinkedInPostUrl(postUrn);
  await upsertLinkedInLink(admin, plan, {
    url: publishedUrl,
    pageId,
    accountLabel,
    externalPostId: postUrn,
    employeeId: cfg.employee_id,
  });

  return { published_url: publishedUrl, external_post_id: postUrn };
}

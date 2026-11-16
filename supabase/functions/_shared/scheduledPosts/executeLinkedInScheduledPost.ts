import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildLinkedInAuthorUrn } from "../linkedinContentApi.ts";
import {
  linkedInPublishScopesOk,
  normalizeLinkedInAccountKind,
  resolveLinkedInPublishAccount,
} from "../linkedinContentOrgResolver.ts";
import {
  isLinkedInContentAuthFailure,
  linkedInContentReauthErrorMessage,
} from "../linkedinContentAuthError.ts";
import {
  buildLinkedInPostUrl,
  createLinkedInVideoPost,
  finalizeLinkedInVideoUpload,
  initializeLinkedInVideoUpload,
  uploadLinkedInVideoBytes,
} from "../linkedinContent/linkedinVideoPublishApi.ts";
import {
  executeLinkedInCarouselScheduledPost,
  shouldExecuteLinkedInCarousel,
} from "./executeLinkedInCarouselScheduledPost.ts";
import {
  isPlanEligibleForLinkedInAutoSchedule,
  shouldCancelScheduleDueToDriveMismatch,
} from "./scheduledPostEligibility.ts";
import { resolveVideoBytesForUpload, type SharedPublishContext } from "./sharedPublishContext.ts";
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
  // Multi-page: one link row per LinkedIn page_id (never overwrite another page's link).
  const { data: existing } = await admin
    .from("social_media_links")
    .select("id")
    .eq("social_media_plan_id", plan.id)
    .eq("platform", "LinkedIn")
    .eq("platform_account_open_id", args.pageId)
    .maybeSingle();

  let existingId = existing?.id as string | undefined;
  if (!existingId) {
    // Claim a single legacy LinkedIn row with empty open_id (pre–multi-page), if any.
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

export async function executeLinkedInScheduledPost(
  admin: SupabaseClient,
  schedule: ScheduledPostRow,
  sharedCtx?: SharedPublishContext,
): Promise<{ published_url: string; external_post_id: string | null }> {
  try {
    return await executeLinkedInScheduledPostInner(admin, schedule, sharedCtx);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!isLinkedInContentAuthFailure(msg) && !/^linkedin_reauth_required:/i.test(msg)) {
      throw e instanceof Error ? e : new Error(msg);
    }
    const cfg = schedule.provider_config as LinkedInProviderConfig;
    const kind = normalizeLinkedInAccountKind(cfg.account_kind);
    throw new Error(`linkedin_reauth_required: ${linkedInContentReauthErrorMessage(kind)}`);
  }
}

async function executeLinkedInScheduledPostInner(
  admin: SupabaseClient,
  schedule: ScheduledPostRow,
  sharedCtx?: SharedPublishContext,
): Promise<{ published_url: string; external_post_id: string | null }> {
  const plan = await loadPlan(admin, schedule.social_media_plan_id);
  if (!plan) throw new Error("plan_not_found");

  // Photo carousel must run before Reel/Drive checks (no Drive bytes for carousel).
  if (shouldExecuteLinkedInCarousel(schedule, plan)) {
    return executeLinkedInCarouselScheduledPost(admin, schedule, plan);
  }

  if (!isPlanEligibleForLinkedInAutoSchedule(planEligibilityInput(plan))) {
    throw new Error("plan_not_eligible");
  }
  if (shouldCancelScheduleDueToDriveMismatch(schedule.media_url_snapshot, plan.google_drive_link)) {
    throw new Error("google_drive_link_changed");
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
  let uploadUrn = String(cfg.linkedin_upload_urn ?? "").trim();
  let uploadInstructions = (cfg.linkedin_upload_instructions ?? {}) as Record<string, unknown>;

  const driveUrl = plan.google_drive_link?.trim() ?? schedule.media_url_snapshot;
  const { bytes: videoBytes, mimeType } = await resolveVideoBytesForUpload(driveUrl, sharedCtx);

  if (!uploadUrn) {
    const init = await initializeLinkedInVideoUpload(
      accessToken,
      authorUrn,
      videoBytes.byteLength,
    );
    uploadUrn = init.uploadUrn;
    uploadInstructions = init.uploadInstructions;
    providerConfig = await persistLinkedInProviderConfig(admin, schedule.id, providerConfig, {
      linkedin_upload_urn: uploadUrn,
      linkedin_upload_instructions: uploadInstructions,
      organization_urn: authorUrn,
      account_kind: accountKind,
    });

    const uploadedPartIds = await uploadLinkedInVideoBytes(init.parts, videoBytes, mimeType);
    await finalizeLinkedInVideoUpload(
      accessToken,
      uploadUrn,
      uploadInstructions,
      uploadedPartIds,
    );
  }

  const { postUrn } = await createLinkedInVideoPost(
    accessToken,
    authorUrn,
    uploadUrn,
    commentary,
  );

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

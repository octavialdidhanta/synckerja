import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildOrganizationUrn } from "../linkedinContentApi.ts";
import { getLinkedInContentAccessToken } from "../linkedinContentOrgResolver.ts";
import {
  buildLinkedInPostUrl,
  createLinkedInVideoPost,
  finalizeLinkedInVideoUpload,
  initializeLinkedInVideoUpload,
  uploadLinkedInVideoBytes,
} from "../linkedinContent/linkedinVideoPublishApi.ts";
import { parseLinkedInGrantedScopes } from "../linkedinContentAuth.ts";
import { downloadGoogleDriveVideo } from "./googleDriveVideoDownload.ts";
import {
  isPlanEligibleForLinkedInAutoSchedule,
  shouldCancelScheduleDueToDriveMismatch,
} from "./scheduledPostEligibility.ts";
import { syncPlanCompletionStateForPlan } from "./syncPlanCompletionStateDb.ts";
import type { LinkedInProviderConfig, ScheduledPostRow } from "./scheduledPostTypes.ts";

const LINKEDIN_PUBLISH_SCOPES = ["w_organization_social"] as const;

function linkedInScopesIncludePublish(granted: string[]): boolean {
  const grantedSet = new Set(granted.map((s) => s.toLowerCase()));
  return LINKEDIN_PUBLISH_SCOPES.some((s) => grantedSet.has(s.toLowerCase()));
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
    .maybeSingle();

  const payload = {
    platform: "LinkedIn",
    url: args.url,
    social_media_name: args.accountLabel,
    external_post_id: args.externalPostId,
    platform_account_open_id: args.pageId,
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

  await syncPlanCompletionStateForPlan(admin, plan.id);
}

export async function executeLinkedInScheduledPost(
  admin: SupabaseClient,
  schedule: ScheduledPostRow,
): Promise<{ published_url: string; external_post_id: string | null }> {
  const plan = await loadPlan(admin, schedule.social_media_plan_id);
  if (!plan) throw new Error("plan_not_found");
  if (!isPlanEligibleForLinkedInAutoSchedule(planEligibilityInput(plan))) {
    throw new Error("plan_not_eligible");
  }
  if (shouldCancelScheduleDueToDriveMismatch(schedule.media_url_snapshot, plan.google_drive_link)) {
    throw new Error("google_drive_link_changed");
  }

  const cfg = schedule.provider_config as LinkedInProviderConfig;
  const pageId = String(cfg.page_id ?? "").trim();
  if (!pageId) throw new Error("missing_page_id");

  const accessToken = await getLinkedInContentAccessToken(
    admin,
    schedule.organization_id,
    pageId,
  );
  if (!accessToken) {
    throw new Error("linkedin_token_missing: Re-authorize LinkedIn in Digital Marketing settings");
  }

  const { data: accountRow } = await admin
    .from("organization_linkedin_content_accounts")
    .select("label, display_name, granted_scopes")
    .eq("organization_id", schedule.organization_id)
    .eq("page_id", pageId)
    .maybeSingle();

  const grantedScopes = parseLinkedInGrantedScopes(accountRow?.granted_scopes);
  if (!linkedInScopesIncludePublish(grantedScopes)) {
    throw new Error("publish_scopes_not_granted");
  }

  const organizationUrn = String(cfg.organization_urn ?? buildOrganizationUrn(pageId));
  const accountLabel = String(
    cfg.account_label ?? accountRow?.display_name ?? accountRow?.label ?? "LinkedIn",
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
  const { bytes: videoBytes, mimeType } = await downloadGoogleDriveVideo(driveUrl);

  if (!uploadUrn) {
    const init = await initializeLinkedInVideoUpload(
      accessToken,
      organizationUrn,
      videoBytes.byteLength,
    );
    uploadUrn = init.uploadUrn;
    uploadInstructions = init.uploadInstructions;
    providerConfig = await persistLinkedInProviderConfig(admin, schedule.id, providerConfig, {
      linkedin_upload_urn: uploadUrn,
      linkedin_upload_instructions: uploadInstructions,
      organization_urn: organizationUrn,
    });

    await uploadLinkedInVideoBytes(init.uploadUrl, accessToken, videoBytes, mimeType);
    await finalizeLinkedInVideoUpload(accessToken, uploadUrn, uploadInstructions);
  }

  const { postUrn } = await createLinkedInVideoPost(
    accessToken,
    organizationUrn,
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

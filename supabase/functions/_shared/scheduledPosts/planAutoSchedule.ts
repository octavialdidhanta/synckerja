import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAccountIdFromProviderConfig } from "./accountIdFromProviderConfig.ts";
import { assertPlatformCanSchedule } from "./platformRegistry.ts";
import {
  buildScheduleCaption,
  formatDefaultTimeFromDb,
  resolveScheduledAtUtc,
} from "./resolveScheduledAtWib.ts";
import {
  isPlanEligibleForAutoSchedule,
  type PlanAutoScheduleEligibilityInput,
} from "./scheduledPostEligibility.ts";
import { DEFAULT_YOUTUBE_SCHEDULE_PRIVACY } from "./normalizeYouTubeSchedulePrivacy.ts";
import { tiktokContentScopesIncludePublish } from "../tiktokContentAuth.ts";
import { youtubeContentScopesIncludeUpload, parseYouTubeOAuthScopes } from "../youtubeContentAuth.ts";
import { missingScopesForFeature, facebookPublishScopesOk } from "../metaPlatformScopes.ts";
import { resolveMetaContentAccount } from "../metaContentAuth.ts";
import { missingLinkedInScopesForFeature, parseLinkedInGrantedScopes } from "../linkedinContentAuth.ts";

export type AutoScheduleSkipReason =
  | "manual_lock"
  | "oauth_disconnected"
  | "missing_scopes"
  | "active_schedule"
  | "already_published"
  | "platform_not_supported";

export type AutoScheduleSkipped = {
  platform: string;
  platform_account_id: string;
  reason: AutoScheduleSkipReason;
};

export type AutoScheduleFailed = {
  platform: string;
  platform_account_id: string;
  error: string;
};

export type PlanAutoScheduleResult = {
  eligible: boolean;
  scheduled: number;
  skipped: AutoScheduleSkipped[];
  failed: AutoScheduleFailed[];
};

type RequiredTarget = {
  platform: string;
  platform_account_id: string;
  account_label: string;
};

type ScheduleRow = {
  platform: string;
  status: string;
  provider_config: Record<string, unknown> | null;
  platform_account_id: string | null;
};

const AUTO_PLATFORMS = new Set(["TikTok", "YouTube", "Instagram", "Facebook", "LinkedIn"]);

function getEdgeFunctionForPlatform(platform: string): string | null {
  switch (platform.trim()) {
    case "TikTok":
      return "tiktok-content-publish";
    case "YouTube":
      return "youtube-content-publish";
    case "Instagram":
      return "meta-content-publish";
    case "Facebook":
      return "meta-content-publish";
    case "LinkedIn":
      return "linkedin-content-publish";
    default:
      return null;
  }
}

function buildPublishBody(
  platform: string,
  args: {
    organizationId: string;
    planId: string;
    accountId: string;
    accountLabel: string;
    scheduledAtIso: string;
    caption: string;
    title: string | null;
  },
): Record<string, unknown> {
  const base = {
    action: "schedule",
    organization_id: args.organizationId,
    social_media_plan_id: args.planId,
    account_label: args.accountLabel,
    caption: args.caption,
    title: args.title,
    scheduled_at: args.scheduledAtIso,
  };

  switch (platform.trim()) {
    case "TikTok":
      return { ...base, open_id: args.accountId };
    case "YouTube":
      return { ...base, channel_id: args.accountId, privacy_level: DEFAULT_YOUTUBE_SCHEDULE_PRIVACY };
    case "Instagram":
      return { ...base, instagram_business_account_id: args.accountId };
    case "Facebook":
      return { ...base, facebook_page_id: args.accountId };
    case "LinkedIn":
      return { ...base, page_id: args.accountId };
    default:
      throw new Error(`unsupported_platform:${platform}`);
  }
}

async function checkAccountPublishReady(
  admin: SupabaseClient,
  organizationId: string,
  platform: string,
  accountId: string,
): Promise<{ connected: boolean; scopesOk: boolean }> {
  const id = accountId.trim();
  switch (platform) {
    case "TikTok": {
      const { data: acc } = await admin
        .from("organization_tiktok_content_accounts")
        .select("open_id, is_active")
        .eq("organization_id", organizationId)
        .eq("open_id", id)
        .eq("is_active", true)
        .maybeSingle();
      if (!acc) return { connected: false, scopesOk: false };
      const { data: token } = await admin
        .from("organization_tiktok_content_connection_tokens")
        .select("oauth_scopes, publish_oauth_scopes, publish_access_token_enc")
        .eq("organization_id", organizationId)
        .eq("open_id", id)
        .maybeSingle();
      if (!token?.publish_access_token_enc) return { connected: true, scopesOk: false };
      const scopes = (token.publish_oauth_scopes as string | null) ?? (token.oauth_scopes as string | null);
      return { connected: true, scopesOk: tiktokContentScopesIncludePublish(scopes) };
    }
    case "YouTube": {
      const { data: acc } = await admin
        .from("organization_youtube_content_accounts")
        .select("channel_id, is_active")
        .eq("organization_id", organizationId)
        .eq("channel_id", id)
        .eq("is_active", true)
        .maybeSingle();
      if (!acc) return { connected: false, scopesOk: false };
      const { data: token } = await admin
        .from("organization_youtube_content_connection_tokens")
        .select("oauth_scopes")
        .eq("organization_id", organizationId)
        .eq("channel_id", id)
        .maybeSingle();
      return {
        connected: true,
        scopesOk: youtubeContentScopesIncludeUpload(parseYouTubeOAuthScopes(token?.oauth_scopes)),
      };
    }
    case "Instagram": {
      const { data: acc } = await admin
        .from("organization_instagram_accounts")
        .select("instagram_business_account_id, granted_scopes, is_active")
        .eq("organization_id", organizationId)
        .eq("instagram_business_account_id", id)
        .eq("is_active", true)
        .maybeSingle();
      if (!acc) return { connected: false, scopesOk: false };
      const scopes = Array.isArray(acc.granted_scopes) ? acc.granted_scopes.map(String) : [];
      return {
        connected: true,
        scopesOk: missingScopesForFeature(scopes, "publish").length === 0,
      };
    }
    case "Facebook": {
      const account = await resolveMetaContentAccount(admin, organizationId, "facebook", id);
      if (!account) return { connected: false, scopesOk: false };
      return {
        connected: true,
        scopesOk: facebookPublishScopesOk(account.grantedScopes),
      };
    }
    case "LinkedIn": {
      const { data: acc } = await admin
        .from("organization_linkedin_content_accounts")
        .select("page_id, is_active, granted_scopes")
        .eq("organization_id", organizationId)
        .eq("page_id", id)
        .eq("is_active", true)
        .maybeSingle();
      if (!acc) return { connected: false, scopesOk: false };
      const scopes = parseLinkedInGrantedScopes(acc.granted_scopes);
      return {
        connected: true,
        scopesOk: missingLinkedInScopesForFeature(scopes, "publish").length === 0,
      };
    }
    default:
      return { connected: false, scopesOk: false };
  }
}

function resolveRowAccountId(row: ScheduleRow): string | null {
  return row.platform_account_id?.trim() ||
    getAccountIdFromProviderConfig(row.platform, row.provider_config);
}

function hasActiveScheduleForAccount(
  schedules: ScheduleRow[],
  platform: string,
  accountId: string,
): boolean {
  return schedules.some((row) => {
    if (row.platform !== platform) return false;
    const rowAccount = resolveRowAccountId(row);
    if (rowAccount !== accountId) return false;
    return row.status === "pending" || row.status === "publishing";
  });
}

function hasPublishedForAccount(
  schedules: ScheduleRow[],
  platform: string,
  accountId: string,
): boolean {
  return schedules.some((row) => {
    if (row.platform !== platform || row.status !== "published") return false;
    return resolveRowAccountId(row) === accountId;
  });
}

async function invokePlatformSchedule(
  supabaseUrl: string,
  anonKey: string,
  authHeader: string,
  platform: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  const fn = getEdgeFunctionForPlatform(platform);
  if (!fn) return { ok: false, error: "platform_not_supported" };

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/${fn}`, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        apikey: anonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({})) as Record<string, unknown>;
    if (!res.ok) {
      return { ok: false, error: String(json.error ?? json.message ?? `http_${res.status}`) };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "invoke_failed" };
  }
}

export async function runPlanAutoSchedule(
  admin: SupabaseClient,
  opts: {
    organizationId: string;
    planId: string;
    authHeader: string;
    supabaseUrl: string;
    anonKey: string;
  },
): Promise<PlanAutoScheduleResult> {
  const empty: PlanAutoScheduleResult = { eligible: false, scheduled: 0, skipped: [], failed: [] };

  const { data: planRow, error: planErr } = await admin
    .from("social_media_plans")
    .select(
      "id, organization_id, post_date, approved, production_approved, google_drive_link, service_id, title, content_type:content_types(name)",
    )
    .eq("id", opts.planId)
    .maybeSingle();

  if (planErr || !planRow || planRow.organization_id !== opts.organizationId) {
    return empty;
  }

  const eligibility: PlanAutoScheduleEligibilityInput = {
    post_date: planRow.post_date as string | null,
    approved: Boolean(planRow.approved),
    production_approved: Boolean(planRow.production_approved),
    google_drive_link: planRow.google_drive_link as string | null,
    content_type_name: (planRow.content_type as { name?: string } | null)?.name ?? null,
    service_id: (planRow.service_id as string | null) ?? null,
  };

  if (!isPlanEligibleForAutoSchedule(eligibility)) {
    return empty;
  }

  const postDate = eligibility.post_date!;
  const serviceId = eligibility.service_id!;

  const { data: settingsRow } = await admin
    .from("organization_social_media_scheduling_settings")
    .select("default_post_time_wib")
    .eq("organization_id", opts.organizationId)
    .maybeSingle();

  const defaultTime = formatDefaultTimeFromDb(
    (settingsRow?.default_post_time_wib as string | null) ?? null,
  );
  const scheduledAtIso = resolveScheduledAtUtc(postDate, defaultTime);
  if (!scheduledAtIso) {
    return { eligible: true, scheduled: 0, skipped: [], failed: [] };
  }

  const { data: briefRow } = await admin
    .from("brief_captions")
    .select("caption")
    .eq("social_media_plan_id", opts.planId)
    .maybeSingle();

  const caption = buildScheduleCaption(
    planRow.title as string | null,
    (briefRow?.caption as string | null) ?? null,
  );

  const { data: requiredRows } = await admin
    .from("service_required_platforms")
    .select("platform, platform_account_id, platform_account_label, is_active")
    .eq("organization_id", opts.organizationId)
    .eq("service_id", serviceId)
    .eq("is_active", true);

  const targets: RequiredTarget[] = (requiredRows ?? [])
    .filter((row) => {
      const platform = String(row.platform ?? "").trim();
      const accountId = String(row.platform_account_id ?? "").trim();
      return AUTO_PLATFORMS.has(platform) && accountId.length > 0;
    })
    .map((row) => ({
      platform: String(row.platform).trim(),
      platform_account_id: String(row.platform_account_id).trim(),
      account_label: String(row.platform_account_label ?? row.platform_account_id).trim(),
    }));

  if (!targets.length) {
    return { eligible: true, scheduled: 0, skipped: [], failed: [] };
  }

  const { data: lockRows } = await admin
    .from("social_media_plan_schedule_manual_locks")
    .select("platform, platform_account_id")
    .eq("social_media_plan_id", opts.planId);

  const lockSet = new Set(
    (lockRows ?? []).map((l) => `${String(l.platform)}::${String(l.platform_account_id)}`),
  );

  const { data: scheduleRows } = await admin
    .from("social_media_scheduled_posts")
    .select("platform, status, provider_config, platform_account_id")
    .eq("social_media_plan_id", opts.planId)
    .neq("status", "cancelled");

  const schedules = (scheduleRows ?? []) as ScheduleRow[];

  const skipped: AutoScheduleSkipped[] = [];
  const failed: AutoScheduleFailed[] = [];
  let scheduled = 0;

  for (const target of targets) {
    const lockKey = `${target.platform}::${target.platform_account_id}`;
    if (lockSet.has(lockKey)) {
      skipped.push({
        platform: target.platform,
        platform_account_id: target.platform_account_id,
        reason: "manual_lock",
      });
      continue;
    }

    if (hasPublishedForAccount(schedules, target.platform, target.platform_account_id)) {
      skipped.push({
        platform: target.platform,
        platform_account_id: target.platform_account_id,
        reason: "already_published",
      });
      continue;
    }

    if (hasActiveScheduleForAccount(schedules, target.platform, target.platform_account_id)) {
      skipped.push({
        platform: target.platform,
        platform_account_id: target.platform_account_id,
        reason: "active_schedule",
      });
      continue;
    }

    try {
      assertPlatformCanSchedule(target.platform);
    } catch {
      skipped.push({
        platform: target.platform,
        platform_account_id: target.platform_account_id,
        reason: "platform_not_supported",
      });
      continue;
    }

    const oauth = await checkAccountPublishReady(
      admin,
      opts.organizationId,
      target.platform,
      target.platform_account_id,
    );
    if (!oauth.connected) {
      skipped.push({
        platform: target.platform,
        platform_account_id: target.platform_account_id,
        reason: "oauth_disconnected",
      });
      continue;
    }
    if (!oauth.scopesOk) {
      skipped.push({
        platform: target.platform,
        platform_account_id: target.platform_account_id,
        reason: "missing_scopes",
      });
      continue;
    }

    const body = buildPublishBody(target.platform, {
      organizationId: opts.organizationId,
      planId: opts.planId,
      accountId: target.platform_account_id,
      accountLabel: target.account_label,
      scheduledAtIso,
      caption,
      title: (planRow.title as string | null) ?? null,
    });

    const invoke = await invokePlatformSchedule(
      opts.supabaseUrl,
      opts.anonKey,
      opts.authHeader,
      target.platform,
      body,
    );

    if (invoke.ok) {
      scheduled += 1;
      schedules.push({
        platform: target.platform,
        status: "pending",
        provider_config: null,
        platform_account_id: target.platform_account_id,
      });
    } else {
      failed.push({
        platform: target.platform,
        platform_account_id: target.platform_account_id,
        error: invoke.error ?? "schedule_failed",
      });
    }
  }

  return { eligible: true, scheduled, skipped, failed };
}

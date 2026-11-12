import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveMetaContentAccount } from "../metaContentAuth.ts";
import { facebookPublishScopesOk } from "../metaPlatformScopes.ts";
import { buildOrganizationUrn } from "../linkedinContentApi.ts";
import {
  parseLinkedInGrantedScopes,
  missingLinkedInScopesForFeature,
} from "../linkedinContentAuth.ts";
import { tiktokContentScopesIncludePublish } from "../tiktokContentAuth.ts";
import {
  parseYouTubeOAuthScopes,
  youtubeContentScopesIncludeUpload,
} from "../youtubeContentAuth.ts";
import { assertPlatformCanSchedule } from "./platformRegistry.ts";
import { cancelPendingSchedulesForPlatformAccount } from "./scheduledPostCancel.ts";
import {
  DEFAULT_PRIVACY_LEVEL,
  DEFAULT_TIMEZONE,
  MEDIA_SOURCE_GOOGLE_DRIVE,
  type ScheduledPostRow,
  type TikTokProviderConfig,
  type YouTubeProviderConfig,
  type InstagramProviderConfig,
  type FacebookProviderConfig,
  type LinkedInProviderConfig,
} from "./scheduledPostTypes.ts";
import {
  DEFAULT_YOUTUBE_SCHEDULE_PRIVACY,
  normalizeYouTubeSchedulePrivacy,
} from "./normalizeYouTubeSchedulePrivacy.ts";

const INSTAGRAM_PUBLISH_SCOPES = ["instagram_content_publish"] as const;

function instagramPublishScopesOk(granted: string[]): boolean {
  const grantedSet = new Set(granted.map((s) => s.toLowerCase()));
  return INSTAGRAM_PUBLISH_SCOPES.every((s) => grantedSet.has(s.toLowerCase()));
}

export type PlanPublishTargetInput = {
  platform: string;
  account_id: string;
  account_label: string;
  privacy_level?: string;
};

export type PlatformScheduleAction = "schedule" | "post_now";

export type InsertPlatformScheduleArgs = {
  organizationId: string;
  planId: string;
  driveLink: string;
  caption: string | null;
  title: string | null;
  employeeId: string | null;
  userId: string | null;
  action: PlatformScheduleAction;
  scheduledAtIso: string;
  target: PlanPublishTargetInput;
  /** Defaults to the Google Drive snapshot used by reel video publish. */
  mediaSource?: string | null;
};

export type InsertPostNowScheduleArgs = Omit<
  InsertPlatformScheduleArgs,
  "action" | "scheduledAtIso"
>;

function scheduleMatchesAccount(
  row: ScheduledPostRow & { platform_account_id?: string | null },
  accountId: string,
): boolean {
  if (String(row.platform_account_id ?? "").trim() === accountId) return true;
  const config = (row.provider_config ?? {}) as Record<string, unknown>;
  return [
    config.open_id,
    config.channel_id,
    config.instagram_business_account_id,
    config.facebook_page_id,
    config.page_id,
  ].some((value) => String(value ?? "").trim() === accountId);
}

async function reuseUnpublishedSchedule(
  admin: SupabaseClient,
  args: InsertPlatformScheduleArgs,
  platform: string,
  accountId: string,
  privacyLevel: string,
  providerConfig: object,
): Promise<ScheduledPostRow | null> {
  const { data, error } = await admin
    .from("social_media_scheduled_posts")
    .select("*")
    .eq("social_media_plan_id", args.planId)
    .eq("platform", platform)
    .in("status", ["pending", "failed", "publishing", "published"])
    .order("created_at", { ascending: false })
    .limit(12);

  if (error) throw new Error(error.message);

  const matches = ((data ?? []) as Array<ScheduledPostRow & { platform_account_id?: string | null }>)
    .filter((row) => scheduleMatchesAccount(row, accountId));
  const published = matches.find(
    (row) => row.status === "published" || String(row.external_post_id ?? "").trim(),
  );
  if (published) return published;
  if (matches.some((row) => row.status === "publishing")) {
    throw new Error("already_publishing");
  }

  const chosen = matches.find((row) => row.status === "pending" || row.status === "failed");
  if (!chosen) return null;

  const otherActiveIds = matches
    .filter((row) => row.id !== chosen.id && (row.status === "pending" || row.status === "publishing"))
    .map((row) => row.id);
  if (otherActiveIds.length > 0) {
    await admin
      .from("social_media_scheduled_posts")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .in("id", otherActiveIds);
  }

  const now = new Date().toISOString();
  const { data: updated, error: updateError } = await admin
    .from("social_media_scheduled_posts")
    .update({
      status: args.action === "post_now" ? "publishing" : "pending",
      scheduled_at: new Date(args.scheduledAtIso).toISOString(),
      media_source: args.mediaSource?.trim() || MEDIA_SOURCE_GOOGLE_DRIVE,
      media_url_snapshot: args.driveLink,
      caption: args.caption,
      title: args.title,
      privacy_level: privacyLevel,
      platform_account_id: accountId,
      provider_config: {
        ...(chosen.provider_config ?? {}),
        ...(providerConfig as Record<string, unknown>),
      },
      error_message: null,
      next_retry_at: null,
      locked_at: args.action === "post_now" ? now : null,
      updated_at: now,
    })
    .eq("id", chosen.id)
    .in("status", ["pending", "failed"])
    .select("*")
    .maybeSingle();

  if (updateError) throw new Error(updateError.message);
  if (!updated) throw new Error("already_publishing");
  return updated as ScheduledPostRow;
}

export async function insertPlatformScheduleForTarget(
  admin: SupabaseClient,
  args: InsertPlatformScheduleArgs,
): Promise<ScheduledPostRow> {
  const platform = String(args.target.platform ?? "").trim();
  const accountId = String(args.target.account_id ?? "").trim();
  const accountLabel = String(args.target.account_label ?? "").trim();

  if (!platform || !accountId) {
    throw new Error("invalid_target");
  }

  try {
    assertPlatformCanSchedule(platform);
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : "platform_not_supported");
  }

  const scheduledAt = new Date(args.scheduledAtIso);
  if (Number.isNaN(scheduledAt.getTime())) {
    throw new Error("invalid_scheduled_at");
  }

  const status = args.action === "post_now" ? "publishing" : "pending";
  const baseInsert = {
    organization_id: args.organizationId,
    social_media_plan_id: args.planId,
    delivery_mode: "api_auto",
    status,
    scheduled_at: scheduledAt.toISOString(),
    timezone: DEFAULT_TIMEZONE,
    media_source: args.mediaSource?.trim() || MEDIA_SOURCE_GOOGLE_DRIVE,
    media_url_snapshot: args.driveLink,
    caption: args.caption,
    title: args.title,
    scheduled_by: args.userId,
    platform_account_id: accountId,
  };

  switch (platform) {
    case "TikTok": {
      const { data: tokenRow } = await admin
        .from("organization_tiktok_content_connection_tokens")
        .select("oauth_scopes, publish_oauth_scopes, publish_access_token_enc")
        .eq("organization_id", args.organizationId)
        .eq("open_id", accountId)
        .maybeSingle();

      const scopeForPublish = (tokenRow?.publish_oauth_scopes as string | null) ??
        (tokenRow?.oauth_scopes as string | null);
      if (!tokenRow?.publish_access_token_enc) {
        throw new Error("publish_login_kit_token_missing");
      }
      if (!tiktokContentScopesIncludePublish(scopeForPublish)) {
        throw new Error("publish_scopes_not_granted");
      }

      const privacyLevelRaw = String(args.target.privacy_level ?? "").trim().toUpperCase();
      const privacyLevel = privacyLevelRaw || DEFAULT_PRIVACY_LEVEL;

      const providerConfig: TikTokProviderConfig & { employee_id?: string } = {
        open_id: accountId,
        account_label: accountLabel,
        ...(args.employeeId ? { employee_id: args.employeeId } : {}),
      };

      const reused = await reuseUnpublishedSchedule(
        admin,
        args,
        "TikTok",
        accountId,
        privacyLevel,
        providerConfig,
      );
      if (reused) return reused;

      await cancelPendingSchedulesForPlatformAccount(admin, args.planId, "TikTok", accountId);

      const { data, error } = await admin
        .from("social_media_scheduled_posts")
        .insert({
          ...baseInsert,
          platform: "TikTok",
          privacy_level: privacyLevel,
          provider_config: providerConfig,
        })
        .select("*")
        .single();

      if (error || !data) throw new Error(error?.message ?? "schedule_insert_failed");
      return data as ScheduledPostRow;
    }

    case "YouTube": {
      const { data: tokenRow } = await admin
        .from("organization_youtube_content_connection_tokens")
        .select("oauth_scopes")
        .eq("organization_id", args.organizationId)
        .eq("channel_id", accountId)
        .maybeSingle();

      const scopes = parseYouTubeOAuthScopes(tokenRow?.oauth_scopes);
      if (!youtubeContentScopesIncludeUpload(scopes)) {
        throw new Error("upload_scopes_not_granted");
      }

      const privacyLevel =
        normalizeYouTubeSchedulePrivacy(args.target.privacy_level) ??
        DEFAULT_YOUTUBE_SCHEDULE_PRIVACY;

      const providerConfig: YouTubeProviderConfig = {
        channel_id: accountId,
        account_label: accountLabel,
        ...(args.employeeId ? { employee_id: args.employeeId } : {}),
      };

      const reused = await reuseUnpublishedSchedule(
        admin,
        args,
        "YouTube",
        accountId,
        privacyLevel,
        providerConfig,
      );
      if (reused) return reused;

      await cancelPendingSchedulesForPlatformAccount(admin, args.planId, "YouTube", accountId);

      const { data, error } = await admin
        .from("social_media_scheduled_posts")
        .insert({
          ...baseInsert,
          platform: "YouTube",
          privacy_level: privacyLevel,
          provider_config: providerConfig,
        })
        .select("*")
        .single();

      if (error || !data) throw new Error(error?.message ?? "schedule_insert_failed");
      return data as ScheduledPostRow;
    }

    case "Instagram": {
      const account = await resolveMetaContentAccount(
        admin,
        args.organizationId,
        "instagram",
        accountId,
      );
      if (!account) throw new Error("instagram_account_not_found");
      if (!instagramPublishScopesOk(account.grantedScopes)) {
        throw new Error("publish_scopes_not_granted");
      }

      const providerConfig: InstagramProviderConfig = {
        instagram_business_account_id: accountId,
        facebook_page_id: account.pageId,
        account_label: accountLabel || account.accountLabel,
        ...(args.employeeId ? { employee_id: args.employeeId } : {}),
      };

      const reused = await reuseUnpublishedSchedule(
        admin,
        args,
        "Instagram",
        accountId,
        DEFAULT_PRIVACY_LEVEL,
        providerConfig,
      );
      if (reused) return reused;

      await cancelPendingSchedulesForPlatformAccount(
        admin,
        args.planId,
        "Instagram",
        accountId,
      );

      const { data, error } = await admin
        .from("social_media_scheduled_posts")
        .insert({
          ...baseInsert,
          platform: "Instagram",
          privacy_level: DEFAULT_PRIVACY_LEVEL,
          provider_config: providerConfig,
        })
        .select("*")
        .single();

      if (error || !data) throw new Error(error?.message ?? "schedule_insert_failed");
      return data as ScheduledPostRow;
    }

    case "Facebook": {
      const account = await resolveMetaContentAccount(
        admin,
        args.organizationId,
        "facebook",
        accountId,
      );
      if (!account) throw new Error("facebook_page_not_found");
      if (!facebookPublishScopesOk(account.grantedScopes)) {
        throw new Error("publish_scopes_not_granted");
      }

      const providerConfig: FacebookProviderConfig = {
        facebook_page_id: accountId,
        account_label: accountLabel || account.accountLabel,
        ...(args.employeeId ? { employee_id: args.employeeId } : {}),
      };

      const reused = await reuseUnpublishedSchedule(
        admin,
        args,
        "Facebook",
        accountId,
        DEFAULT_PRIVACY_LEVEL,
        providerConfig,
      );
      if (reused) return reused;

      await cancelPendingSchedulesForPlatformAccount(
        admin,
        args.planId,
        "Facebook",
        accountId,
      );

      const { data, error } = await admin
        .from("social_media_scheduled_posts")
        .insert({
          ...baseInsert,
          platform: "Facebook",
          privacy_level: DEFAULT_PRIVACY_LEVEL,
          provider_config: providerConfig,
        })
        .select("*")
        .single();

      if (error || !data) throw new Error(error?.message ?? "schedule_insert_failed");
      return data as ScheduledPostRow;
    }

    case "LinkedIn": {
      const { data: accountRow } = await admin
        .from("organization_linkedin_content_accounts")
        .select("label, display_name, granted_scopes")
        .eq("organization_id", args.organizationId)
        .eq("page_id", accountId)
        .eq("is_active", true)
        .maybeSingle();

      if (!accountRow) throw new Error("linkedin_account_not_found");

      const granted = parseLinkedInGrantedScopes(accountRow.granted_scopes);
      if (missingLinkedInScopesForFeature(granted, "publish").length > 0) {
        throw new Error("publish_scopes_not_granted");
      }

      const providerConfig: LinkedInProviderConfig = {
        page_id: accountId,
        organization_urn: buildOrganizationUrn(accountId),
        account_label: accountLabel ||
          String(accountRow.display_name ?? accountRow.label ?? "LinkedIn"),
        ...(args.employeeId ? { employee_id: args.employeeId } : {}),
      };

      const reused = await reuseUnpublishedSchedule(
        admin,
        args,
        "LinkedIn",
        accountId,
        DEFAULT_PRIVACY_LEVEL,
        providerConfig,
      );
      if (reused) return reused;

      await cancelPendingSchedulesForPlatformAccount(admin, args.planId, "LinkedIn", accountId);

      const { data, error } = await admin
        .from("social_media_scheduled_posts")
        .insert({
          ...baseInsert,
          platform: "LinkedIn",
          privacy_level: DEFAULT_PRIVACY_LEVEL,
          provider_config: providerConfig,
        })
        .select("*")
        .single();

      if (error || !data) throw new Error(error?.message ?? "schedule_insert_failed");
      return data as ScheduledPostRow;
    }

    default:
      throw new Error(`unsupported_platform:${platform}`);
  }
}

export async function insertPostNowScheduleForTarget(
  admin: SupabaseClient,
  args: InsertPostNowScheduleArgs,
): Promise<ScheduledPostRow> {
  return insertPlatformScheduleForTarget(admin, {
    ...args,
    action: "post_now",
    scheduledAtIso: new Date().toISOString(),
  });
}

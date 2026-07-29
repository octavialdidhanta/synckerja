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
};

export type InsertPostNowScheduleArgs = Omit<
  InsertPlatformScheduleArgs,
  "action" | "scheduledAtIso"
>;

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
    media_source: MEDIA_SOURCE_GOOGLE_DRIVE,
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

      await cancelPendingSchedulesForPlatformAccount(admin, args.planId, "TikTok", accountId);

      const privacyLevelRaw = String(args.target.privacy_level ?? "").trim().toUpperCase();
      const privacyLevel = privacyLevelRaw || DEFAULT_PRIVACY_LEVEL;

      const providerConfig: TikTokProviderConfig & { employee_id?: string } = {
        open_id: accountId,
        account_label: accountLabel,
        ...(args.employeeId ? { employee_id: args.employeeId } : {}),
      };

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

      await cancelPendingSchedulesForPlatformAccount(admin, args.planId, "YouTube", accountId);

      const privacyLevel =
        normalizeYouTubeSchedulePrivacy(args.target.privacy_level) ??
        DEFAULT_YOUTUBE_SCHEDULE_PRIVACY;

      const providerConfig: YouTubeProviderConfig = {
        channel_id: accountId,
        account_label: accountLabel,
        ...(args.employeeId ? { employee_id: args.employeeId } : {}),
      };

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

      await cancelPendingSchedulesForPlatformAccount(
        admin,
        args.planId,
        "Instagram",
        accountId,
      );

      const providerConfig: InstagramProviderConfig = {
        instagram_business_account_id: accountId,
        facebook_page_id: account.pageId,
        account_label: accountLabel || account.accountLabel,
        ...(args.employeeId ? { employee_id: args.employeeId } : {}),
      };

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

      await cancelPendingSchedulesForPlatformAccount(
        admin,
        args.planId,
        "Facebook",
        accountId,
      );

      const providerConfig: FacebookProviderConfig = {
        facebook_page_id: accountId,
        account_label: accountLabel || account.accountLabel,
        ...(args.employeeId ? { employee_id: args.employeeId } : {}),
      };

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

      await cancelPendingSchedulesForPlatformAccount(admin, args.planId, "LinkedIn", accountId);

      const providerConfig: LinkedInProviderConfig = {
        page_id: accountId,
        organization_urn: buildOrganizationUrn(accountId),
        account_label: accountLabel ||
          String(accountRow.display_name ?? accountRow.label ?? "LinkedIn"),
        ...(args.employeeId ? { employee_id: args.employeeId } : {}),
      };

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

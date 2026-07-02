import type { PlatformPublishFunction } from '../hooks/usePlatformScheduleMutations';
import { DEFAULT_YOUTUBE_SCHEDULE_PRIVACY } from './youtubeSchedulePrivacy';

export function getEdgeFunctionForPlatform(platform: string): PlatformPublishFunction {
  switch (platform.trim()) {
    case 'TikTok':
      return 'tiktok-content-publish';
    case 'YouTube':
      return 'youtube-content-publish';
    case 'Instagram':
      return 'meta-content-publish';
    case 'Facebook':
      return 'meta-content-publish';
    case 'LinkedIn':
      return 'linkedin-content-publish';
    default:
      throw new Error(`unsupported_platform:${platform}`);
  }
}

export function buildPlatformPublishPayload(
  platform: string,
  args: {
    organizationId: string;
    planId: string;
    accountId: string;
    accountLabel: string;
    scheduledAtIso?: string;
    caption: string;
    title?: string;
    employeeId?: string;
    privacyLevel?: string;
  },
): Record<string, unknown> {
  const base = {
    organization_id: args.organizationId,
    social_media_plan_id: args.planId,
    account_label: args.accountLabel,
    caption: args.caption,
    title: args.title ?? null,
    employee_id: args.employeeId ?? null,
  };

  switch (platform.trim()) {
    case 'TikTok':
      return {
        ...base,
        open_id: args.accountId,
        ...(args.scheduledAtIso ? { scheduled_at: args.scheduledAtIso } : {}),
      };
    case 'YouTube':
      return {
        ...base,
        channel_id: args.accountId,
        scheduled_at: args.scheduledAtIso,
        privacy_level: args.privacyLevel ?? DEFAULT_YOUTUBE_SCHEDULE_PRIVACY,
      };
    case 'Instagram':
      return {
        ...base,
        instagram_business_account_id: args.accountId,
        scheduled_at: args.scheduledAtIso,
      };
    case 'Facebook':
      return {
        ...base,
        facebook_page_id: args.accountId,
        scheduled_at: args.scheduledAtIso,
      };
    case 'LinkedIn':
      return {
        ...base,
        page_id: args.accountId,
        scheduled_at: args.scheduledAtIso,
      };
    default:
      throw new Error(`unsupported_platform:${platform}`);
  }
}

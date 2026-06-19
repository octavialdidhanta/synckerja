import type { LinkedInContentPostsResponse } from "@/linkedin-content/hooks/useLinkedInContentPostsQuery";
import type { TikTokContentVideosResponse } from "@/tiktok-content/hooks/useTikTokContentVideosQuery";
import type { YouTubeContentVideosResponse } from "@/youtube-content/hooks/useYouTubeContentVideosQuery";
import type { ThreadsContentMetricsPayload } from "@/threads-content/hooks/useThreadsContentMetrics";
import { THREADS_CONTENT_DIGITAL_MARKETING_BASE_PATH } from "@/threads-content/settings/threadsContentSettingsPaths";
import {
  LINKEDIN_CONTENT_DIGITAL_MARKETING_BASE_PATH,
  LINKEDIN_CONTENT_DIGITAL_MARKETING_SETTINGS_PATH,
} from "@/linkedin-content/settings/linkedinContentSettingsPaths";
import {
  TIKTOK_CONTENT_DIGITAL_MARKETING_BASE_PATH,
  TIKTOK_CONTENT_DIGITAL_MARKETING_SETTINGS_PATH,
} from "@/tiktok-content/settings/tiktokContentSettingsPaths";
import {
  YOUTUBE_CONTENT_DIGITAL_MARKETING_BASE_PATH,
  YOUTUBE_CONTENT_DIGITAL_MARKETING_SETTINGS_PATH,
} from "@/youtube-content/settings/youtubeContentSettingsPaths";
import type { MetaContentMetricsPayload } from "@/meta-platform/types/metaContentTypes";
import {
  SOCIAL_MEDIA_PERFORMANCE_FACEBOOK_PATH,
  SOCIAL_MEDIA_PERFORMANCE_INSTAGRAM_PATH,
} from "@/6-0-social-media-performance/container/SocialMediaPerformanceHeaderAndTab";
import type {
  SocialMediaInsightAccountRow,
  SocialMediaInsightContentRow,
} from "@/6-0-social-media-performance-shared/socialMediaInsightTypes";

export function normalizeTikTokMetrics(
  payload: TikTokContentVideosResponse,
  avatarUrl: string | null,
): { account: SocialMediaInsightAccountRow; contentRows: SocialMediaInsightContentRow[] } {
  const total = payload.summary.video_count;
  const matched = payload.summary.matched_plans ?? 0;
  const contentRows: SocialMediaInsightContentRow[] = payload.rows.map((r) => ({
    platform: "tiktok",
    accountId: payload.open_id,
    contentId: r.video_id,
    postedAt: r.posted_at,
    viewCount: r.view_count,
    likeCount: r.like_count,
    commentCount: r.comment_count,
    shareCount: r.share_count,
    engagementRate: r.engagement_rate,
    planId: r.plan_id,
  }));

  return {
    account: {
      platform: "tiktok",
      accountId: payload.open_id,
      accountLabel: payload.account_label ?? payload.open_id,
      avatarUrl,
      connected: true,
      loading: false,
      error: null,
      audienceCount: payload.summary.follower_count ?? null,
      audienceHidden: false,
      audienceLabel: "followers",
      contentCount: total,
      totalViews: payload.summary.total_views,
      totalLikes: payload.summary.total_likes,
      totalComments: payload.summary.total_comments ?? 0,
      totalShares: payload.summary.total_shares ?? 0,
      avgEngagementRate: payload.summary.avg_engagement_rate,
      matchedPlans: matched,
      totalContent: total,
      hasUnmappedContent: total > 0 && matched < total,
      settingsPath: TIKTOK_CONTENT_DIGITAL_MARKETING_SETTINGS_PATH,
      performancePath: TIKTOK_CONTENT_DIGITAL_MARKETING_BASE_PATH,
      isPlatformPlaceholder: false,
    },
    contentRows,
  };
}

export function normalizeYouTubeMetrics(
  payload: YouTubeContentVideosResponse,
  avatarUrl: string | null,
): { account: SocialMediaInsightAccountRow; contentRows: SocialMediaInsightContentRow[] } {
  const total = payload.summary.video_count;
  const matched = payload.summary.matched_plans ?? 0;
  const subscriberCount = payload.summary.subscriber_count;
  const contentRows: SocialMediaInsightContentRow[] = payload.rows.map((r) => ({
    platform: "youtube",
    accountId: payload.channel_id,
    contentId: r.video_id,
    postedAt: r.posted_at,
    viewCount: r.view_count,
    likeCount: r.like_count,
    commentCount: r.comment_count,
    shareCount: r.share_count,
    engagementRate: r.engagement_rate,
    planId: r.plan_id,
  }));

  return {
    account: {
      platform: "youtube",
      accountId: payload.channel_id,
      accountLabel: payload.account_label ?? payload.channel_id,
      avatarUrl,
      connected: true,
      loading: false,
      error: null,
      audienceCount: subscriberCount,
      audienceHidden: subscriberCount == null,
      audienceLabel: "subscribers",
      contentCount: total,
      totalViews: payload.summary.total_views,
      totalLikes: payload.summary.total_likes,
      totalComments: payload.summary.total_comments ?? 0,
      totalShares: payload.summary.total_shares ?? 0,
      avgEngagementRate: payload.summary.avg_engagement_rate,
      matchedPlans: matched,
      totalContent: total,
      hasUnmappedContent: total > 0 && matched < total,
      settingsPath: YOUTUBE_CONTENT_DIGITAL_MARKETING_SETTINGS_PATH,
      performancePath: YOUTUBE_CONTENT_DIGITAL_MARKETING_BASE_PATH,
      isPlatformPlaceholder: false,
    },
    contentRows,
  };
}

export function normalizeLinkedInMetrics(
  payload: LinkedInContentPostsResponse,
  avatarUrl: string | null,
): { account: SocialMediaInsightAccountRow; contentRows: SocialMediaInsightContentRow[] } {
  const total = payload.summary.post_count;
  const matched = payload.summary.matched_plans ?? 0;
  const audienceCount = payload.audience_count ?? null;
  const contentRows: SocialMediaInsightContentRow[] = payload.rows.map((r) => ({
    platform: "linkedin",
    accountId: payload.page_id,
    contentId: r.post_id,
    postedAt: r.posted_at,
    viewCount: r.view_count,
    likeCount: r.like_count,
    commentCount: r.comment_count,
    shareCount: r.share_count,
    engagementRate: r.engagement_rate,
    planId: r.plan_id,
  }));

  return {
    account: {
      platform: "linkedin",
      accountId: payload.page_id,
      accountLabel: payload.account_label ?? payload.page_id,
      avatarUrl,
      connected: true,
      loading: false,
      error: null,
      audienceCount,
      audienceHidden: false,
      audienceLabel: audienceCount != null ? "followers" : null,
      contentCount: total,
      totalViews: payload.summary.total_views,
      totalLikes: payload.summary.total_likes,
      totalComments: payload.summary.total_comments ?? 0,
      totalShares: payload.summary.total_shares ?? 0,
      avgEngagementRate: payload.summary.avg_engagement_rate,
      matchedPlans: matched,
      totalContent: total,
      hasUnmappedContent: total > 0 && matched < total,
      settingsPath: LINKEDIN_CONTENT_DIGITAL_MARKETING_SETTINGS_PATH,
      performancePath: LINKEDIN_CONTENT_DIGITAL_MARKETING_BASE_PATH,
      isPlatformPlaceholder: false,
    },
    contentRows,
  };
}

export function normalizeMetaMetrics(
  payload: MetaContentMetricsPayload,
  avatarUrl: string | null,
): { account: SocialMediaInsightAccountRow; contentRows: SocialMediaInsightContentRow[] } {
  const acc = payload.account;
  const total = acc.content_count;
  const contentRows: SocialMediaInsightContentRow[] = payload.posts.map((r) => ({
    platform: r.platform,
    accountId: r.account_id,
    contentId: r.content_id,
    postedAt: r.posted_at,
    viewCount: r.view_count,
    likeCount: r.like_count,
    commentCount: r.comment_count,
    shareCount: r.share_count,
    engagementRate: r.engagement_rate,
    planId: null,
  }));

  const performancePath =
    acc.platform === "instagram"
      ? SOCIAL_MEDIA_PERFORMANCE_INSTAGRAM_PATH
      : SOCIAL_MEDIA_PERFORMANCE_FACEBOOK_PATH;

  return {
    account: {
      platform: acc.platform,
      accountId: acc.account_id,
      accountLabel: acc.account_label,
      avatarUrl,
      connected: true,
      loading: false,
      error: null,
      audienceCount: acc.audience_count ?? null,
      audienceHidden: acc.audience_hidden ?? false,
      audienceLabel: acc.audience_label ?? "followers",
      contentCount: total,
      totalViews: acc.total_views ?? acc.impressions ?? 0,
      totalLikes: acc.total_likes,
      totalComments: acc.total_comments,
      totalShares: acc.total_shares,
      avgEngagementRate: acc.avg_engagement_rate,
      matchedPlans: 0,
      totalContent: total,
      hasUnmappedContent: false,
      settingsPath: "/omnichannel/integrations/instagram",
      performancePath,
      isPlatformPlaceholder: false,
    },
    contentRows,
  };
}

export function normalizeThreadsMetrics(
  payload: ThreadsContentMetricsPayload,
  avatarUrl: string | null,
): { account: SocialMediaInsightAccountRow; contentRows: SocialMediaInsightContentRow[] } {
  const acc = payload.account;
  const contentRows: SocialMediaInsightContentRow[] = payload.posts.map((r) => ({
    platform: "threads",
    accountId: acc.account_id,
    contentId: r.content_id,
    postedAt: r.posted_at,
    viewCount: r.view_count,
    likeCount: r.like_count,
    commentCount: r.comment_count,
    shareCount: r.share_count,
    engagementRate: r.engagement_rate,
    planId: null,
  }));

  return {
    account: {
      platform: "threads",
      accountId: acc.account_id,
      accountLabel: acc.account_label,
      avatarUrl: avatarUrl ?? acc.avatar_url,
      connected: true,
      loading: false,
      error: null,
      audienceCount: acc.audience_count,
      audienceHidden: false,
      audienceLabel: acc.audience_count != null ? "followers" : null,
      contentCount: acc.content_count,
      totalViews: acc.total_views,
      totalLikes: acc.total_likes,
      totalComments: acc.total_comments,
      totalShares: acc.total_shares,
      avgEngagementRate: acc.avg_engagement_rate,
      matchedPlans: 0,
      totalContent: acc.content_count,
      hasUnmappedContent: false,
      settingsPath: "/omnichannel/integrations/instagram",
      performancePath: THREADS_CONTENT_DIGITAL_MARKETING_BASE_PATH,
      isPlatformPlaceholder: false,
    },
    contentRows,
  };
}

export function buildPlatformPlaceholderRow(
  platform: SocialMediaInsightAccountRow["platform"],
): SocialMediaInsightAccountRow {
  const paths = {
    tiktok: {
      settings: TIKTOK_CONTENT_DIGITAL_MARKETING_SETTINGS_PATH,
      performance: TIKTOK_CONTENT_DIGITAL_MARKETING_BASE_PATH,
      audienceLabel: "followers" as const,
    },
    youtube: {
      settings: YOUTUBE_CONTENT_DIGITAL_MARKETING_SETTINGS_PATH,
      performance: YOUTUBE_CONTENT_DIGITAL_MARKETING_BASE_PATH,
      audienceLabel: "subscribers" as const,
    },
    linkedin: {
      settings: LINKEDIN_CONTENT_DIGITAL_MARKETING_SETTINGS_PATH,
      performance: LINKEDIN_CONTENT_DIGITAL_MARKETING_BASE_PATH,
      audienceLabel: "followers" as const,
    },
    threads: {
      settings: "/omnichannel/integrations/instagram",
      performance: THREADS_CONTENT_DIGITAL_MARKETING_BASE_PATH,
      audienceLabel: "followers" as const,
    },
    instagram: {
      settings: "/omnichannel/integrations/instagram",
      performance: SOCIAL_MEDIA_PERFORMANCE_INSTAGRAM_PATH,
      audienceLabel: "followers" as const,
    },
    facebook: {
      settings: "/omnichannel/integrations/instagram",
      performance: SOCIAL_MEDIA_PERFORMANCE_FACEBOOK_PATH,
      audienceLabel: "followers" as const,
    },
  }[platform];

  return {
    platform,
    accountId: "",
    accountLabel: "",
    avatarUrl: null,
    connected: false,
    loading: false,
    error: null,
    audienceCount: null,
    audienceHidden: false,
    audienceLabel: paths.audienceLabel,
    contentCount: 0,
    totalViews: 0,
    totalLikes: 0,
    totalComments: 0,
    totalShares: 0,
    avgEngagementRate: null,
    matchedPlans: 0,
    totalContent: 0,
    hasUnmappedContent: false,
    settingsPath: paths.settings,
    performancePath: paths.performance,
    isPlatformPlaceholder: true,
  };
}

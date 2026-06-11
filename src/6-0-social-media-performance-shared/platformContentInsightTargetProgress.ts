import type { TikTokContentVideosResponse } from "@/tiktok-content/hooks/useTikTokContentVideosQuery";
import type { YouTubeContentVideosResponse } from "@/youtube-content/hooks/useYouTubeContentVideosQuery";
import type {
  SocialMediaInsightAccountRow,
  SocialMediaInsightSummary,
} from "@/6-0-social-media-performance-shared/socialMediaInsightTypes";

export function tiktokSummaryToInsightSummary(
  summary: TikTokContentVideosResponse["summary"],
): SocialMediaInsightSummary {
  return {
    totalAudience: summary.follower_count,
    totalViews: summary.total_views,
    totalLikes: summary.total_likes,
    totalComments: summary.total_comments,
    totalShares: summary.total_shares,
    avgEngagementRate: summary.avg_engagement_rate,
  };
}

export function tiktokAccountRowForTargetProgress(
  openId: string,
  summary: TikTokContentVideosResponse["summary"],
  accountLabel: string | null,
): SocialMediaInsightAccountRow {
  return {
    platform: "tiktok",
    accountId: openId,
    accountLabel: accountLabel?.trim() || "TikTok",
    avatarUrl: null,
    connected: true,
    loading: false,
    error: null,
    audienceCount: summary.follower_count,
    audienceHidden: false,
    audienceLabel: "followers",
    contentCount: summary.video_count,
    totalViews: summary.total_views,
    totalLikes: summary.total_likes,
    totalComments: summary.total_comments,
    totalShares: summary.total_shares,
    avgEngagementRate: summary.avg_engagement_rate,
    matchedPlans: summary.matched_plans,
    totalContent: summary.video_count,
    hasUnmappedContent: false,
    settingsPath: "",
    performancePath: "",
    isPlatformPlaceholder: false,
  };
}

export function youtubeSummaryToInsightSummary(
  summary: YouTubeContentVideosResponse["summary"],
): SocialMediaInsightSummary {
  return {
    totalAudience: summary.subscriber_count,
    totalViews: summary.total_views,
    totalLikes: summary.total_likes,
    totalComments: summary.total_comments,
    totalShares: summary.total_shares,
    avgEngagementRate: summary.avg_engagement_rate,
  };
}

export function youtubeAccountRowForTargetProgress(
  channelId: string,
  summary: YouTubeContentVideosResponse["summary"],
  accountLabel: string | null,
): SocialMediaInsightAccountRow {
  const hasSubscribers = summary.subscriber_count != null;

  return {
    platform: "youtube",
    accountId: channelId,
    accountLabel: accountLabel?.trim() || "YouTube",
    avatarUrl: null,
    connected: true,
    loading: false,
    error: null,
    audienceCount: summary.subscriber_count,
    audienceHidden: !hasSubscribers,
    audienceLabel: "subscribers",
    contentCount: summary.video_count,
    totalViews: summary.total_views,
    totalLikes: summary.total_likes,
    totalComments: summary.total_comments,
    totalShares: summary.total_shares,
    avgEngagementRate: summary.avg_engagement_rate,
    matchedPlans: summary.matched_plans,
    totalContent: summary.video_count,
    hasUnmappedContent: false,
    settingsPath: "",
    performancePath: "",
    isPlatformPlaceholder: false,
  };
}

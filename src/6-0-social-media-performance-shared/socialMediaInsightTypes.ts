export type SocialMediaPlatform = "tiktok" | "youtube" | "linkedin";

export type SocialMediaPlatformFilter = "all" | SocialMediaPlatform;

export type SocialMediaInsightContentRow = {
  platform: SocialMediaPlatform;
  accountId: string;
  contentId: string;
  postedAt: string | null;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  engagementRate: number | null;
  planId: string | null;
};

export type SocialMediaInsightAccountRow = {
  platform: SocialMediaPlatform;
  accountId: string;
  accountLabel: string;
  avatarUrl: string | null;
  connected: boolean;
  loading: boolean;
  error: string | null;
  audienceCount: number | null;
  audienceHidden: boolean;
  audienceLabel: "followers" | "subscribers" | null;
  contentCount: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  avgEngagementRate: number | null;
  matchedPlans: number;
  totalContent: number;
  hasUnmappedContent: boolean;
  settingsPath: string;
  performancePath: string;
  isPlatformPlaceholder: boolean;
};

export type SocialMediaInsightSummary = {
  totalAudience: number | null;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  avgEngagementRate: number | null;
};

export type SocialMediaInsightMonthlyChartPoint = {
  monthKey: string;
  monthLabel: string;
  tiktok: number;
  youtube: number;
  linkedin: number;
  total: number;
};

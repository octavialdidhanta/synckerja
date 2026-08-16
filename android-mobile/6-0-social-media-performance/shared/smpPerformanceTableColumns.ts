import type { MobileSmpMetricsColumn } from "@/mobile/6-0-social-media-performance/components/MobileSmpMetricsTable";

type Translate = (key: string, fallback: string) => string;

export function smpContentPerformanceColumns(
  t: Translate,
  primaryLabel: string,
): MobileSmpMetricsColumn[] {
  return [
    { key: "name", label: primaryLabel, primary: true },
    { key: "views", label: t("digitalMarketing.tiktokContent.colViews", "Views"), align: "right" },
    { key: "likes", label: t("digitalMarketing.tiktokContent.colLikes", "Likes"), align: "right" },
    {
      key: "comments",
      label: t("digitalMarketing.tiktokContent.colComments", "Comments"),
      align: "right",
    },
    {
      key: "shares",
      label: t("digitalMarketing.tiktokContent.colShares", "Shares"),
      align: "right",
    },
    {
      key: "engagement",
      label: t("digitalMarketing.tiktokContent.colEngagement", "Engagement"),
      align: "right",
    },
    {
      key: "posted",
      label: t("digitalMarketing.tiktokContent.colPosted", "Posted"),
      align: "right",
    },
  ];
}

/** Same column set as desktop `TikTokContentVideosTable`. */
export function smpTikTokContentPerformanceColumns(t: Translate): MobileSmpMetricsColumn[] {
  return [
    { key: "name", label: t("digitalMarketing.tiktokContent.colVideo", "Video"), primary: true },
    {
      key: "link",
      label: t("digitalMarketing.tiktokContent.colLink", "Link"),
      maxWidthClass: "max-w-[10rem]",
    },
    { key: "service", label: t("digitalMarketing.tiktokContent.colService", "Service") },
    { key: "pillar", label: t("digitalMarketing.tiktokContent.colPillar", "Pillar") },
    { key: "views", label: t("digitalMarketing.tiktokContent.colViews", "Views"), align: "right" },
    { key: "likes", label: t("digitalMarketing.tiktokContent.colLikes", "Likes"), align: "right" },
    {
      key: "comments",
      label: t("digitalMarketing.tiktokContent.colComments", "Comments"),
      align: "right",
    },
    {
      key: "shares",
      label: t("digitalMarketing.tiktokContent.colShares", "Shares"),
      align: "right",
    },
    {
      key: "engagement",
      label: t("digitalMarketing.tiktokContent.colEngagement", "Engagement"),
      align: "right",
    },
    {
      key: "posted",
      label: t("digitalMarketing.tiktokContent.colPosted", "Posted"),
    },
  ];
}

/** Same column set as desktop `YouTubeContentVideosTable`. */
export function smpYouTubeContentPerformanceColumns(t: Translate): MobileSmpMetricsColumn[] {
  return [
    { key: "name", label: t("digitalMarketing.youtubeContent.colVideo", "Video"), primary: true },
    {
      key: "link",
      label: t("digitalMarketing.youtubeContent.colLink", "Link"),
      maxWidthClass: "max-w-[10rem]",
    },
    { key: "service", label: t("digitalMarketing.youtubeContent.colService", "Service") },
    { key: "pillar", label: t("digitalMarketing.youtubeContent.colPillar", "Pillar") },
    { key: "views", label: t("digitalMarketing.youtubeContent.colViews", "Views"), align: "right" },
    { key: "likes", label: t("digitalMarketing.youtubeContent.colLikes", "Likes"), align: "right" },
    {
      key: "comments",
      label: t("digitalMarketing.youtubeContent.colComments", "Comments"),
      align: "right",
    },
    {
      key: "shares",
      label: t("digitalMarketing.youtubeContent.colShares", "Shares"),
      align: "right",
    },
    {
      key: "subscribe",
      label: t("digitalMarketing.youtubeContent.colSubscribe", "Subscribe"),
      align: "right",
    },
    {
      key: "engagement",
      label: t("digitalMarketing.youtubeContent.colEngagement", "Engagement"),
      align: "right",
    },
    { key: "posted", label: t("digitalMarketing.youtubeContent.colPosted", "Posted") },
  ];
}

export function formatSmpPostedAt(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString();
}

/** Same column set as desktop `MetaContentPostsTable`. */
export function smpMetaContentPerformanceColumns(t: Translate): MobileSmpMetricsColumn[] {
  return [
    { key: "caption", label: t("metaPlatform.performance.caption", "Caption"), primary: true },
    {
      key: "link",
      label: t("digitalMarketing.metaContent.colLink", "Link"),
      maxWidthClass: "max-w-[10rem]",
    },
    { key: "service", label: t("digitalMarketing.metaContent.colService", "Service") },
    { key: "pillar", label: t("digitalMarketing.metaContent.colPillar", "Pillar") },
    { key: "posted", label: t("digitalMarketing.metaContent.colPosted", "Posted") },
    { key: "views", label: t("metaPlatform.performance.views", "Views"), align: "right" },
    { key: "reach", label: t("metaPlatform.performance.reach", "Reach"), align: "right" },
    {
      key: "avgWatchTime",
      label: t("digitalMarketing.metaContent.colAvgWatchTime", "Avg. watch time"),
      align: "right",
    },
    { key: "likes", label: t("metaPlatform.performance.likes", "Likes"), align: "right" },
    { key: "comments", label: t("metaPlatform.performance.comments", "Comments"), align: "right" },
    { key: "shares", label: t("digitalMarketing.metaContent.colShares", "Shares"), align: "right" },
    { key: "saved", label: t("digitalMarketing.metaContent.colSaved", "Saved"), align: "right" },
    {
      key: "engagement",
      label: t("digitalMarketing.metaContent.colEngagement", "Engagement"),
      align: "right",
    },
  ];
}

export function resolveSmpMetaPostLabel(row: {
  caption?: string | null;
  permalink?: string | null;
  posted_at?: string | null;
}): string {
  const caption = row.caption?.trim();
  if (caption) return caption;

  const permalink = row.permalink?.trim() ?? "";
  const shortcode =
    permalink.match(/\/(?:reel|reels|p|tv)\/([^/?#]+)/i)?.[1] ??
    permalink.match(/instagram\.com\/([^/?#]+)/i)?.[1];
  if (shortcode && shortcode !== "reel" && shortcode !== "p") return shortcode;

  if (row.posted_at) return formatSmpPostedAt(row.posted_at);
  return "—";
}

/** Same column set as desktop `SocialMediaInsightReportAccountTable`. */
export function smpInsightReportColumns(t: Translate): MobileSmpMetricsColumn[] {
  return [
    { key: "platform", label: t("digitalMarketing.socialMediaInsightReport.colPlatform", "Platform") },
    {
      key: "account",
      label: t("digitalMarketing.socialMediaInsightReport.colAccount", "Account"),
      primary: true,
    },
    {
      key: "audience",
      label: t("digitalMarketing.socialMediaInsightReport.colAudience", "Audience"),
      align: "right",
    },
    {
      key: "content",
      label: t("digitalMarketing.socialMediaInsightReport.colContent", "Content"),
      align: "right",
    },
    { key: "views", label: t("digitalMarketing.socialMediaInsightReport.colViews", "Views"), align: "right" },
    { key: "likes", label: t("digitalMarketing.socialMediaInsightReport.colLikes", "Likes"), align: "right" },
    {
      key: "comments",
      label: t("digitalMarketing.socialMediaInsightReport.colComments", "Comments"),
      align: "right",
    },
    { key: "shares", label: t("digitalMarketing.socialMediaInsightReport.colShares", "Shares"), align: "right" },
    {
      key: "engagement",
      label: t("digitalMarketing.socialMediaInsightReport.colEngagement", "Engagement"),
      align: "right",
    },
    {
      key: "planMatched",
      label: t("digitalMarketing.socialMediaInsightReport.colPlanMatched", "Plan matched"),
      align: "right",
    },
    { key: "status", label: t("digitalMarketing.socialMediaInsightReport.colStatus", "Status") },
    { key: "action", label: t("digitalMarketing.socialMediaInsightReport.colAction", "Action") },
  ];
}

export function smpInsightPlatformLabel(
  platform: "tiktok" | "youtube" | "linkedin" | "instagram" | "facebook" | "threads",
  t: Translate,
): string {
  switch (platform) {
    case "tiktok":
      return t("digitalMarketing.socialMediaPerformance.platformTikTok", "TikTok");
    case "youtube":
      return t("digitalMarketing.socialMediaPerformance.platformYouTube", "YouTube");
    case "linkedin":
      return t("digitalMarketing.socialMediaPerformance.platformLinkedIn", "LinkedIn");
    case "instagram":
      return t("digitalMarketing.socialMediaPerformance.platformInstagram", "Instagram");
    case "facebook":
      return t("digitalMarketing.socialMediaPerformance.platformFacebook", "Facebook");
    case "threads":
      return t("digitalMarketing.socialMediaPerformance.platformThreads", "Threads");
  }
}

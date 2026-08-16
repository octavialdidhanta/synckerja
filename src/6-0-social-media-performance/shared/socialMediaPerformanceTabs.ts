import type { ComponentType } from "react";
import { Facebook, FileText, Instagram, Linkedin, MessageSquare, Youtube } from "lucide-react";
import { ThreadsTabIcon } from "@/6-0-social-media-performance/components/ThreadsTabIcon";
import { TikTokTabIcon } from "@/6-0-traffic/container/TikTokTabIcon";

export const SOCIAL_MEDIA_PERFORMANCE_BASE_PATH = "/digital-marketing/social-media-performance";
export const SOCIAL_MEDIA_PERFORMANCE_TIKTOK_PATH =
  "/digital-marketing/social-media-performance/tiktok";
export const SOCIAL_MEDIA_PERFORMANCE_FACEBOOK_PATH =
  "/digital-marketing/social-media-performance/facebook";
export const SOCIAL_MEDIA_PERFORMANCE_INSTAGRAM_PATH =
  "/digital-marketing/social-media-performance/instagram";
export const SOCIAL_MEDIA_PERFORMANCE_YOUTUBE_PATH =
  "/digital-marketing/social-media-performance/youtube";
export const SOCIAL_MEDIA_PERFORMANCE_LINKEDIN_PATH =
  "/digital-marketing/social-media-performance/linkedin";
export const SOCIAL_MEDIA_PERFORMANCE_THREADS_PATH =
  "/digital-marketing/social-media-performance/threads";
export const SOCIAL_MEDIA_PERFORMANCE_REPORT_PATH =
  "/digital-marketing/social-media-performance/report";
export const SOCIAL_MEDIA_PERFORMANCE_MANAGE_COMMENTS_PATH =
  "/digital-marketing/social-media-performance/manage-comments";

export type SocialMediaPerformanceTabId =
  | "tiktok"
  | "facebook"
  | "instagram"
  | "youtube"
  | "threads"
  | "linkedin"
  | "report"
  | "manage-comments";

export type SocialMediaPerformanceTab = {
  id: SocialMediaPerformanceTabId;
  path: string;
  labelKey: string;
  labelDefault: string;
  headerTitleKey: string;
  headerTitleDefault: string;
  pagePath: string;
  icon: ComponentType<{ className?: string }>;
  isActive: (pathname: string, reportPath?: string) => boolean;
};

export const SOCIAL_MEDIA_PERFORMANCE_TABS: SocialMediaPerformanceTab[] = [
  {
    id: "tiktok",
    path: SOCIAL_MEDIA_PERFORMANCE_TIKTOK_PATH,
    labelKey: "digitalMarketing.socialMediaPerformance.platformTikTok",
    labelDefault: "TikTok",
    headerTitleKey: "digitalMarketing.socialMediaPerformance.headerTikTok",
    headerTitleDefault: "TikTok Performance",
    pagePath: SOCIAL_MEDIA_PERFORMANCE_BASE_PATH,
    icon: TikTokTabIcon,
    isActive: (pathname) =>
      pathname.startsWith(SOCIAL_MEDIA_PERFORMANCE_TIKTOK_PATH) &&
      !pathname.startsWith(SOCIAL_MEDIA_PERFORMANCE_MANAGE_COMMENTS_PATH),
  },
  {
    id: "facebook",
    path: SOCIAL_MEDIA_PERFORMANCE_FACEBOOK_PATH,
    labelKey: "digitalMarketing.socialMediaPerformance.platformFacebook",
    labelDefault: "Facebook",
    headerTitleKey: "digitalMarketing.socialMediaPerformance.headerFacebook",
    headerTitleDefault: "Facebook Performance",
    pagePath: SOCIAL_MEDIA_PERFORMANCE_BASE_PATH,
    icon: Facebook,
    isActive: (pathname) => pathname.startsWith(SOCIAL_MEDIA_PERFORMANCE_FACEBOOK_PATH),
  },
  {
    id: "instagram",
    path: SOCIAL_MEDIA_PERFORMANCE_INSTAGRAM_PATH,
    labelKey: "digitalMarketing.socialMediaPerformance.platformInstagram",
    labelDefault: "Instagram",
    headerTitleKey: "digitalMarketing.socialMediaPerformance.headerInstagram",
    headerTitleDefault: "Instagram Performance",
    pagePath: SOCIAL_MEDIA_PERFORMANCE_BASE_PATH,
    icon: Instagram,
    isActive: (pathname) => pathname.startsWith(SOCIAL_MEDIA_PERFORMANCE_INSTAGRAM_PATH),
  },
  {
    id: "youtube",
    path: SOCIAL_MEDIA_PERFORMANCE_YOUTUBE_PATH,
    labelKey: "digitalMarketing.socialMediaPerformance.platformYouTube",
    labelDefault: "YouTube",
    headerTitleKey: "digitalMarketing.socialMediaPerformance.headerYouTube",
    headerTitleDefault: "YouTube Performance",
    pagePath: SOCIAL_MEDIA_PERFORMANCE_BASE_PATH,
    icon: Youtube,
    isActive: (pathname) => pathname.startsWith(SOCIAL_MEDIA_PERFORMANCE_YOUTUBE_PATH),
  },
  {
    id: "threads",
    path: SOCIAL_MEDIA_PERFORMANCE_THREADS_PATH,
    labelKey: "digitalMarketing.socialMediaPerformance.platformThreads",
    labelDefault: "Threads",
    headerTitleKey: "digitalMarketing.socialMediaPerformance.headerThreads",
    headerTitleDefault: "Threads Performance",
    pagePath: SOCIAL_MEDIA_PERFORMANCE_BASE_PATH,
    icon: ThreadsTabIcon,
    isActive: (pathname) => pathname.startsWith(SOCIAL_MEDIA_PERFORMANCE_THREADS_PATH),
  },
  {
    id: "linkedin",
    path: SOCIAL_MEDIA_PERFORMANCE_LINKEDIN_PATH,
    labelKey: "digitalMarketing.socialMediaPerformance.platformLinkedIn",
    labelDefault: "LinkedIn",
    headerTitleKey: "digitalMarketing.socialMediaPerformance.headerLinkedIn",
    headerTitleDefault: "LinkedIn Performance",
    pagePath: SOCIAL_MEDIA_PERFORMANCE_BASE_PATH,
    icon: Linkedin,
    isActive: (pathname) => pathname.startsWith(SOCIAL_MEDIA_PERFORMANCE_LINKEDIN_PATH),
  },
  {
    id: "report",
    path: SOCIAL_MEDIA_PERFORMANCE_REPORT_PATH,
    labelKey: "digitalMarketing.socialMediaInsightReport.tabReport",
    labelDefault: "Report",
    headerTitleKey: "digitalMarketing.socialMediaInsightReport.title",
    headerTitleDefault: "Report",
    pagePath: SOCIAL_MEDIA_PERFORMANCE_BASE_PATH,
    icon: FileText,
    isActive: (pathname, reportPath = SOCIAL_MEDIA_PERFORMANCE_REPORT_PATH) =>
      pathname.startsWith(reportPath),
  },
  {
    id: "manage-comments",
    path: `${SOCIAL_MEDIA_PERFORMANCE_MANAGE_COMMENTS_PATH}/tiktok`,
    labelKey: "digitalMarketing.manageComments.tab",
    labelDefault: "Comment",
    headerTitleKey: "digitalMarketing.manageComments.headerTitle",
    headerTitleDefault: "Manage Comment",
    pagePath: SOCIAL_MEDIA_PERFORMANCE_BASE_PATH,
    icon: MessageSquare,
    isActive: (pathname) => pathname.startsWith(SOCIAL_MEDIA_PERFORMANCE_MANAGE_COMMENTS_PATH),
  },
];

export function getSocialMediaPerformanceMobileHeader(pathname: string): {
  titleKey: string;
  titleDefault: string;
} {
  const tab = SOCIAL_MEDIA_PERFORMANCE_TABS.find((item) => item.isActive(pathname));
  if (tab) {
    return { titleKey: tab.headerTitleKey, titleDefault: tab.headerTitleDefault };
  }

  return {
    titleKey: "sidebar.digitalMarketing.socialMediaPerformance.title",
    titleDefault: "Social Media Performance",
  };
}


import { Facebook, FileText, Instagram, Linkedin, MessageSquare, Youtube } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ModuleTabNavItem } from "@/shared/auth/page-access/ModuleTabNavItem";
import { ThreadsTabIcon } from "@/6-0-social-media-performance/components/ThreadsTabIcon";
import { TikTokTabIcon } from "@/6-0-traffic/container/TikTokTabIcon";
import { cn } from "@/shared/lib/utils";

export const SOCIAL_MEDIA_PERFORMANCE_BASE_PATH = "/digital-marketing/social-media-performance";
export const SOCIAL_MEDIA_PERFORMANCE_TIKTOK_PATH =
  "/digital-marketing/social-media-performance/tiktok";
export const SOCIAL_MEDIA_PERFORMANCE_FACEBOOK_PATH =
  "/digital-marketing/social-media-performance/facebook";
export const SOCIAL_MEDIA_PERFORMANCE_YOUTUBE_PATH =
  "/digital-marketing/social-media-performance/youtube";
export const SOCIAL_MEDIA_PERFORMANCE_LINKEDIN_PATH =
  "/digital-marketing/social-media-performance/linkedin";
export const SOCIAL_MEDIA_PERFORMANCE_REPORT_PATH =
  "/digital-marketing/social-media-performance/report";
export const SOCIAL_MEDIA_PERFORMANCE_MANAGE_COMMENTS_PATH =
  "/digital-marketing/social-media-performance/manage-comments";

const tabClass =
  "flex items-center space-x-1.5 border-b-2 px-1 py-1.5 text-sm font-medium transition-colors";
const tabActive = "border-primary text-primary";
const tabInactive =
  "border-transparent text-muted-foreground hover:border-border hover:text-foreground";
const tabDisabled = "cursor-not-allowed border-transparent text-muted-foreground opacity-50";

type SocialMediaPerformanceHeaderAndTabProps = {
  activeReportPath?: string;
};

export function SocialMediaPerformanceHeaderAndTab({
  activeReportPath = SOCIAL_MEDIA_PERFORMANCE_REPORT_PATH,
}: SocialMediaPerformanceHeaderAndTabProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const isTikTok =
    location.pathname.startsWith(SOCIAL_MEDIA_PERFORMANCE_TIKTOK_PATH) &&
    !location.pathname.startsWith(SOCIAL_MEDIA_PERFORMANCE_MANAGE_COMMENTS_PATH);
  const isYouTube = location.pathname.startsWith(SOCIAL_MEDIA_PERFORMANCE_YOUTUBE_PATH);
  const isLinkedIn = location.pathname.startsWith(SOCIAL_MEDIA_PERFORMANCE_LINKEDIN_PATH);
  const isReport = location.pathname.startsWith(activeReportPath);
  const isManageComments = location.pathname.startsWith(
    SOCIAL_MEDIA_PERFORMANCE_MANAGE_COMMENTS_PATH,
  );

  const showComingSoon = () => {
    toast.info(
      t(
        "digitalMarketing.socialMediaPerformance.platformComingSoon",
        "Coming in a future release.",
      ),
    );
  };

  return (
    <div className="px-1 py-3">
      <div className="mb-3">
        <h1 className="mb-0.5 text-xl font-bold text-gray-900">
          {t("sidebar.digitalMarketing.socialMediaPerformance.title", "Social Media Performance")}
        </h1>
        <p className="text-xs text-gray-600">
          {t(
            "sidebar.digitalMarketing.socialMediaPerformance.description",
            "Monitor organic social content performance",
          )}
        </p>
      </div>

      <div className="-mb-3">
        <nav className="flex space-x-6" role="tablist">
          <ModuleTabNavItem
            pagePath={SOCIAL_MEDIA_PERFORMANCE_BASE_PATH}
            label={t("digitalMarketing.socialMediaPerformance.platformTikTok", "TikTok")}
            icon={TikTokTabIcon}
            isActive={isTikTok}
            onActivate={() => navigate(SOCIAL_MEDIA_PERFORMANCE_TIKTOK_PATH)}
            activeClassName={tabActive}
            inactiveClassName={tabInactive}
          />
          <button
            type="button"
            role="tab"
            aria-selected={false}
            aria-disabled
            onClick={showComingSoon}
            title={t(
              "digitalMarketing.socialMediaPerformance.platformFacebookPageHint",
              "Facebook Page organic insights",
            )}
            className={cn(tabClass, tabDisabled)}
            style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
          >
            <Facebook className="h-4 w-4 shrink-0" aria-hidden />
            <span>
              {t("digitalMarketing.socialMediaPerformance.platformFacebook", "Facebook")}
            </span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={false}
            aria-disabled
            onClick={showComingSoon}
            className={cn(tabClass, tabDisabled)}
            style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
          >
            <Instagram className="h-4 w-4 shrink-0" aria-hidden />
            <span>
              {t("digitalMarketing.socialMediaPerformance.platformInstagram", "Instagram")}
            </span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={false}
            aria-disabled
            onClick={showComingSoon}
            title={t(
              "digitalMarketing.socialMediaPerformance.platformThreadsHint",
              "Threads organic insights",
            )}
            className={cn(tabClass, tabDisabled)}
            style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
          >
            <ThreadsTabIcon className="h-4 w-4 shrink-0" />
            <span>{t("digitalMarketing.socialMediaPerformance.platformThreads", "Threads")}</span>
          </button>
          <ModuleTabNavItem
            pagePath={SOCIAL_MEDIA_PERFORMANCE_BASE_PATH}
            label={t("digitalMarketing.socialMediaPerformance.platformYouTube", "YouTube")}
            icon={Youtube}
            isActive={isYouTube}
            onActivate={() => navigate(SOCIAL_MEDIA_PERFORMANCE_YOUTUBE_PATH)}
            activeClassName={tabActive}
            inactiveClassName={tabInactive}
          />
          <ModuleTabNavItem
            pagePath={SOCIAL_MEDIA_PERFORMANCE_BASE_PATH}
            label={t("digitalMarketing.socialMediaPerformance.platformLinkedIn", "LinkedIn")}
            icon={Linkedin}
            isActive={isLinkedIn}
            onActivate={() => navigate(SOCIAL_MEDIA_PERFORMANCE_LINKEDIN_PATH)}
            activeClassName={tabActive}
            inactiveClassName={tabInactive}
          />
          <ModuleTabNavItem
            pagePath={SOCIAL_MEDIA_PERFORMANCE_BASE_PATH}
            label={t("digitalMarketing.socialMediaInsightReport.tabReport", "Report")}
            icon={FileText}
            isActive={isReport}
            onActivate={() => navigate(SOCIAL_MEDIA_PERFORMANCE_REPORT_PATH)}
            activeClassName={tabActive}
            inactiveClassName={tabInactive}
          />
          <ModuleTabNavItem
            pagePath={SOCIAL_MEDIA_PERFORMANCE_BASE_PATH}
            label={t("digitalMarketing.manageComments.tab", "Manage Comment")}
            icon={MessageSquare}
            isActive={isManageComments}
            onActivate={() =>
              navigate(`${SOCIAL_MEDIA_PERFORMANCE_MANAGE_COMMENTS_PATH}/tiktok`)
            }
            activeClassName={tabActive}
            inactiveClassName={tabInactive}
          />
        </nav>
      </div>
    </div>
  );
}

SocialMediaPerformanceHeaderAndTab.displayName = "SocialMediaPerformanceHeaderAndTab";

import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ModuleTabNavItem } from "@/shared/auth/page-access/ModuleTabNavItem";
import {
  SOCIAL_MEDIA_PERFORMANCE_REPORT_PATH,
  SOCIAL_MEDIA_PERFORMANCE_TABS,
} from "@/6-0-social-media-performance/shared/socialMediaPerformanceTabs";

export {
  SOCIAL_MEDIA_PERFORMANCE_BASE_PATH,
  SOCIAL_MEDIA_PERFORMANCE_TIKTOK_PATH,
  SOCIAL_MEDIA_PERFORMANCE_FACEBOOK_PATH,
  SOCIAL_MEDIA_PERFORMANCE_INSTAGRAM_PATH,
  SOCIAL_MEDIA_PERFORMANCE_YOUTUBE_PATH,
  SOCIAL_MEDIA_PERFORMANCE_LINKEDIN_PATH,
  SOCIAL_MEDIA_PERFORMANCE_THREADS_PATH,
  SOCIAL_MEDIA_PERFORMANCE_REPORT_PATH,
  SOCIAL_MEDIA_PERFORMANCE_MANAGE_COMMENTS_PATH,
} from "@/6-0-social-media-performance/shared/socialMediaPerformanceTabs";

const tabActive = "border-primary text-primary";
const tabInactive =
  "border-transparent text-muted-foreground hover:border-border hover:text-foreground";

type SocialMediaPerformanceHeaderAndTabProps = {
  activeReportPath?: string;
};

export function SocialMediaPerformanceHeaderAndTab({
  activeReportPath = SOCIAL_MEDIA_PERFORMANCE_REPORT_PATH,
}: SocialMediaPerformanceHeaderAndTabProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

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
          {SOCIAL_MEDIA_PERFORMANCE_TABS.map((tab) => (
            <ModuleTabNavItem
              key={tab.id}
              pagePath={tab.pagePath}
              label={t(tab.labelKey, tab.labelDefault)}
              icon={tab.icon}
              isActive={tab.isActive(location.pathname, activeReportPath)}
              onActivate={() => navigate(tab.path)}
              activeClassName={tabActive}
              inactiveClassName={tabInactive}
            />
          ))}
        </nav>
      </div>
    </div>
  );
}

SocialMediaPerformanceHeaderAndTab.displayName = "SocialMediaPerformanceHeaderAndTab";

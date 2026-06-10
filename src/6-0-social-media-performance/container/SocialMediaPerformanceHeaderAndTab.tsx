import { Facebook, Instagram, Youtube } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ModuleTabNavItem } from "@/shared/auth/page-access/ModuleTabNavItem";
import { TikTokTabIcon } from "@/6-0-traffic/container/TikTokTabIcon";
import { cn } from "@/shared/lib/utils";

export const SOCIAL_MEDIA_PERFORMANCE_BASE_PATH = "/digital-marketing/social-media-performance";
export const SOCIAL_MEDIA_PERFORMANCE_TIKTOK_PATH =
  "/digital-marketing/social-media-performance/tiktok";
export const SOCIAL_MEDIA_PERFORMANCE_FACEBOOK_PATH =
  "/digital-marketing/social-media-performance/facebook";
export const SOCIAL_MEDIA_PERFORMANCE_YOUTUBE_PATH =
  "/digital-marketing/social-media-performance/youtube";

const tabClass =
  "flex items-center space-x-1.5 border-b-2 px-1 py-1.5 text-sm font-medium transition-colors";
const tabActive = "border-primary text-primary";
const tabInactive =
  "border-transparent text-muted-foreground hover:border-border hover:text-foreground";
const tabDisabled = "cursor-not-allowed border-transparent text-muted-foreground opacity-50";

export function SocialMediaPerformanceHeaderAndTab() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const isTikTok = location.pathname.startsWith(SOCIAL_MEDIA_PERFORMANCE_TIKTOK_PATH);
  const isYouTube = location.pathname.startsWith(SOCIAL_MEDIA_PERFORMANCE_YOUTUBE_PATH);

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
          <ModuleTabNavItem
            pagePath={SOCIAL_MEDIA_PERFORMANCE_BASE_PATH}
            label={t("digitalMarketing.socialMediaPerformance.platformYouTube", "YouTube")}
            icon={Youtube}
            isActive={isYouTube}
            onActivate={() => navigate(SOCIAL_MEDIA_PERFORMANCE_YOUTUBE_PATH)}
            activeClassName={tabActive}
            inactiveClassName={tabInactive}
          />
        </nav>
      </div>
    </div>
  );
}

SocialMediaPerformanceHeaderAndTab.displayName = "SocialMediaPerformanceHeaderAndTab";

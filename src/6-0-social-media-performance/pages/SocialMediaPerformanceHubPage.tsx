import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Instagram, Youtube } from "lucide-react";
import { HeaderAndTab } from "@/6-0-traffic/container/HeaderAndTab";
import { ModuleShellContentGate } from "@/shared/layouts/ModuleShellContentGate";
import { useOrgBootstrapPending } from "@/shared/auth/hooks/useOrgBootstrapPending";
import { TikTokTabIcon } from "@/6-0-traffic/container/TikTokTabIcon";
import { cn } from "@/shared/lib/utils";
import { SocialMediaPerformanceHubPageSkeleton } from "@/6-0-social-media-performance/skeletons/SocialMediaPerformanceHubPageSkeleton";
import { TIKTOK_CONTENT_DIGITAL_MARKETING_BASE_PATH } from "@/tiktok-content/settings/tiktokContentSettingsPaths";

const SOCIAL_MEDIA_PERFORMANCE_PATH = "/digital-marketing/social-media-performance";

export default function SocialMediaPerformanceHubPage() {
  const { orgBootstrapPending } = useOrgBootstrapPending();
  if (orgBootstrapPending) return <SocialMediaPerformanceHubPageSkeleton />;
  return (
    <ModuleShellContentGate pagePath={SOCIAL_MEDIA_PERFORMANCE_PATH}>
      <SocialMediaPerformanceHubContent />
    </ModuleShellContentGate>
  );
}

function SocialMediaPerformanceHubContent() {
  const { t } = useTranslation();

  const platforms = [
    {
      id: "tiktok",
      name: t("digitalMarketing.socialMediaPerformance.platformTikTok", "TikTok"),
      description: t(
        "digitalMarketing.socialMediaPerformance.platformTikTokDesc",
        "Organic video insights and content plan matching.",
      ),
      icon: TikTokTabIcon,
      href: TIKTOK_CONTENT_DIGITAL_MARKETING_BASE_PATH,
      active: true,
    },
    {
      id: "instagram",
      name: t("digitalMarketing.socialMediaPerformance.platformInstagram", "Instagram"),
      description: t(
        "digitalMarketing.socialMediaPerformance.platformComingSoon",
        "Coming in a future release.",
      ),
      icon: Instagram,
      active: false,
    },
    {
      id: "youtube",
      name: t("digitalMarketing.socialMediaPerformance.platformYouTube", "YouTube"),
      description: t(
        "digitalMarketing.socialMediaPerformance.platformComingSoon",
        "Coming in a future release.",
      ),
      icon: Youtube,
      active: false,
    },
  ];

  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans">
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-2">
        <div className="mb-1 min-w-0 shrink-0">
          <HeaderAndTab />
        </div>
        <div className="grid min-h-0 min-w-0 w-full flex-1 grid-cols-12 gap-2 overflow-hidden [grid-template-rows:minmax(0,1fr)] items-stretch">
          <div className="col-span-12 overflow-y-auto rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">
              {t("digitalMarketing.socialMediaPerformance.hubTitle", "Social Media Performance")}
            </h2>
            <p className="mb-6 text-sm text-muted-foreground">
              {t(
                "digitalMarketing.socialMediaPerformance.hubDesc",
                "Choose a platform to view organic content insights.",
              )}
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {platforms.map((platform) => {
                const Icon = platform.icon;
                const cardClass = cn(
                  "flex flex-col rounded-lg border p-4 transition-colors",
                  platform.active
                    ? "border-primary/30 bg-primary/5 hover:border-primary/50"
                    : "border-gray-200 bg-gray-50/50 opacity-70",
                );
                const inner = (
                  <>
                    <div className="mb-2 flex items-center gap-2">
                      <Icon className="h-5 w-5 text-gray-700" />
                      <span className="font-medium text-gray-900">{platform.name}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{platform.description}</p>
                  </>
                );
                if (platform.active && platform.href) {
                  return (
                    <Link key={platform.id} to={platform.href} className={cardClass}>
                      {inner}
                    </Link>
                  );
                }
                return (
                  <div key={platform.id} className={cardClass} aria-disabled>
                    {inner}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useLocation, useNavigate } from "react-router-dom";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { MobileNavTabButton } from "@/shared/auth/page-access/MobileNavTabButton";
import { SOCIAL_MEDIA_PERFORMANCE_TABS } from "@/6-0-social-media-performance/shared/socialMediaPerformanceTabs";

type SocialMediaPerformanceMobileFooterProps = {
  className?: string;
};

export function SocialMediaPerformanceMobileFooter({
  className,
}: SocialMediaPerformanceMobileFooterProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useAppTranslation();

  return (
    <nav className="mobile-app-bottom-nav relative z-30 shrink-0 border-t border-border bg-card safe-area-bottom-lower">
      <div
        className={`scrollbar-hide mx-auto flex max-w-md min-h-[52px] items-stretch overflow-x-auto overflow-y-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
          className ?? ""
        }`.trim()}
      >
        {SOCIAL_MEDIA_PERFORMANCE_TABS.map((tab) => {
          const isActive = tab.isActive(location.pathname);
          return (
            <MobileNavTabButton
              key={tab.id}
              pagePath={tab.path}
              label={t(tab.labelKey, tab.labelDefault)}
              icon={tab.icon}
              isActive={isActive}
              onActivate={() => {
                if (!isActive) navigate(tab.path);
              }}
              className="min-w-[4.75rem] shrink-0 flex-1"
              iconClassName="mb-1 h-5 w-5"
              labelClassName="text-center text-xs font-medium leading-tight"
            />
          );
        })}
      </div>
    </nav>
  );
}

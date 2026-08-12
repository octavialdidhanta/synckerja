import { CalendarDays } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { MobileNavTabButton } from "@/shared/auth/page-access/MobileNavTabButton";
import { MOBILE_PAGE_PATH } from "@/shared/auth/page-access/mobileRoutePagePaths";

const CONTENT_CALENDAR_PATH = "/digital-marketing/social-media/content-calendar";

interface SocialMediaMobileFooterProps {
  /** Optional class; default `safe-area-padding-bottom-capped`. */
  className?: string;
}

export function SocialMediaMobileFooter({ className }: SocialMediaMobileFooterProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useAppTranslation();

  const isContentCalendar = location.pathname === CONTENT_CALENDAR_PATH;

  return (
    <nav className="mobile-app-bottom-nav fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-card">
      <div
        className={`mx-auto grid max-w-md min-h-[52px] grid-cols-1 place-items-center ${
          className ?? "safe-area-padding-bottom-capped"
        }`.trim()}
      >
        <MobileNavTabButton
          pagePath={MOBILE_PAGE_PATH.digitalMarketingContentCalendar}
          label={t(
            "sidebar.digitalMarketing.socialMedia.contentCalendar",
            "Content Calendar",
          )}
          icon={CalendarDays}
          isActive={isContentCalendar}
          onActivate={() => !isContentCalendar && navigate(CONTENT_CALENDAR_PATH)}
          labelClassName="text-[9px] font-medium leading-tight"
        />
      </div>
    </nav>
  );
}

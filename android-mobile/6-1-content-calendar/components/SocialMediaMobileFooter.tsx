import { CalendarDays, Filter, Scale, User } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { MobileNavTabButton } from "@/shared/auth/page-access/MobileNavTabButton";
import {
  CONTENT_CALENDAR_PATH,
  contentCalendarHref,
  pagePathForContentCalendarTab,
  parseContentCalendarTab,
  type ContentCalendarTab,
} from "@/mobile/6-1-content-calendar/shared/contentCalendarNavPaths";

interface SocialMediaMobileFooterProps {
  /** Optional class; default `safe-area-padding-bottom-capped`. */
  className?: string;
}

const FOOTER_TABS: Array<{
  tab: ContentCalendarTab;
  icon: typeof CalendarDays;
  labelKey: string;
  fallback: string;
}> = [
  {
    tab: "calendar",
    icon: CalendarDays,
    labelKey: "sidebar.digitalMarketing.socialMedia.contentCalendar",
    fallback: "Content Calendar",
  },
  {
    tab: "funnel",
    icon: Filter,
    labelKey: "sidebar.digitalMarketing.socialMedia.funnel",
    fallback: "Funnel",
  },
  {
    tab: "balance",
    icon: Scale,
    labelKey: "sidebar.digitalMarketing.socialMedia.contentBalance",
    fallback: "Content Balance",
  },
  {
    tab: "persona",
    icon: User,
    labelKey: "sidebar.digitalMarketing.socialMedia.persona",
    fallback: "Persona",
  },
];

export function SocialMediaMobileFooter({ className }: SocialMediaMobileFooterProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useAppTranslation();

  const isContentCalendar = location.pathname === CONTENT_CALENDAR_PATH;
  const activeTab = isContentCalendar ? parseContentCalendarTab(location.search) : "calendar";

  return (
    <nav className="mobile-app-bottom-nav fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-card">
      <div
        className={`mx-auto grid max-w-md min-h-[52px] grid-cols-4 place-items-center ${
          className ?? "safe-area-padding-bottom-capped"
        }`.trim()}
      >
        {FOOTER_TABS.map(({ tab, icon, labelKey, fallback }) => {
          const isActive = isContentCalendar && activeTab === tab;
          return (
            <MobileNavTabButton
              key={tab}
              pagePath={pagePathForContentCalendarTab(tab)}
              label={t(labelKey, fallback)}
              icon={icon}
              isActive={isActive}
              onActivate={() => {
                if (!isActive) navigate(contentCalendarHref(tab));
              }}
              labelClassName="text-[9px] font-medium leading-tight text-center"
            />
          );
        })}
      </div>
    </nav>
  );
}

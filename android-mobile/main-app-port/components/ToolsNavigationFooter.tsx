import { CheckSquare, ClipboardList, FileBarChart, NotebookPen, Target } from "lucide-react";
import { createSearchParams, useLocation, useNavigate } from "react-router-dom";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import {
  TOOLS_DAILY_TASK_PATH,
  TOOLS_DAILY_TASK_JOBDESC_HREF,
  TOOLS_DAILY_TASK_REPORT_PATH,
  toolsDailyTaskHref,
} from "@/mobile/5-daily-task/shared/toolsDailyTaskPath";
import { useFilteredNavByPageAccess } from "@/shared/auth/page-access/useFilteredNavByPageAccess";
import { MobileNavTabButton } from "@/shared/auth/page-access/MobileNavTabButton";
import { MOBILE_PAGE_PATH } from "@/shared/auth/page-access/mobileRoutePagePaths";

const NAV_LABELS: Record<string, string> = {
  "toolsNav.dailyTask": "Daily Task",
  "toolsNav.initiative": "Initiative",
  "toolsNav.jobDesc": "Job Desc",
  "toolsNav.report": "Report",
  "toolsNav.notes": "Notes",
};

const navItems = [
  {
    labelKey: "toolsNav.dailyTask",
    path: TOOLS_DAILY_TASK_PATH,
    pagePath: MOBILE_PAGE_PATH.toolsDailyTask,
    icon: CheckSquare,
  },
  {
    labelKey: "toolsNav.initiative",
    path: toolsDailyTaskHref("initiative"),
    pagePath: MOBILE_PAGE_PATH.toolsDailyTask,
    icon: Target,
  },
  {
    labelKey: "toolsNav.jobDesc",
    path: TOOLS_DAILY_TASK_JOBDESC_HREF,
    pagePath: MOBILE_PAGE_PATH.toolsDailyTask,
    icon: ClipboardList,
  },
  {
    labelKey: "toolsNav.report",
    path: TOOLS_DAILY_TASK_REPORT_PATH,
    pagePath: MOBILE_PAGE_PATH.toolsDailyTaskReport,
    icon: FileBarChart,
  },
  {
    labelKey: "toolsNav.notes",
    path: "/tools/meeting-notes",
    pagePath: MOBILE_PAGE_PATH.toolsMeetingNotes,
    icon: NotebookPen,
  },
] as const;

interface ToolsNavigationFooterProps {
  /** Optional class to e.g. use safe-area-bottom-lower for consistency with other mobile pages */
  className?: string;
}

export const ToolsNavigationFooter = ({ className }: ToolsNavigationFooterProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useAppTranslation();
  const { filterNavItems } = useFilteredNavByPageAccess();
  const visibleNavItems = filterNavItems(navItems.map((item) => ({ ...item, path: item.path })));

  return (
    <nav className="mobile-app-bottom-nav fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-card">
      <div
        className={`mx-auto grid max-w-md ${className ? className : "safe-area-padding-bottom-capped"}`.trim()}
        style={{
          gridTemplateColumns: `repeat(${Math.max(visibleNavItems.length, 1)}, minmax(0, 1fr))`,
        }}
      >
        {visibleNavItems.map(({ labelKey, path, icon: Icon, pagePath }) => {
          const label = t(labelKey, NAV_LABELS[labelKey] ?? labelKey);
          let isActive = false;

          if (labelKey === "toolsNav.initiative") {
            isActive =
              location.pathname === TOOLS_DAILY_TASK_PATH &&
              new URLSearchParams(location.search).get("view") === "initiative";
          } else if (labelKey === "toolsNav.jobDesc") {
            isActive =
              location.pathname === TOOLS_DAILY_TASK_PATH &&
              new URLSearchParams(location.search).get("view") === "jobdesc";
          } else if (labelKey === "toolsNav.dailyTask") {
            const view = new URLSearchParams(location.search).get("view");
            isActive =
              location.pathname === TOOLS_DAILY_TASK_PATH && view !== "initiative" && view !== "jobdesc";
          } else {
            isActive = location.pathname === path;
          }

          const go = () => {
            if (labelKey === "toolsNav.dailyTask") {
              navigate(TOOLS_DAILY_TASK_PATH);
              return;
            }
            if (labelKey === "toolsNav.initiative") {
              navigate({
                pathname: TOOLS_DAILY_TASK_PATH,
                search: `?${createSearchParams({ view: "initiative" }).toString()}`,
              });
              return;
            }
            if (labelKey === "toolsNav.jobDesc") {
              navigate({
                pathname: TOOLS_DAILY_TASK_PATH,
                search: `?${createSearchParams({ view: "jobdesc" }).toString()}`,
              });
              return;
            }
            navigate(path);
          };

          return (
            <MobileNavTabButton
              key={path}
              pagePath={pagePath}
              label={label}
              icon={Icon}
              isActive={isActive}
              onActivate={go}
              labelClassName="text-xs font-medium text-center leading-tight"
            />
          );
        })}
      </div>
    </nav>
  );
};

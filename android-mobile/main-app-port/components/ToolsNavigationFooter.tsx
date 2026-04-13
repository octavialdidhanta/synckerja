import { CheckSquare, ClipboardList, FileBarChart, NotebookPen, Target } from "lucide-react";
import { createSearchParams, useLocation, useNavigate } from "react-router-dom";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import {
  TOOLS_DAILY_TASK_PATH,
  TOOLS_DAILY_TASK_JOBDESC_HREF,
  TOOLS_DAILY_TASK_REPORT_PATH,
  toolsDailyTaskHref,
} from "@/mobile/5-daily-task/shared/toolsDailyTaskPath";

const NAV_LABELS: Record<string, string> = {
  "toolsNav.dailyTask": "Daily Task",
  "toolsNav.initiative": "Initiative",
  "toolsNav.jobDesc": "Job Desc",
  "toolsNav.report": "Report",
  "toolsNav.notes": "Notes",
};

const navItems = [
  { icon: CheckSquare, labelKey: "toolsNav.dailyTask", path: TOOLS_DAILY_TASK_PATH },
  { icon: Target, labelKey: "toolsNav.initiative", path: toolsDailyTaskHref("initiative") },
  /** Harus sama dengan `navigate` Job Desc: `/tools/daily-task?view=jobdesc` → `5-job-desc/JobDescPage`. */
  { icon: ClipboardList, labelKey: "toolsNav.jobDesc", path: TOOLS_DAILY_TASK_JOBDESC_HREF },
  { icon: FileBarChart, labelKey: "toolsNav.report", path: TOOLS_DAILY_TASK_REPORT_PATH },
  { icon: NotebookPen, labelKey: "toolsNav.notes", path: "/tools/meeting-notes" },
];

interface ToolsNavigationFooterProps {
  /** Optional class to e.g. use safe-area-bottom-lower for consistency with other mobile pages */
  className?: string;
}

export const ToolsNavigationFooter = ({ className }: ToolsNavigationFooterProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useAppTranslation();

  return (
    <nav className="mobile-app-bottom-nav fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-card">
      <div
        className={`mx-auto grid max-w-md grid-cols-5 ${className ? className : "safe-area-padding-bottom-capped"}`.trim()}
      >
        {navItems.map(({ icon: Icon, labelKey, path }) => {
          const label = t(labelKey, NAV_LABELS[labelKey] ?? labelKey);
          // Check if current path matches
          let isActive = false;
          
          if (labelKey === "toolsNav.initiative") {
            isActive = location.pathname === TOOLS_DAILY_TASK_PATH && new URLSearchParams(location.search).get('view') === 'initiative';
          } else if (labelKey === "toolsNav.jobDesc") {
            isActive = location.pathname === TOOLS_DAILY_TASK_PATH && new URLSearchParams(location.search).get('view') === 'jobdesc';
          } else if (labelKey === "toolsNav.dailyTask") {
            const view = new URLSearchParams(location.search).get('view');
            isActive = location.pathname === TOOLS_DAILY_TASK_PATH && view !== 'initiative' && view !== 'jobdesc';
          } else {
            // For other items, check if pathname matches
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
            <button
              key={path}
              type="button"
              onClick={go}
              className={`flex flex-col items-center py-2 px-1 transition-colors ${
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-5 w-5 mb-1" />
              <span className="text-xs font-medium text-center leading-tight">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};






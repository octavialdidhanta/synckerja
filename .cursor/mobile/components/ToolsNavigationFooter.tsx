import { CheckSquare, ClipboardList, FileBarChart, NotebookPen, Target } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAppTranslation } from "@/features/share/i18n/useAppTranslation";

const NAV_LABELS: Record<string, string> = {
  "toolsNav.dailyTask": "Daily Task",
  "toolsNav.initiative": "Initiative",
  "toolsNav.jobDesc": "Job Desc",
  "toolsNav.report": "Report",
  "toolsNav.notes": "Notes",
};

const navItems = [
  { icon: CheckSquare, labelKey: "toolsNav.dailyTask", path: "/tools/daily-task" },
  { icon: Target, labelKey: "toolsNav.initiative", path: "/tools/daily-task?view=initiative" },
  { icon: ClipboardList, labelKey: "toolsNav.jobDesc", path: "/tools/daily-task?view=jobdesc" },
  { icon: FileBarChart, labelKey: "toolsNav.report", path: "/tools/daily-task-report" },
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
    <nav
      className="fixed left-0 right-0 bottom-0 bg-card border-t border-border z-30"
    >
      <div className={`grid grid-cols-5 max-w-md mx-auto ${className ? className : "safe-area-padding-bottom"}`.trim()}>
        {navItems.map(({ icon: Icon, labelKey, path }) => {
          const label = t(labelKey, NAV_LABELS[labelKey] ?? labelKey);
          // Check if current path matches
          let isActive = false;
          
          if (labelKey === "toolsNav.initiative") {
            isActive = location.pathname === "/tools/daily-task" && new URLSearchParams(location.search).get('view') === 'initiative';
          } else if (labelKey === "toolsNav.jobDesc") {
            isActive = location.pathname === "/tools/daily-task" && new URLSearchParams(location.search).get('view') === 'jobdesc';
          } else if (labelKey === "toolsNav.dailyTask") {
            const view = new URLSearchParams(location.search).get('view');
            isActive = location.pathname === "/tools/daily-task" && view !== 'initiative' && view !== 'jobdesc';
          } else {
            // For other items, check if pathname matches
            isActive = location.pathname === path;
          }

          return (
            <button
              key={path}
              onClick={() => navigate(path)}
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






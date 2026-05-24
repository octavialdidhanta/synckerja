import React, { useMemo } from "react";
import { Calculator, CheckSquare, FileText, Key, Lock, Target } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useHeaderTabPageAccess } from "@/shared/auth/page-access/useHeaderTabPageAccess";

export type ToolsTabMode = "default" | "password-manager-only" | "pph21-calculator-only";

type ToolTabItem = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  path: string;
};

const DEFAULT_TOOLS_TABS: ToolTabItem[] = [
  {
    id: "daily-task",
    label: "Daily Task",
    icon: CheckSquare,
    description: "Manage your daily tasks and to-do lists",
    path: "/tools/daily-task",
  },
  {
    id: "daily-task-report",
    label: "Daily Task Report",
    icon: FileText,
    description: "Analyze completed tasks, on-time performance, and delays",
    path: "/tools/daily-task-report",
  },
  {
    id: "habits-tracker",
    label: "Habits Tracker",
    icon: Target,
    description: "Track your habits and build better routines",
    path: "/tools/habits-tracker",
  },
  {
    id: "meeting-notes",
    label: "Meeting Notes",
    icon: FileText,
    description: "Track and manage meeting discussions and action items",
    path: "/tools/meeting-notes",
  },
];

export type ToolsHeaderAndTabProps = {
  activeTab: string;
  onTabChange: (tab: string) => void;
  /**
   * Single-tool Tools routes: one tab + matching title/subtitle (no default four tabs).
   */
  toolsTabMode?: ToolsTabMode;
};

export function ToolsHeaderAndTab({
  activeTab,
  onTabChange,
  toolsTabMode = "default",
}: ToolsHeaderAndTabProps) {
  const navigate = useNavigate();
  const { isTabLocked } = useHeaderTabPageAccess();
  const { t } = useAppTranslation();

  const toolTabs: ToolTabItem[] = useMemo(() => {
    switch (toolsTabMode) {
      case "password-manager-only":
        return [
          {
            id: "password-manager",
            label: t("sidebar.tools.passwordManager.title", "Password Manager"),
            icon: Key,
            description: t(
              "sidebar.tools.passwordManager.description",
              "Manage your passwords securely",
            ),
            path: "/tools/password-manager",
          },
        ];
      case "pph21-calculator-only":
        return [
          {
            id: "pph21-calculator",
            label: t("sidebar.tools.pph21Calculator.title", "PPh 21 Calculator"),
            icon: Calculator,
            description: t(
              "sidebar.tools.pph21Calculator.description",
              "Calculate Indonesian payroll tax automatically",
            ),
            path: "/tools/pph21-calculator",
          },
        ];
      default:
        return DEFAULT_TOOLS_TABS;
    }
  }, [toolsTabMode, t]);

  const handleTabClick = (tab: ToolTabItem) => {
    onTabChange(tab.id);
    if (tab.path) {
      navigate(tab.path);
    }
  };

  return (
    <div className="px-1 py-3">
      <div className="mb-3">
        <h1 className="mb-0.5 text-xl font-bold text-gray-900">
          {toolsTabMode === "password-manager-only"
            ? t("sidebar.tools.passwordManager.title", "Password Manager")
            : toolsTabMode === "pph21-calculator-only"
              ? t("sidebar.tools.pph21Calculator.title", "PPh 21 Calculator")
              : "Tools"}
        </h1>
        <p className="text-xs text-gray-600">
          {toolsTabMode === "password-manager-only"
            ? t(
                "sidebar.tools.passwordManager.description",
                "Manage your passwords securely",
              )
            : toolsTabMode === "pph21-calculator-only"
              ? t(
                  "sidebar.tools.pph21Calculator.description",
                  "Calculate Indonesian payroll tax automatically",
                )
              : "Manage your daily tasks and productivity tools"}
        </p>
      </div>

      <div className="-mb-3">
        <nav className="flex flex-wrap gap-x-6 gap-y-1">
          {toolTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const isLocked = tab.path ? isTabLocked(tab.path) : false;

            return (
              <div
                key={tab.id}
                onClick={() => handleTabClick(tab)}
                className={`flex items-center space-x-1.5 py-1.5 px-1 border-b-2 font-medium text-sm transition-colors ${
                  isLocked
                    ? "border-transparent text-gray-400 cursor-not-allowed opacity-60"
                    : isActive
                      ? "border-brand-blue text-brand-blue cursor-pointer"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 cursor-pointer"
                }`}
                style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
                title={
                  isLocked
                    ? t("accessDenied.message", "You do not have permission to view this page.")
                    : tab.description
                }
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {isLocked && <Lock className="ml-1 w-3.5 h-3.5" />}
              </div>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

ToolsHeaderAndTab.displayName = "ToolsHeaderAndTab";

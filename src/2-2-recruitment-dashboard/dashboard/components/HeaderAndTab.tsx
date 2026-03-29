import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Briefcase, Users, FileText, ClipboardList } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

interface HeaderAndTabProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const HeaderAndTab = ({ activeTab: _activeTab, onTabChange }: HeaderAndTabProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useAppTranslation();

  const tabs = [
    {
      id: "dashboard",
      label: t("recruitment.header.tabDashboard", "Dashboard"),
      icon: Briefcase,
      description: t(
        "recruitment.header.tabDashboardDescription",
        "Overview of job openings and recruitment metrics",
      ),
      route: "/recruitment",
    },
    {
      id: "job-openings",
      label: t("recruitment.header.tabJobOpenings", "Job Openings"),
      icon: FileText,
      description: t("recruitment.header.tabJobOpeningsDescription", "Manage job openings and postings"),
      route: "/recruitment/job-openings",
    },
    {
      id: "applications",
      label: t("recruitment.header.tabApplications", "Applications"),
      icon: ClipboardList,
      description: t(
        "recruitment.header.tabApplicationsDescription",
        "Manage and review candidate applications",
      ),
      route: "/recruitment/applications",
    },
    {
      id: "interviewees",
      label: t("recruitment.header.tabInterviewees", "Interviewees"),
      icon: Users,
      description: t(
        "recruitment.header.tabIntervieweesDescription",
        "Manage candidate interviews and evaluations",
      ),
      route: "/recruitment/interviewees",
    },
  ];

  const handleTabClick = (tab: (typeof tabs)[number]) => {
    if (tab.route) {
      navigate(tab.route);
    } else {
      onTabChange(tab.id);
    }
  };

  const getActiveTab = () => {
    const p = location.pathname;
    if (p.startsWith("/recruitment/candidates/")) {
      return "applications";
    }
    if (p === "/recruitment/interviewees") {
      return "interviewees";
    }
    if (p === "/recruitment/applications") {
      return "applications";
    }
    if (p === "/recruitment/job-openings") {
      return "job-openings";
    }
    if (p === "/recruitment") {
      return "dashboard";
    }
    return "dashboard";
  };

  return (
    <div className="px-1 py-3">
      <div className="mb-3">
        <h1 className="mb-0.5 text-xl font-bold text-foreground">
          {t("recruitment.header.pageTitle", "Recruitment")}
        </h1>
        <p className="text-xs text-muted-foreground">
          {t(
            "recruitment.header.pageSubtitle",
            "Manage job openings, applications, and recruitment process",
          )}
        </p>
      </div>

      <div className="-mb-3">
        <nav className="flex space-x-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = getActiveTab() === tab.id;

            return (
              <div
                key={tab.id}
                role="button"
                tabIndex={0}
                onClick={() => handleTabClick(tab)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleTabClick(tab);
                  }
                }}
                className={`flex cursor-pointer items-center space-x-1.5 border-b-2 px-1 py-1.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "border-brand-blue text-brand-blue"
                    : "border-transparent text-muted-foreground hover:border-brand-blue/30 hover:text-brand-blue"
                }`}
                style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </div>
            );
          })}
        </nav>
      </div>
    </div>
  );
};

HeaderAndTab.displayName = "HeaderAndTab";

import { Building, Target, User, Lock } from "lucide-react";
import { useHeaderTabPageAccess } from "@/shared/auth/page-access/useHeaderTabPageAccess";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { cn } from "@/shared/lib/utils";
import { getOkrActiveTabFromPath } from "../utils/okrPaths";

interface HeaderAndTabProps {
  onTabChange: (tab: string) => void;
}

export function HeaderAndTab({ onTabChange }: HeaderAndTabProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const { isTabLocked } = useHeaderTabPageAccess();

  const tabs = [
    {
      id: "company-objectives" as const,
      labelKey: "layout.okr.tab.company",
      icon: Target,
      route: "/okr/company-objective",
    },
    {
      id: "department-objectives" as const,
      labelKey: "layout.okr.tab.department",
      icon: Building,
      route: "/okr/department-objective",
    },
    {
      id: "individual-objectives" as const,
      labelKey: "layout.okr.tab.individual",
      icon: User,
      route: "/okr/individual-objective",
    },
  ];

  const resolvedActive = getOkrActiveTabFromPath(location.pathname);

  const handleTabClick = (tabId: string) => {
    onTabChange(tabId);
  };

  return (
    <div className="px-1 py-3">
      <div className="mb-3">
        <h1 className="mb-0.5 text-xl font-bold text-foreground">{t("layout.okr.pageTitle")}</h1>
        <p className="text-xs text-muted-foreground">{t("layout.okr.pageSubtitle")}</p>
      </div>

      <div className="-mb-3">
        <nav className="flex space-x-6" aria-label={t("layout.okr.pageTitle")}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = resolvedActive === tab.id;
            const locked = isTabLocked(tab.route);

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabClick(tab.id)}
                title={
                  locked
                    ? t("accessDenied.message", "You do not have permission to view this page.")
                    : undefined
                }
                className={cn(
                  "flex cursor-pointer items-center space-x-1.5 border-b-2 px-1 py-1.5 text-sm font-medium transition-colors",
                  locked
                    ? "border-transparent text-muted-foreground opacity-60"
                    : isActive
                      ? "border-brand-blue text-brand-blue"
                      : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                <span>{t(tab.labelKey)}</span>
                {locked ? <Lock className="ml-1 h-3.5 w-3.5 shrink-0" aria-hidden /> : null}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

HeaderAndTab.displayName = "HeaderAndTab";

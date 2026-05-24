import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { BarChart3, TrendingUp, Lock } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useHeaderTabPageAccess } from "@/shared/auth/page-access/useHeaderTabPageAccess";
import { cn } from "@/shared/lib/utils";

const tabs = [
  {
    key: "services",
    path: "/tools/calculator/services",
    titleKey: "pages.calculator.tabs.services",
    fallbackTitle: "Services",
    icon: BarChart3,
  },
  {
    key: "sales",
    path: "/tools/calculator/sales",
    titleKey: "pages.calculator.tabs.sales",
    fallbackTitle: "Sales",
    icon: TrendingUp,
  },
];

export function CalculatorHeaderAndTab() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useAppTranslation();
  const { isTabLocked } = useHeaderTabPageAccess();

  const activeKey = useMemo(() => {
    const match = tabs.find((tab) => location.pathname.startsWith(tab.path));
    return match?.key ?? "services";
  }, [location.pathname]);

  return (
    <div className="px-1 py-3">
      <div className="mb-3">
        <h1 className="mb-0.5 text-xl font-bold text-foreground">
          {t("pages.calculator.title", "Campaign Calculator")}
        </h1>
        <p className="text-xs text-muted-foreground">
          {t("pages.calculator.subtitle", "General purpose calculator tools")}
        </p>
      </div>

      <div className="-mb-3">
        <nav className="flex flex-wrap gap-x-6 gap-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeKey === tab.key;
            const locked = isTabLocked(tab.path);

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => navigate(tab.path)}
                title={
                  locked
                    ? t("accessDenied.message", "You do not have permission to view this page.")
                    : undefined
                }
                className={cn(
                  "flex items-center space-x-1.5 border-b-2 px-1 py-1.5 text-sm font-medium transition-colors",
                  locked
                    ? "border-transparent text-muted-foreground opacity-60"
                    : isActive
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:border-primary/30 hover:text-foreground",
                )}
                style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
              >
                <Icon className="h-4 w-4" />
                <span>{t(tab.titleKey, tab.fallbackTitle)}</span>
                {locked ? <Lock className="ml-1 h-3.5 w-3.5 shrink-0" aria-hidden /> : null}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

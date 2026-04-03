import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { BarChart3, TrendingUp } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

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

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => navigate(tab.path)}
                className={`flex items-center space-x-1.5 border-b-2 py-1.5 px-1 text-sm font-medium transition-colors ${
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:border-primary/30 hover:text-foreground"
                }`}
                style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
              >
                <Icon className="h-4 w-4" />
                <span>{t(tab.titleKey, tab.fallbackTitle)}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

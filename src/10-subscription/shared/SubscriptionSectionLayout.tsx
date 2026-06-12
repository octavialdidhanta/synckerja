import { LayoutDashboard, CreditCard, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";

export function SubscriptionSectionLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const activeTab =
    location.pathname === "/subscription/plans"
      ? "plans"
      : location.pathname === "/subscription/management"
        ? "management"
        : "overview";

  const tabs = [
    {
      id: "overview" as const,
      labelKey: "subscription.layout.tabOverview",
      icon: LayoutDashboard,
      path: "/subscription/overview",
    },
    {
      id: "plans" as const,
      labelKey: "subscription.layout.tabPlans",
      icon: CreditCard,
      path: "/subscription/plans",
    },
    {
      id: "management" as const,
      labelKey: "subscription.layout.tabManagement",
      icon: Settings,
      path: "/subscription/management",
    },
  ];

  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col bg-gray-100 font-sans">
      <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="shrink-0 px-4">
          <div className="px-1 py-3">
            <div className="mb-3">
              <h1 className="mb-0.5 text-xl font-bold text-foreground">{t("subscription.layout.title")}</h1>
              <p className="text-xs text-muted-foreground">{t("subscription.layout.subtitle")}</p>
            </div>
            <div className="-mb-3">
              <nav className="flex space-x-6">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <div
                      key={tab.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate(tab.path)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          navigate(tab.path);
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
                      <span>{t(tab.labelKey)}</span>
                    </div>
                  );
                })}
              </nav>
            </div>
          </div>
        </div>
        <div className="flex min-w-0 flex-col">{children}</div>
      </div>
    </div>
  );
}

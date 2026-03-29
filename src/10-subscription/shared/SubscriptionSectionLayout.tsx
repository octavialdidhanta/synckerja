import { LayoutDashboard, CreditCard, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/shared/lib/utils";
import { useOptimizedSubscription } from "@/10-subscription/hooks/useOptimizedSubscription";
import { SubscriptionBanner } from "@/10-subscription/shared/SubscriptionBanner";

export function SubscriptionSectionLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { subscriptionStatus, statusLoading } = useOptimizedSubscription();

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

  const daysLeft = subscriptionStatus?.days_until_expiry ?? Number.POSITIVE_INFINITY;
  const showBanner = !statusLoading && !!subscriptionStatus && daysLeft <= 3;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-border bg-card px-4 pb-2 pt-4">
        <h1 className="text-xl font-bold text-foreground">{t("subscription.layout.title")}</h1>
        <p className="text-xs text-muted-foreground">{t("subscription.layout.subtitle")}</p>
        <nav className="mt-3 flex gap-6 border-b border-transparent">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => navigate(tab.path)}
                className={cn(
                  "flex items-center gap-1.5 border-b-2 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "border-brand-blue text-brand-blue"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {t(tab.labelKey)}
              </button>
            );
          })}
        </nav>
      </div>
      {showBanner && subscriptionStatus && (
        <div className="shrink-0 border-b border-border bg-card">
          <SubscriptionBanner subscriptionStatus={subscriptionStatus} />
        </div>
      )}
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}

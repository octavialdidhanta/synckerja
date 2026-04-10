import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { BarChart3, Layers, Settings2 } from "lucide-react";
import { useAppTranslation } from "@/features/share/i18n/useAppTranslation";
import { cn } from "@/lib/utils";

export type SubscriptionTabKey = "overview" | "plans" | "management";

const TABS: Record<SubscriptionTabKey, string> = {
  overview: "/subscription/overview",
  plans: "/subscription/plans",
  management: "/subscription/management",
};

const tabItems = [
  { key: "overview" as const, icon: BarChart3 },
  { key: "plans" as const, icon: Layers },
  { key: "management" as const, icon: Settings2 },
];

export interface SubscriptionBottomTabsProps {
  activeTab: SubscriptionTabKey;
  onTabChange: (tab: SubscriptionTabKey) => void;
  /** Optional class to e.g. use safe-area-bottom-lower for consistency with other mobile pages */
  className?: string;
}

const SubscriptionBottomTabsComponent: React.FC<SubscriptionBottomTabsProps> = ({ activeTab, onTabChange, className }) => {
    const { t } = useAppTranslation();

    const labels: Record<SubscriptionTabKey, string> = useMemo(
      () => ({
        overview: t("subscription.tabs.overview", "Overview"),
        plans: t("subscription.tabs.plans", "Plans"),
        management: t("subscription.tabs.management", "Management"),
      }),
      [t],
    );

    return (
      <nav
        className="fixed left-0 right-0 bottom-0 bg-card border-t border-border z-30"
      >
        <div className={`grid grid-cols-3 w-full ${className ? className : "safe-area-padding-bottom"}`.trim()}>
          {tabItems.map(({ key, icon: Icon }) => {
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onTabChange(key)}
                className={cn(
                  "flex flex-col items-center py-2 px-1 transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-5 w-5 mb-1" />
                <span className="text-xs font-medium">{labels[key]}</span>
              </button>
            );
          })}
        </div>
      </nav>
    );
};

export const SubscriptionBottomTabs = memo(SubscriptionBottomTabsComponent);
SubscriptionBottomTabs.displayName = "SubscriptionBottomTabs";

const getTabKeyFromPath = (pathname: string): SubscriptionTabKey => {
  if (pathname.includes("/subscription/overview")) return "overview";
  if (pathname.includes("/subscription/management")) return "management";
  return "plans";
};

export const useSubscriptionTabs = (initialTab: SubscriptionTabKey) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<SubscriptionTabKey>(() => getTabKeyFromPath(location.pathname) ?? initialTab);

  const setActiveTabOnLocationChange = useCallback(() => {
    setActiveTab(getTabKeyFromPath(location.pathname));
  }, [location.pathname]);

  useEffect(() => {
    setActiveTabOnLocationChange();
  }, [setActiveTabOnLocationChange]);

  const handleTabChange = useCallback(
    (tab: SubscriptionTabKey) => {
      setActiveTab(tab);
      navigate(TABS[tab]);
    },
    [navigate],
  );

  return { activeTab, handleTabChange, setActiveTabOnLocationChange };
};


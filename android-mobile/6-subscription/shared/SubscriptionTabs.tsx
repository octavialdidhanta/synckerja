import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { BarChart3, Layers, Settings2 } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import {
  SUBSCRIPTION_MANAGEMENT_PATH,
  SUBSCRIPTION_OVERVIEW_PATH,
  SUBSCRIPTION_PLANS_PATH,
} from "@/mobile/6-subscription/shared/mobileSubscriptionNavPaths";
import { MobileNavTabButton } from "@/shared/auth/page-access/MobileNavTabButton";
import { SUBSCRIPTION_TAB_PAGE_PATH } from "@/shared/auth/page-access/mobileRoutePagePaths";

export type SubscriptionTabKey = "overview" | "plans" | "management";

const TABS: Record<SubscriptionTabKey, string> = {
  overview: SUBSCRIPTION_OVERVIEW_PATH,
  plans: SUBSCRIPTION_PLANS_PATH,
  management: SUBSCRIPTION_MANAGEMENT_PATH,
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
      <nav className="mobile-app-bottom-nav fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-card safe-area-bottom-lower">
        <div
          className={cn(
            "mx-auto grid w-full max-w-md grid-cols-3",
            className,
          )}
        >
          {tabItems.map(({ key, icon: Icon }) => {
            const isActive = activeTab === key;
            return (
              <MobileNavTabButton
                key={key}
                pagePath={SUBSCRIPTION_TAB_PAGE_PATH[key]}
                label={labels[key]}
                icon={Icon}
                isActive={isActive}
                onActivate={() => onTabChange(key)}
                labelClassName="text-xs font-medium"
              />
            );
          })}
        </div>
      </nav>
    );
};

export const SubscriptionBottomTabs = memo(SubscriptionBottomTabsComponent);
SubscriptionBottomTabs.displayName = "SubscriptionBottomTabs";

const getTabKeyFromPath = (pathname: string): SubscriptionTabKey => {
  if (pathname.includes(SUBSCRIPTION_OVERVIEW_PATH)) return "overview";
  if (pathname.includes(SUBSCRIPTION_MANAGEMENT_PATH)) return "management";
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

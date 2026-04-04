import { useMemo, useTransition } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { LayoutDashboard, Users, Megaphone, FileText, CreditCard } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

type TabId = "dashboard" | "kol-management" | "campaigns" | "content-post" | "payment-terms";

interface HeaderAndTabProps {
  activeTab: TabId;
  onTabChange?: (tab: TabId) => void;
}

const pathForTab = (tab: TabId) => {
  switch (tab) {
    case "dashboard":
      return "/kol-management/dashboard";
    case "kol-management":
      return "/kol-management/kol-management";
    case "campaigns":
      return "/kol-management/campaigns";
    case "content-post":
      return "/kol-management/content-post";
    case "payment-terms":
      return "/kol-management/payment-terms";
  }
};

export const HeaderAndTab = ({ activeTab, onTabChange }: HeaderAndTabProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useAppTranslation();
  const [, startTransition] = useTransition();

  const tabs = useMemo(
    () =>
      [
        {
          id: "dashboard" as const,
          label: t("kolManagement.header.tabs.dashboard", "Dashboard"),
          icon: LayoutDashboard,
          description: t(
            "kolManagement.header.tabs.dashboardDescription",
            "Overview of KOL management metrics and insights",
          ),
          route: pathForTab("dashboard"),
        },
        {
          id: "kol-management" as const,
          label: t("kolManagement.header.tabs.kolManagement", "KOL Management"),
          icon: Users,
          description: t(
            "kolManagement.header.tabs.kolManagementDescription",
            "Manage KOL profiles, ratings, and information",
          ),
          route: pathForTab("kol-management"),
        },
        {
          id: "campaigns" as const,
          label: t("kolManagement.header.tabs.campaigns", "Campaigns"),
          icon: Megaphone,
          description: t(
            "kolManagement.header.tabs.campaignsDescription",
            "Manage KOL campaigns and assignments",
          ),
          route: pathForTab("campaigns"),
        },
        {
          id: "content-post" as const,
          label: t("kolManagement.header.tabs.contentPost", "Content Post"),
          icon: FileText,
          description: t(
            "kolManagement.header.tabs.contentPostDescription",
            "Manage content posts and deliverables",
          ),
          route: pathForTab("content-post"),
        },
        {
          id: "payment-terms" as const,
          label: t("kolManagement.header.tabs.paymentTerms", "Payment Terms"),
          icon: CreditCard,
          description: t(
            "kolManagement.header.tabs.paymentTermsDescription",
            "Manage payment terms and milestones",
          ),
          route: pathForTab("payment-terms"),
        },
      ] as const,
    [t],
  );

  const handleTabClick = (tab: TabId, route: string) => {
    onTabChange?.(tab);
    // Lazy route chunks + React 18: avoid synchronous suspend on click.
    startTransition(() => {
      navigate(route);
    });
  };

  return (
    <div className="px-1 py-3">
      <div className="mb-3">
        <h1 className="mb-0.5 text-xl font-bold text-gray-900">
          {t("kolManagement.header.title", "KOL Management")}
        </h1>
        <p className="text-xs text-gray-600">
          {t(
            "kolManagement.header.description",
            "Manage KOL profiles, campaigns, and content posts",
          )}
        </p>
      </div>

      <div className="-mb-3">
        <nav className="flex space-x-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const isActiveByLocation =
              tab.route !== "/kol-management/dashboard" &&
              location.pathname === tab.route;
            const effectiveActive = isActive || isActiveByLocation;

            return (
              <div
                key={tab.id}
                onClick={() => handleTabClick(tab.id, tab.route)}
                className={`flex cursor-pointer items-center space-x-1.5 py-1.5 px-1 border-b font-medium text-sm transition-colors ${
                  effectiveActive
                    ? "border-brand-blue text-brand-blue"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
                style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
                aria-label={tab.description}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    handleTabClick(tab.id, tab.route);
                  }
                }}
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


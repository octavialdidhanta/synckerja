import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { LayoutDashboard, Users, MessageCircle, Instagram, Mail, Inbox, FileText, ListChecks, Megaphone, Settings, History } from "lucide-react";
import { useDepartmentAccess } from "@/shared/auth/page-access/useDepartmentAccess";
import { useCentralizedUserData } from "@/shared/auth/contexts/CentralizedUserDataContext";
import { OMNICHANNEL_SETTINGS_INDEX_REDIRECT_TO } from "@/5-3-dashboard/omnichannel-settings/constants/omnichannelSettingsSections";

type CrmHeaderTab = {
  key: string;
  path: string;
  title: string;
  titleKey?: string;
  icon: LucideIcon;
  /** When set, permission checks use this path (same access as WhatsApp templates). */
  accessPath?: string;
};

function tabAccessPath(tab: CrmHeaderTab): string {
  return tab.accessPath ?? tab.path;
}

const tabs: CrmHeaderTab[] = [
  {
    key: "dashboard",
    path: "/omnichannel/crm",
    title: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    key: "leads-management",
    path: "/omnichannel/leads",
    title: "Leads Management",
    icon: Users,
  },
  {
    key: "whatsapp-connect",
    path: "/omnichannel/integrations/whatsapp",
    title: "Connect WhatsApp",
    icon: MessageCircle,
  },
  {
    key: "instagram-connect",
    path: "/omnichannel/integrations/instagram",
    title: "Connect Instagram",
    icon: Instagram,
  },
  {
    key: "email-connect",
    path: "/omnichannel/integrations/email",
    title: "Connect Email",
    icon: Mail,
  },
  {
    key: "livechat",
    path: "/omnichannel/livechat",
    title: "Live Chat",
    icon: Inbox,
  },
  {
    key: "template-followups",
    path: "/omnichannel/livechat/template-follow-ups",
    accessPath: "/omnichannel/livechat",
    title: "Template Follow-up",
    titleKey: "whatsappTemplateFollowups.tabTitle",
    icon: History,
  },
  {
    key: "whatsapp-campaign",
    path: "/omnichannel/campaign/whatsapp",
    accessPath: "/operations/consultant/whatsapp/templates",
    title: "WhatsApp Campaign",
    titleKey: "whatsappTemplates.campaignRoute.tabTitle",
    icon: Megaphone,
  },
  {
    key: "whatsapp-templates",
    path: "/omnichannel/campaign/templates",
    accessPath: "/operations/consultant/whatsapp/templates",
    title: "WhatsApp Template",
    titleKey: "sidebar.operations.whatsappTemplates.title",
    icon: FileText,
  },
  {
    key: "whatsapp-recipient-lists",
    path: "/omnichannel/campaign/recipient-lists",
    accessPath: "/omnichannel/campaign/recipient-lists",
    title: "Recipient Lists",
    titleKey: "whatsappTemplates.subTab.recipientLists",
    icon: ListChecks,
  },
  {
    key: "omnichannel-settings",
    path: OMNICHANNEL_SETTINGS_INDEX_REDIRECT_TO,
    title: "Settings",
    titleKey: "sidebar.operations.settings.title",
    icon: Settings,
  },
];

export const HeaderAndTab = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { canAccessPage, configLoading } = useDepartmentAccess();
  const { isOwner, isAdmin } = useCentralizedUserData();

  const canSeeCrmPath = (path: string) =>
    isOwner || isAdmin || configLoading || canAccessPage(path);

  const visibleTabs = tabs.filter((tab) => canSeeCrmPath(tabAccessPath(tab)));

  const isLiveChatSection =
    location.pathname === "/omnichannel/livechat" ||
    location.pathname.startsWith("/omnichannel/livechat/");

  const livechatTabKeys = new Set<string>(["livechat", "template-followups"]);

  const isCampaignCrmSection =
    location.pathname === "/omnichannel/campaign/whatsapp" ||
    location.pathname.startsWith("/omnichannel/campaign/whatsapp/") ||
    location.pathname === "/omnichannel/campaign/templates" ||
    location.pathname.startsWith("/omnichannel/campaign/templates/") ||
    location.pathname === "/omnichannel/campaign/recipient-lists" ||
    location.pathname.startsWith("/omnichannel/campaign/recipient-lists/");

  const isIntegrationsSection =
    location.pathname.startsWith("/omnichannel/integrations/whatsapp") ||
    location.pathname.startsWith("/omnichannel/integrations/instagram") ||
    location.pathname.startsWith("/omnichannel/integrations/email");

  const isOmnichannelSettingsSection =
    location.pathname === "/omnichannel/settings" ||
    location.pathname.startsWith("/omnichannel/settings/");

  const isCrmCoreSection =
    location.pathname === "/omnichannel/crm" ||
    location.pathname.startsWith("/omnichannel/crm/") ||
    location.pathname === "/omnichannel/leads" ||
    location.pathname.startsWith("/omnichannel/leads/");

  const integrationTabKeys = new Set<string>([
    "whatsapp-connect",
    "instagram-connect",
    "email-connect",
  ]);

  const crmCoreTabKeys = new Set<string>(["dashboard", "leads-management"]);

  const campaignCrmTabKeys = new Set<string>([
    "whatsapp-campaign",
    "whatsapp-templates",
    "whatsapp-recipient-lists",
  ]);

  const displayedTabs = isLiveChatSection
    ? visibleTabs.filter((tab) => livechatTabKeys.has(tab.key))
    : isOmnichannelSettingsSection
      ? visibleTabs.filter((tab) => tab.key === "omnichannel-settings")
      : isCampaignCrmSection
        ? visibleTabs.filter((tab) => campaignCrmTabKeys.has(tab.key))
        : isIntegrationsSection
          ? visibleTabs.filter((tab) => integrationTabKeys.has(tab.key))
          : isCrmCoreSection
            ? visibleTabs.filter((tab) => crmCoreTabKeys.has(tab.key))
            : visibleTabs;

  useEffect(() => {
    if (configLoading || isOwner || isAdmin) return;
    const match = [...tabs]
      .sort((a, b) => b.path.length - a.path.length)
      .find(
        (tab) =>
          location.pathname === tab.path || location.pathname.startsWith(`${tab.path}/`),
      );
    if (!match) return;
    if (!canAccessPage(tabAccessPath(match))) {
      const next = tabs.find((tab) => canAccessPage(tabAccessPath(tab)));
      if (next) navigate(next.path, { replace: true });
    }
  }, [configLoading, isOwner, isAdmin, location.pathname, canAccessPage, navigate]);

  const activeKey = useMemo(() => {
    if (location.pathname === "/omnichannel/leads" || location.pathname.startsWith("/omnichannel/leads/"))
      return "leads-management";
    if (location.pathname.startsWith("/omnichannel/integrations/whatsapp")) return "whatsapp-connect";
    if (location.pathname.startsWith("/omnichannel/integrations/instagram")) return "instagram-connect";
    if (location.pathname.startsWith("/omnichannel/integrations/email")) return "email-connect";
    if (location.pathname.startsWith("/omnichannel/livechat/template-follow-ups")) return "template-followups";
    if (location.pathname.startsWith("/omnichannel/livechat")) return "livechat";
    if (location.pathname === "/omnichannel/settings" || location.pathname.startsWith("/omnichannel/settings/"))
      return "omnichannel-settings";
    if (
      location.pathname === "/omnichannel/campaign/recipient-lists" ||
      location.pathname.startsWith("/omnichannel/campaign/recipient-lists/")
    ) {
      return "whatsapp-recipient-lists";
    }
    if (location.pathname.startsWith("/omnichannel/campaign/templates")) return "whatsapp-templates";
    if (
      location.pathname === "/omnichannel/campaign/whatsapp" ||
      location.pathname.startsWith("/omnichannel/campaign/whatsapp/")
    ) {
      return "whatsapp-campaign";
    }
    const match = [...tabs]
      .sort((a, b) => b.path.length - a.path.length)
      .find((tab) => location.pathname.startsWith(tab.path));
    return match?.key ?? "leads-management";
  }, [location.pathname]);

  const headerTitle = isIntegrationsSection
    ? t("sidebar.operations.integrations.title")
    : isLiveChatSection
      ? t("sidebar.operations.livechat.title")
      : isOmnichannelSettingsSection
        ? t("omnichannel.settings.pageTitle")
        : isCampaignCrmSection
          ? t("sidebar.operations.whatsappTemplates.menuTitle")
          : t("crm.consultantHeader.title");

  const headerSubtitle = isIntegrationsSection
    ? t("sidebar.operations.integrations.description")
    : isLiveChatSection
      ? t("sidebar.operations.livechat.description")
      : isOmnichannelSettingsSection
        ? t("omnichannel.settings.pageSubtitle")
        : isCampaignCrmSection
          ? t("sidebar.operations.whatsappTemplates.description")
          : t("crm.consultantHeader.subtitle");

  return (
    <div className="min-w-0 max-w-full px-1 py-3">
      {/* Header Section */}
      <div className="mb-3 min-w-0">
        <h1 className="text-xl font-bold text-gray-900 mb-0.5">{headerTitle}</h1>
        <p className="text-xs text-gray-600">{headerSubtitle}</p>
      </div>

      {/* Tabs Section */}
      <div className="-mb-3 min-w-0 overflow-x-auto seamless-scroll">
        <nav className="flex min-w-0 flex-nowrap gap-x-6">
          {displayedTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeKey === tab.key;
            
            return (
              <div
                key={tab.key}
                role="button"
                tabIndex={0}
                onClick={() => {
                  if (!canSeeCrmPath(tabAccessPath(tab))) return;
                  navigate(tab.path);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    if (!canSeeCrmPath(tabAccessPath(tab))) return;
                    navigate(tab.path);
                  }
                }}
                className={`flex items-center space-x-1.5 py-1.5 px-1 border-b-2 font-medium text-sm cursor-pointer transition-colors ${
                  isActive
                    ? "border-brand-blue text-brand-blue"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-surface-border"
                }`}
                style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.titleKey ? t(tab.titleKey) : tab.title}</span>
              </div>
            );
          })}
        </nav>
      </div>
    </div>
  );
};

export default HeaderAndTab;


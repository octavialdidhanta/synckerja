import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { BarChart3, Clock, CreditCard, Home, Lock, MessageCircle, Receipt, UserPlus, Wallet } from "lucide-react";
import { NavLink } from "react-router-dom";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
} from "@/mobile-app/components/ui/sidebar";
import { MOBILE_INCOMES_DASHBOARD_PATH } from "@/mobile/3-dashboard/shared/mobileIncomesNavPaths";
import { Separator } from "@/mobile-app/components/ui/separator";
import { useIsMobile } from "@/shared/hooks/use-mobile";
import { useOrganizationList } from "@/mobile-app/hooks/useOrganizationList";
import { useOrganizationSwitchCallback } from "@/shared/hooks/useOrganizationSwitchCallback";
import { OrganizationSelectDrawer } from "@/mobile-app/components/OrganizationSelectDrawer";
import { TOOLS_DAILY_TASK_PATH } from "@/mobile/5-daily-task/shared/toolsDailyTaskPath";
import {
  CONSULTANT_LEADS_MANAGEMENT_PATH,
  CONSULTANT_LIVECHAT_PATH,
} from "@/mobile/4-leads-management/shared/consultantCrmNavPaths";
import { SUBSCRIPTION_OVERVIEW_PATH } from "@/mobile/6-subscription/shared/mobileSubscriptionNavPaths";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useSubscriptionSelfServiceEnabled } from "@/shared/auth/hooks/useSubscriptionSelfServiceEnabled";
import { useFilteredNavByPageAccess } from "@/shared/auth/page-access/useFilteredNavByPageAccess";
import { useHeaderTabPageAccess } from "@/shared/auth/page-access/useHeaderTabPageAccess";
import { mobileSidebarPagePathForUrl } from "@/shared/auth/page-access/mobileRoutePagePaths";

type SidebarNavItem = {
  url: string;
  icon: LucideIcon;
} & (
  | { title: string }
  | { titleKey: string; titleDefault: string }
);

const menuItems: SidebarNavItem[] = [
  { title: "Home", url: "/", icon: Home },
  { title: "Expense", url: "/expenses/dashboard", icon: Receipt },
  { title: "Incomes", url: MOBILE_INCOMES_DASHBOARD_PATH, icon: Wallet },
  { title: "CRM", url: CONSULTANT_LIVECHAT_PATH, icon: MessageCircle },
  {
    titleKey: "sidebar.operations.leadsManagement.title",
    titleDefault: "Leads",
    url: CONSULTANT_LEADS_MANAGEMENT_PATH,
    icon: UserPlus,
  },
  { title: "Daily Task", url: TOOLS_DAILY_TASK_PATH, icon: Clock },
  { title: "Web Traffic", url: "/digital-marketing/traffic", icon: BarChart3 },
  { title: "Subscription", url: SUBSCRIPTION_OVERVIEW_PATH, icon: CreditCard },
];

function itemLabel(item: SidebarNavItem, t: ReturnType<typeof useAppTranslation>["t"]) {
  return "title" in item ? item.title : t(item.titleKey, item.titleDefault);
}

export function AppSidebar() {
  const { t } = useAppTranslation();
  const { isTabLocked } = useHeaderTabPageAccess();
  const { filterNavItems } = useFilteredNavByPageAccess();
  const selfServiceEnabled = useSubscriptionSelfServiceEnabled();
  const menuItemsFiltered = useMemo(
    () =>
      selfServiceEnabled
        ? menuItems
        : menuItems.filter((item) => item.url !== SUBSCRIPTION_OVERVIEW_PATH),
    [selfServiceEnabled],
  );
  const visibleMenuItems = filterNavItems(
    menuItemsFiltered.map((item) => ({ ...item, path: item.url })),
  );
  const isMobile = useIsMobile();
  const { isMobile: sidebarMobile, setOpenMobile } = useSidebar();
  const { organizations, activeOrganization } = useOrganizationList();
  const onOrganizationSwitched = useOrganizationSwitchCallback();
  const [orgDrawerOpen, setOrgDrawerOpen] = useState(false);

  const canOpenOrgDrawer = isMobile && organizations.length > 1 && selfServiceEnabled;
  const organizationDisplayName = activeOrganization?.company_name ?? "Organisasi";

  return (
    <Sidebar className="border-r border-primary/20 bg-background overflow-x-hidden">
      <SidebarContent className="bg-background overflow-x-hidden min-w-0">
        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center gap-2 text-foreground px-4 py-2 min-w-0">
            {isMobile ? (
              <>
                <span
                  role={canOpenOrgDrawer ? "button" : undefined}
                  tabIndex={canOpenOrgDrawer ? 0 : undefined}
                  onClick={canOpenOrgDrawer ? () => setOrgDrawerOpen(true) : undefined}
                  onKeyDown={
                    canOpenOrgDrawer
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setOrgDrawerOpen(true);
                          }
                        }
                      : undefined
                  }
                  className={`text-sm font-medium text-foreground truncate ${canOpenOrgDrawer ? "cursor-pointer hover:opacity-80" : ""}`}
                >
                  {organizationDisplayName}
                </span>
              </>
            ) : (
              <>
                <Clock className="h-5 w-5 text-primary flex-shrink-0" />
                <span className="text-foreground">ProfitLoop</span>
              </>
            )}
          </SidebarGroupLabel>

          <Separator className="bg-primary/20 mx-4 mb-1.5" />

          <SidebarGroupContent className="px-2 pb-2">
            <SidebarMenu className="space-y-0.5">
              {visibleMenuItems.map((item) => {
                const pagePath = mobileSidebarPagePathForUrl(item.url);
                const locked = isTabLocked(pagePath);
                return (
                <SidebarMenuItem key={item.url}>
                  <NavLink
                    to={item.url}
                    end
                    onClick={() => {
                      if (sidebarMobile) setOpenMobile(false);
                    }}
                    title={
                      locked
                        ? t("accessDenied.message", "You do not have permission to view this page.")
                        : undefined
                    }
                    className={({ isActive }) =>
                      [
                        "flex items-center gap-3 px-3 py-2 rounded-lg w-full min-w-0 transition-colors",
                        locked && "opacity-70",
                        isActive ? "text-primary font-medium" : "text-foreground hover:bg-primary/10",
                      ].join(" ")
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <item.icon className="h-4 w-4 flex-shrink-0" />
                        <span className="font-medium truncate min-w-0 flex-1 flex items-center gap-1">
                          {itemLabel(item, t)}
                          {locked ? <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden /> : null}
                        </span>
                        <span
                          className={`flex-shrink-0 flex items-center justify-center rounded-full p-1 transition-colors ${
                            isActive ? "bg-primary/10 ring-1 ring-primary/20" : "bg-muted/40 ring-1 ring-border/50"
                          }`}
                          aria-hidden
                        >
                          <span
                            className={`w-2.5 h-2.5 rounded-full border-2 transition-colors ${
                              isActive
                                ? "bg-primary border-primary shadow-sm"
                                : "bg-transparent border-muted-foreground/30"
                            }`}
                          />
                        </span>
                      </>
                    )}
                  </NavLink>
                </SidebarMenuItem>
              );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {isMobile && (
        <OrganizationSelectDrawer
          open={orgDrawerOpen}
          onOpenChange={setOrgDrawerOpen}
          onSwitched={onOrganizationSwitched}
        />
      )}
    </Sidebar>
  );
}

import type { LucideIcon } from "lucide-react";
import { Briefcase, ClipboardList, CreditCard, Layers, MessagesSquare, Target, Users, Wallet, Wrench } from "lucide-react";
import { OMNICHANNEL_SETTINGS_INDEX_REDIRECT_TO } from "@/5-3-dashboard/omnichannel-settings/constants/omnichannelSettingsSections";

/** Strip query/hash for path comparison */
export function pathBaseFromNavPath(full: string): string {
  const q = full.indexOf("?");
  const h = full.indexOf("#");
  const cut = q >= 0 && h >= 0 ? Math.min(q, h) : q >= 0 ? q : h >= 0 ? h : -1;
  return cut >= 0 ? full.slice(0, cut) : full;
}

export function navSubItemPathMatches(pathname: string, pathWithMaybeQuery: string): boolean {
  const base = pathBaseFromNavPath(pathWithMaybeQuery);
  return base === "/"
    ? pathname === "/"
    : pathname === base || pathname.startsWith(`${base}/`);
}

/** Active state for nav sub-items that share a path with different query params (see `matchSearch` / `inactiveWhenSearch`). */
export function isNavSubItemActive(item: NavSubItem, pathname: string, search: string): boolean {
  const pathActive =
    navSubItemPathMatches(pathname, item.path) ||
    Boolean(item.activePathPrefixes?.some((prefix) => navSubItemPathMatches(pathname, prefix)));
  if (!pathActive) return false;

  const sp = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);

  if (item.matchSearch && Object.keys(item.matchSearch).length > 0) {
    for (const [k, v] of Object.entries(item.matchSearch)) {
      if (sp.get(k) !== v) return false;
    }
    return true;
  }

  if (item.inactiveWhenSearch && Object.keys(item.inactiveWhenSearch).length > 0) {
    for (const [k, v] of Object.entries(item.inactiveWhenSearch)) {
      if (sp.get(k) === v) return false;
    }
  }

  return true;
}

export type NavSubItem = {
  titleKey: string;
  path: string;
  /**
   * When false, this sub-item still shows active in the flyout but does not mark the main sidebar parent row active.
   */
  highlightsParent?: boolean;
  /** Extra prefixes that highlight this sub-item (e.g. /my-info for employee detail) */
  activePathPrefixes?: string[];
  /** All of these query params must match for this row to be active */
  matchSearch?: Record<string, string>;
  /** If the URL has these query values, this row is not active (e.g. hide “CRM” when `?view=report`) */
  inactiveWhenSearch?: Record<string, string>;
  /** Sub-item requires Lead Magnet add-on entitlement (in addition to parent module). */
  requiresLeadMagnetAddon?: boolean;
  /** Optional group heading rendered above this item in the flyout. */
  sectionTitleKey?: string;
};

export type MainNavItem = {
  id: string;
  titleKey: string;
  icon: LucideIcon;
  /** When set, row navigates here; when only subItems, hover opens sub-panel */
  path?: string;
  /** Flyout panel heading; falls back to `titleKey` when omitted. */
  panelTitleKey?: string;
  /** When set, highlight this nav row for any path under this prefix (e.g. /okr for all OKR tabs) */
  activePathPrefix?: string;
  /** Additional path prefixes for parent highlight (e.g. /my-info under Human Resources) */
  activePathPrefixes?: string[];
  subItems?: NavSubItem[];
};

export const mainNavItems: MainNavItem[] = [
  {
    id: "dashboard",
    titleKey: "layout.nav.dashboard",
    icon: Layers,
    path: "/",
  },
  {
    id: "okr",
    titleKey: "layout.nav.okr",
    icon: Target,
    path: "/okr/company-objective",
    activePathPrefix: "/okr",
  },
  {
    id: "humanResources",
    titleKey: "layout.nav.humanResources",
    icon: Users,
    activePathPrefixes: [
      "/my-info",
      "/recruitment",
      "/attendance",
      "/payroll",
      "/company",
      "/access-permissions",
    ],
    subItems: [
      { titleKey: "layout.subnav.hrEmployees", path: "/employees", activePathPrefixes: ["/my-info"] },
      { titleKey: "layout.subnav.hrRecruitment", path: "/recruitment", activePathPrefixes: ["/recruitment"] },
      { titleKey: "layout.subnav.hrAttendance", path: "/attendance" },
      {
        titleKey: "sidebar.humanResources.payroll.title",
        path: "/payroll/calculations",
        activePathPrefixes: ["/payroll"],
      },
      { titleKey: "layout.subnav.hrCompany", path: "/company/dashboard" },
      {
        titleKey: "layout.subnav.hrPageAccess",
        path: "/access-permissions/page-access",
        activePathPrefixes: ["/access-permissions"],
      },
    ],
  },
  {
    id: "finance",
    titleKey: "sidebar.finance.title",
    icon: Wallet,
    activePathPrefixes: ["/incomes", "/expenses", "/xendit", "/finance"],
    subItems: [
      {
        titleKey: "sidebar.finance.incomes.title",
        path: "/incomes/dashboard",
        activePathPrefixes: ["/incomes"],
      },
      {
        titleKey: "sidebar.finance.expenses.title",
        path: "/expenses/dashboard",
        activePathPrefixes: ["/expenses"],
      },
      {
        titleKey: "sidebar.finance.bankMutations.title",
        path: "/finance/bank-mutations",
        activePathPrefixes: ["/finance/bank-mutations"],
      },
      {
        titleKey: "sidebar.finance.xendit.title",
        path: "/xendit/connect",
        activePathPrefixes: ["/xendit"],
      },
    ],
  },
  {
    id: "digitalMarketing",
    titleKey: "sidebar.digitalMarketing.title",
    icon: Target,
    activePathPrefixes: ["/digital-marketing", "/kol-management"],
    subItems: [
      {
        titleKey: "sidebar.digitalMarketing.socialMedia.title",
        path: "/digital-marketing/social-media/dashboard",
        activePathPrefixes: ["/digital-marketing/social-media"],
      },
      {
        titleKey: "sidebar.digitalMarketing.leadMagnet.title",
        path: "/digital-marketing/lead-magnet",
        activePathPrefixes: ["/digital-marketing/lead-magnet"],
        requiresLeadMagnetAddon: true,
      },
      {
        titleKey: "sidebar.digitalMarketing.socialMediaPerformance.title",
        path: "/digital-marketing/social-media-performance/tiktok",
        activePathPrefixes: ["/digital-marketing/social-media-performance"],
      },
      {
        titleKey: "sidebar.digitalMarketing.webTraffic.title",
        path: "/digital-marketing/traffic",
        activePathPrefixes: [
          "/digital-marketing/traffic",
          "/digital-marketing/google-ads",
          "/digital-marketing/meta-ads",
          "/digital-marketing/tiktok-ads",
          "/digital-marketing/report",
        ],
      },
      {
        titleKey: "sidebar.digitalMarketing.kolManagement.title",
        path: "/kol-management/dashboard",
        activePathPrefixes: ["/kol-management"],
      },
    ],
  },
  {
    id: "omnichannel",
    titleKey: "sidebar.operations.title",
    icon: MessagesSquare,
    /** CRM, livechat, integrations, campaign, omnichannel settings — exclude `/operations/sales` (see `operations` nav below). */
    activePathPrefixes: ["/operations/consultant", "/operations/campaign", "/omnichannel"],
    subItems: [
      {
        titleKey: "sidebar.operations.crm.title",
        path: "/omnichannel/crm",
        activePathPrefixes: ["/omnichannel/crm", "/omnichannel/leads"],
      },
      {
        titleKey: "sidebar.operations.livechat.title",
        path: "/omnichannel/livechat",
        activePathPrefixes: ["/omnichannel/livechat"],
      },
      {
        titleKey: "sidebar.operations.contact.title",
        path: "/omnichannel/contact",
        activePathPrefixes: ["/omnichannel/contact"],
      },
      {
        titleKey: "sidebar.operations.integrations.title",
        path: "/omnichannel/integrations/whatsapp",
        activePathPrefixes: [
          "/omnichannel/integrations/whatsapp",
          "/omnichannel/integrations/instagram",
          "/omnichannel/integrations/facebook",
          "/omnichannel/integrations/threads",
          "/omnichannel/integrations/email",
        ],
      },
      {
        titleKey: "sidebar.operations.whatsappTemplates.menuTitle",
        path: "/omnichannel/campaign/whatsapp",
        activePathPrefixes: [
          "/omnichannel/campaign/whatsapp",
          "/omnichannel/campaign/templates",
          "/omnichannel/campaign/recipient-lists",
        ],
      },
      {
        titleKey: "sidebar.operations.settings.title",
        path: OMNICHANNEL_SETTINGS_INDEX_REDIRECT_TO,
        activePathPrefixes: ["/omnichannel/settings"],
      },
    ],
  },
  {
    id: "operations",
    titleKey: "sidebar.salesOperations.title",
    panelTitleKey: "sidebar.salesOperations.panelTitle",
    icon: Briefcase,
    activePathPrefixes: ["/operations/sales", "/operations/library", "/operations/ingredient", "/operations/settings", "/operations/customers-list", "/operations/customers-feedback", "/operations/employees-staff", "/operations/table-management", "/operations/synckerja-order", "/operations/dashboard", "/operations/reports", "/operations/inventory"],
    subItems: [
      {
        titleKey: "sidebar.salesOperations.dashboard",
        path: "/operations/dashboard",
        activePathPrefixes: ["/operations/dashboard"],
      },
      {
        titleKey: "sidebar.salesOperations.reports",
        path: "/operations/reports/sales/summary",
        activePathPrefixes: ["/operations/reports"],
      },
      {
        titleKey: "sidebar.tools.defaultPrices.title",
        path: "/operations/library/service-list",
        activePathPrefixes: ["/operations/library"],
      },
      {
        titleKey: "sidebar.salesOperations.ingredient",
        path: "/operations/ingredient/list",
        activePathPrefixes: ["/operations/ingredient"],
      },
      {
        titleKey: "sidebar.salesOperations.customers",
        path: "/operations/customers-list",
        activePathPrefixes: ["/operations/customers-list", "/operations/customers-feedback"],
      },
      {
        titleKey: "sidebar.salesOperations.employees",
        path: "/operations/employees-staff/slots",
        activePathPrefixes: ["/operations/employees-staff"],
      },
      {
        titleKey: "sidebar.salesOperations.tableManagement",
        path: "/operations/table-management/group",
        activePathPrefixes: ["/operations/table-management"],
      },
      {
        titleKey: "sidebar.salesOperations.synckerjaOrder",
        path: "/operations/synckerja-order",
        activePathPrefixes: ["/operations/synckerja-order"],
        sectionTitleKey: "sidebar.salesOperations.groupOnlineChannels",
      },
      {
        titleKey: "sidebar.salesOperations.settings",
        path: "/operations/settings/outlets-list",
        activePathPrefixes: ["/operations/settings"],
        sectionTitleKey: "sidebar.salesOperations.settings",
      },
      {
        titleKey: "sidebar.operations.sales.stockManagement.title",
        path: "/operations/inventory",
        activePathPrefixes: ["/operations/inventory"],
        sectionTitleKey: "sidebar.salesOperations.groupShared",
      },
      {
        titleKey: "sidebar.operations.sales.title",
        path: "/operations/sales/activities",
        activePathPrefixes: ["/operations/sales/activities", "/operations/sales/jadwal-kunjungan", "/operations/sales/client-visits", "/operations/sales/customer-visits"],
        sectionTitleKey: "sidebar.salesOperations.groupOperations",
      },
      {
        titleKey: "sidebar.operations.sales.tiktokShop.title",
        path: "/operations/sales/tiktok-shop/settings",
        activePathPrefixes: ["/operations/sales/tiktok-shop"],
      },
      {
        titleKey: "sidebar.operations.sales.blibliOrders.title",
        path: "/operations/sales/blibli-orders",
        activePathPrefixes: ["/operations/sales/blibli-orders"],
      },
      {
        titleKey: "sidebar.operations.sales.ecommerceChat.title",
        path: "/operations/sales/ecommerce-chat",
        activePathPrefixes: ["/operations/sales/ecommerce-chat"],
      },
    ],
  },
  {
    id: "tools",
    titleKey: "sidebar.tools.title",
    icon: Wrench,
    activePathPrefixes: [
      "/tools/daily-task",
      "/tools/daily-task-report",
      "/tools/meeting-notes",
      "/tools/habits-tracker",
      "/tools/password-manager",
      "/tools/pph21-calculator",
      "/tools/calculator",
      "/tools/pricing-tools",
      "/tools/promo-simulation",
    ],
    subItems: [
      {
        titleKey: "sidebar.tools.dailyTask.title",
        path: "/tools/daily-task?view=summary",
        activePathPrefixes: ["/tools/daily-task"],
      },
      {
        titleKey: "sidebar.tools.passwordManager.title",
        path: "/tools/password-manager",
        activePathPrefixes: ["/tools/password-manager"],
      },
      {
        titleKey: "sidebar.tools.pph21Calculator.title",
        path: "/tools/pph21-calculator",
        activePathPrefixes: ["/tools/pph21-calculator"],
      },
      {
        titleKey: "sidebar.tools.campaignCalculator.title",
        path: "/tools/calculator/services",
        activePathPrefixes: ["/tools/calculator"],
      },
      {
        titleKey: "sidebar.tools.pricingTools.title",
        path: "/tools/pricing-tools",
        activePathPrefixes: ["/tools/pricing-tools"],
      },
      {
        titleKey: "sidebar.tools.promoSimulation.title",
        path: "/tools/promo-simulation",
        activePathPrefixes: ["/tools/promo-simulation"],
      },
    ],
  },
  {
    id: "requestForm",
    titleKey: "sidebar.requestForm.title",
    icon: ClipboardList,
    path: "/request-form/purchase",
    activePathPrefix: "/request-form",
  },
  {
    id: "subscription",
    titleKey: "layout.nav.subscription",
    icon: CreditCard,
    subItems: [
      { titleKey: "layout.subnav.subscriptionOverview", path: "/subscription/overview" },
      { titleKey: "layout.subnav.subscriptionPlans", path: "/subscription/plans" },
      { titleKey: "layout.subnav.subscriptionManagement", path: "/subscription/management" },
    ],
  },
];

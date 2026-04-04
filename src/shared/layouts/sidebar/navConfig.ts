import type { LucideIcon } from "lucide-react";
import { Briefcase, ClipboardList, CreditCard, Layers, Target, Users, Wallet, Wrench } from "lucide-react";

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
  /** Extra prefixes that highlight this sub-item (e.g. /my-info for employee detail) */
  activePathPrefixes?: string[];
  /** All of these query params must match for this row to be active */
  matchSearch?: Record<string, string>;
  /** If the URL has these query values, this row is not active (e.g. hide “CRM” when `?view=report`) */
  inactiveWhenSearch?: Record<string, string>;
};

export type MainNavItem = {
  id: string;
  titleKey: string;
  icon: LucideIcon;
  /** When set, row navigates here; when only subItems, hover opens sub-panel */
  path?: string;
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
    activePathPrefixes: ["/incomes", "/expenses"],
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
        titleKey: "sidebar.digitalMarketing.kolManagement.title",
        path: "/kol-management/dashboard",
        activePathPrefixes: ["/kol-management"],
      },
    ],
  },
  {
    id: "operations",
    titleKey: "sidebar.operations.title",
    icon: Briefcase,
    activePathPrefixes: ["/operations"],
    subItems: [
      {
        titleKey: "sidebar.operations.crm.title",
        path: "/operations/consultant/leads-management",
        activePathPrefixes: [
          "/operations/consultant/leads-management",
          "/operations/consultant/dashboard",
        ],
      },
      {
        titleKey: "sidebar.operations.sales.title",
        path: "/operations/sales/activities",
        activePathPrefixes: ["/operations/sales"],
      },
      {
        titleKey: "sidebar.operations.whatsappConnect.title",
        path: "/operations/consultant/whatsapp/connect",
        activePathPrefixes: ["/operations/consultant/whatsapp/connect"],
      },
      {
        titleKey: "sidebar.operations.instagramConnect.title",
        path: "/operations/consultant/instagram/connect",
        activePathPrefixes: ["/operations/consultant/instagram/connect"],
      },
      {
        titleKey: "sidebar.operations.emailConnect.title",
        path: "/operations/consultant/email/connect",
        activePathPrefixes: ["/operations/consultant/email/connect"],
      },
      {
        titleKey: "sidebar.operations.livechat.title",
        path: "/operations/consultant/all/livechat",
        activePathPrefixes: ["/operations/consultant/all/livechat"],
      },
    ],
  },
  {
    id: "tools",
    titleKey: "sidebar.tools.title",
    icon: Wrench,
    activePathPrefixes: ["/tools"],
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
        titleKey: "sidebar.tools.defaultPrices.title",
        path: "/tools/default-prices",
        activePathPrefixes: ["/tools/default-prices"],
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

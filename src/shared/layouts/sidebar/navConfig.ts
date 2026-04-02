import type { LucideIcon } from "lucide-react";
import { ClipboardList, CreditCard, Layers, Target, Users, Wallet, Wrench } from "lucide-react";

export type NavSubItem = {
  titleKey: string;
  path: string;
  /** Extra prefixes that highlight this sub-item (e.g. /my-info for employee detail) */
  activePathPrefixes?: string[];
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
    id: "requestForm",
    titleKey: "sidebar.requestForm.title",
    icon: ClipboardList,
    path: "/request-form/purchase",
    activePathPrefix: "/request-form",
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
    ],
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

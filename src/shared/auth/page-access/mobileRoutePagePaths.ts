/**
 * Canonical `pagePath` values for mobile shells — must match `PageAccessGuard` `pagePath` in App.tsx.
 */

export const MOBILE_PAGE_PATH = {
  home: "/",
  schedule: "/operations/sales",
  clientVisit: "/operations/sales",
  expensesDashboard: "/expenses/dashboard",
  expensesDebt: "/expenses/debt",
  expensesApprovals: "/expenses/approvals",
  expensesPaymentProcess: "/expenses/payment-process",
  expensesReminderBills: "/expenses/reminder-bills",
  incomesDashboard: "/incomes/dashboard",
  incomesTransaction: "/incomes/transaction",
  incomesPiutang: "/incomes/piutang",
  toolsDailyTask: "/tools/daily-task",
  toolsDailyTaskReport: "/tools/daily-task-report",
  toolsMeetingNotes: "/tools/meeting-notes",
  toolsHabitsTracker: "/tools/habits-tracker",
  omnichannelLivechat: "/omnichannel/livechat",
  omnichannelLeads: "/omnichannel/leads",
  digitalMarketingTraffic: "/digital-marketing/traffic",
  subscriptionOverview: "/subscription/overview",
  subscriptionPlans: "/subscription/plans",
  subscriptionManagement: "/subscription/management",
} as const;

export type MobilePagePathKey = keyof typeof MOBILE_PAGE_PATH;

/** Expense bottom-tab key → pagePath */
export const EXPENSE_TAB_PAGE_PATH: Record<
  "dashboard" | "debt" | "approvals" | "payment" | "bills",
  string
> = {
  dashboard: MOBILE_PAGE_PATH.expensesDashboard,
  debt: MOBILE_PAGE_PATH.expensesDebt,
  approvals: MOBILE_PAGE_PATH.expensesApprovals,
  payment: MOBILE_PAGE_PATH.expensesPaymentProcess,
  bills: MOBILE_PAGE_PATH.expensesReminderBills,
};

/** Income bottom-tab route segment → pagePath (align with App.tsx guards). */
export const INCOME_TAB_PAGE_PATH: Record<string, string> = {
  dashboard: MOBILE_PAGE_PATH.incomesDashboard,
  transaction: MOBILE_PAGE_PATH.incomesTransaction,
  piutang: MOBILE_PAGE_PATH.incomesPiutang,
  "bank-account": MOBILE_PAGE_PATH.incomesTransaction,
};

/** Mobile bottom-nav route → PageAccess `pagePath` (route may differ from guard path). */
export function mobileFooterPagePathForRoute(route: string): string | null {
  const normalized = route.split("?")[0]?.replace(/\/$/, "") || "/";
  const map: Record<string, string> = {
    "/": MOBILE_PAGE_PATH.home,
    "/schedule": MOBILE_PAGE_PATH.schedule,
    "/client-visit": MOBILE_PAGE_PATH.clientVisit,
    "/reports": "",
    "/profile": "",
  };
  const path = map[normalized];
  if (path === "") return null;
  if (path) return path;
  return normalized;
}

/** Subscription bottom-tab key → pagePath */
export const SUBSCRIPTION_TAB_PAGE_PATH: Record<"overview" | "plans" | "management", string> = {
  overview: MOBILE_PAGE_PATH.subscriptionOverview,
  plans: MOBILE_PAGE_PATH.subscriptionPlans,
  management: MOBILE_PAGE_PATH.subscriptionManagement,
};

/** Mobile AppSidebar `url` → PageAccess `pagePath`. */
export function mobileSidebarPagePathForUrl(url: string): string {
  const normalized = url.split("?")[0]?.replace(/\/$/, "") || "/";
  const map: Record<string, string> = {
    "/": MOBILE_PAGE_PATH.home,
    "/expenses/dashboard": MOBILE_PAGE_PATH.expensesDashboard,
    "/incomes/dashboard": MOBILE_PAGE_PATH.incomesDashboard,
    "/omnichannel/livechat": MOBILE_PAGE_PATH.omnichannelLivechat,
    "/omnichannel/leads": MOBILE_PAGE_PATH.omnichannelLeads,
    "/tools/daily-task": MOBILE_PAGE_PATH.toolsDailyTask,
    "/digital-marketing/traffic": MOBILE_PAGE_PATH.digitalMarketingTraffic,
    "/subscription/overview": MOBILE_PAGE_PATH.subscriptionOverview,
  };
  if (map[normalized]) return map[normalized];
  if (normalized.startsWith("/incomes")) return MOBILE_PAGE_PATH.incomesDashboard;
  return normalized;
}

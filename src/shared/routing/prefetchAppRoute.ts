import { pathBaseFromNavPath } from "@/shared/layouts/sidebar/navConfig";

type PrefetchFn = () => Promise<unknown>;

/** Longest prefix first — matches App.tsx lazy route entry points. */
const ROUTE_CHUNK_PREFETCH: Array<{ prefix: string; prefetch: PrefetchFn }> = [
  {
    prefix: "/digital-marketing/social-media/dashboard",
    prefetch: () => import("@/6-1-dashboard/pages/SocialMediaDashboardPage"),
  },
  {
    prefix: "/digital-marketing/traffic",
    prefetch: () => import("@/6-0-traffic/pages/TrafficPage"),
  },
  {
    prefix: "/kol-management/dashboard",
    prefetch: () =>
      import("@/6-2-1-dashboard/kol-management/pages/KolManagementDashboardPage").then((m) => ({
        default: m.KolManagementDashboardPage,
      })),
  },
  {
    prefix: "/omnichannel/integrations/whatsapp",
    prefetch: () =>
      import("@/5-3-whatsapp/pages/WhatsAppConnectPage").then((m) => ({
        default: m.WhatsAppConnectPage,
      })),
  },
  {
    prefix: "/omnichannel/campaign/whatsapp",
    prefetch: () =>
      import("@/5-3-whatsapp-template/pages/WhatsAppCampaignPage").then((m) => ({
        default: m.WhatsAppCampaignPage,
      })),
  },
  {
    prefix: "/omnichannel/settings",
    prefetch: () =>
      import("@/5-3-dashboard/pages/OmnichannelSettingsPage").then((m) => ({
        default: m.OmnichannelSettingsPage,
      })),
  },
  {
    prefix: "/omnichannel/livechat",
    prefetch: () =>
      import("@/shared/components/mobile/consultantLivechatRouteElement").then((m) => ({
        default: m.ConsultantLivechatRouteElement,
      })),
  },
  {
    prefix: "/omnichannel/crm",
    prefetch: () =>
      import("@/5-3-dashboard/pages/CRMDashboardPage").then((m) => ({
        default: m.CRMDashboardPage,
      })),
  },
  {
    prefix: "/operations/sales",
    prefetch: () =>
      import("@/5-2-activities/pages/SalesOperationsPage").then((m) => ({
        default: m.SalesOperationsPage,
      })),
  },
  {
    prefix: "/tools/daily-task",
    prefetch: () =>
      import("@/shared/components/mobile/dailyTaskRouteElement").then((m) => ({
        default: m.DailyTaskRouteElement,
      })),
  },
  {
    prefix: "/tools/calculator",
    prefetch: () => import("@/8-3-calculator/pages/CalculatorServicesPage"),
  },
  {
    prefix: "/tools/password-manager",
    prefetch: () => import("@/8-PasswordManager/pages/PasswordManagerPage"),
  },
  {
    prefix: "/tools/pph21-calculator",
    prefetch: () => import("@/8-4-pph-21/pages/PPh21CalculatorPage"),
  },
  {
    prefix: "/tools/default-prices",
    prefetch: () => import("@/8-2-1-default-prices/pages/DefaultPricesPage"),
  },
  {
    prefix: "/tools/pricing-tools",
    prefetch: () => import("@/8-2-pricing-tools/pages/PricingToolsPage"),
  },
  {
    prefix: "/tools/promo-simulation",
    prefetch: () => import("@/8-2-promo-simulation/pages/PromoSimulationPage"),
  },
  {
    prefix: "/subscription/overview",
    prefetch: () =>
      import("@/shared/components/mobile/subscriptionMobileRouteElements").then((m) => ({
        default: m.SubscriptionOverviewRouteElement,
      })),
  },
  {
    prefix: "/subscription/plans",
    prefetch: () =>
      import("@/shared/components/mobile/subscriptionMobileRouteElements").then((m) => ({
        default: m.SubscriptionPlansRouteElement,
      })),
  },
  {
    prefix: "/subscription/management",
    prefetch: () =>
      import("@/shared/components/mobile/subscriptionMobileRouteElements").then((m) => ({
        default: m.SubscriptionManagementRouteElement,
      })),
  },
  {
    prefix: "/access-permissions",
    prefetch: () =>
      import("@/2-9-PageAccess/pages/AccessPermissionsPage").then((m) => ({
        default: m.AccessPermissionsConfig,
      })),
  },
  {
    prefix: "/incomes/transaction",
    prefetch: () =>
      import("@/shared/components/mobile/incomesMobileRouteElements").then((m) => ({
        default: m.IncomeTransactionRouteElement,
      })),
  },
  {
    prefix: "/incomes/piutang",
    prefetch: () =>
      import("@/shared/components/mobile/incomesMobileRouteElements").then((m) => ({
        default: m.IncomePiutangRouteElement,
      })),
  },
  {
    prefix: "/incomes",
    prefetch: () =>
      import("@/shared/components/mobile/incomesMobileRouteElements").then((m) => ({
        default: m.IncomeDashboardRouteElement,
      })),
  },
  {
    prefix: "/expenses",
    prefetch: () =>
      import("@/shared/components/mobile/expensesMobileRouteElements").then((m) => ({
        default: m.ExpensesDashboardRouteElement,
      })),
  },
  {
    prefix: "/request-form",
    prefetch: () => import("@/9-request-form/pages/Purchase/Purchase"),
  },
  {
    prefix: "/company",
    prefetch: () => import("@/2-8-dashboard/pages/CompanyDashboardPage"),
  },
  {
    prefix: "/payroll",
    prefetch: () => import("@/2-4-payroll/pages/PayrollCalculationsPageWrapper"),
  },
  {
    prefix: "/attendance",
    prefetch: () =>
      import("@/2-3-attendance/AttendancePage").then((m) => ({ default: m.AttendancePage })),
  },
  {
    prefix: "/recruitment",
    prefetch: () =>
      import("@/2-2-recruitment-dashboard").then((m) => ({ default: m.DashboardOverview })),
  },
  {
    prefix: "/employees",
    prefetch: () => import("@/2-1-employees/EmployeePage"),
  },
  {
    prefix: "/okr",
    prefetch: () => import("@/1-OKR").then((m) => ({ default: m.OKRPage })),
  },
  {
    prefix: "/",
    prefetch: () =>
      import("@/shared/components/mobile/mainAppMobileRouteElements").then((m) => ({
        default: m.HomeRouteElement,
      })),
  },
];

const prefetchedPrefixes = new Set<string>();

function resolvePrefetch(base: string): PrefetchFn | null {
  if (base === "/") {
    return ROUTE_CHUNK_PREFETCH.find((e) => e.prefix === "/")?.prefetch ?? null;
  }
  for (const entry of ROUTE_CHUNK_PREFETCH) {
    if (entry.prefix === "/") continue;
    if (base === entry.prefix || base.startsWith(`${entry.prefix}/`)) {
      return entry.prefetch;
    }
  }
  return null;
}

function prefetchExpenseModuleTabs(): void {
  const fns: PrefetchFn[] = [
    () => import("@/4-2-dashboard/pages/ExpenseDashboardPage"),
    () => import("@/4-2-debt/pages/DebtPage"),
    () => import("@/4-2-approvals/pages/ApprovalsPage"),
    () => import("@/4-2-payment-process/pages/PaymentProcessPage"),
    () => import("@/4-2-reminder-bills/pages/ReminderBillsPage"),
  ];
  for (const fn of fns) void fn();
}

function prefetchRecruitmentModuleTabs(): void {
  const fns: PrefetchFn[] = [
    () => import("@/2-2-recruitment-dashboard").then((m) => ({ default: m.DashboardOverview })),
    () => import("@/2-2-recruitment-dashboard").then((m) => ({ default: m.JobOpeningsPage })),
    () => import("@/2-2-recruitment-dashboard").then((m) => ({ default: m.ApplicationsPageWrapper })),
    () => import("@/2-2-recruitment-dashboard").then((m) => ({ default: m.IntervieweesPage })),
  ];
  for (const fn of fns) void fn();
}

function prefetchAttendanceModuleTabs(): void {
  void import("@/2-3-attendance/AttendancePage").then((m) => {
    void m.AttendancePage;
  });
  void import("@/2-3-employee-attendance");
  void import("@/2-3-settings");
}

function prefetchCompanyModuleTabs(): void {
  const fns: PrefetchFn[] = [
    () => import("@/2-8-dashboard/pages/CompanyDashboardPage"),
    () => import("@/2-8-company-assets/pages/CompanyCompanyAssetsPage"),
    () => import("@/2-8-files/pages/CompanyFilesPage"),
    () => import("@/2-8-organization/pages/CompanyOrganizationPage"),
  ];
  for (const fn of fns) void fn();
}

function prefetchSocialMediaModuleTabs(): void {
  const fns: PrefetchFn[] = [
    () => import("@/6-1-dashboard/pages/SocialMediaDashboardPage"),
    () => import("@/6-1-content-calendar/ContentCalendarPage"),
    () => import("@/6-1-product-knowledge/ProductKnowledgePage"),
    () => import("@/6-1-script-generator/ScriptGeneratorPage"),
    () => import("@/6-1-social-media-settings/SettingsPage"),
  ];
  for (const fn of fns) void fn();
}

function prefetchEmployeesModuleTabs(): void {
  void import("@/2-1-employees/EmployeePage");
  void import("@/2-1-reprimand").then((m) => ({ default: m.ReprimandManagementPage }));
}

function prefetchKolManagementModuleTabs(): void {
  void import("@/6-2-1-dashboard/kol-management/pages/KolManagementDashboardPage");
  void import("@/6-2-1-dashboard/kol-management/components/KOLManagementPage");
  void import("@/6-2-1-dashboard/kol-management/components/KOLCampaignsPage");
  void import("@/6-2-2-content-post");
  void import("@/6-2-3-payment-terms");
}

function prefetchOmnichannelModuleTabs(): void {
  const fns: PrefetchFn[] = [
    () =>
      import("@/5-3-dashboard/pages/CRMDashboardPage").then((m) => ({
        default: m.CRMDashboardPage,
      })),
    () =>
      import("@/shared/components/mobile/consultantLeadsManagementRouteElement").then((m) => ({
        default: m.ConsultantLeadsManagementRouteElement,
      })),
    () =>
      import("@/shared/components/mobile/consultantLivechatRouteElement").then((m) => ({
        default: m.ConsultantLivechatRouteElement,
      })),
    () =>
      import("@/5-3-whatsapp/pages/WhatsAppConnectPage").then((m) => ({
        default: m.WhatsAppConnectPage,
      })),
    () =>
      import("@/5-3-whatsapp/pages/InstagramConnectPage").then((m) => ({
        default: m.InstagramConnectPage,
      })),
    () =>
      import("@/5-3-whatsapp/pages/EmailConnectPage").then((m) => ({ default: m.EmailConnectPage })),
    () =>
      import("@/5-3-whatsapp-template/pages/WhatsAppCampaignPage").then((m) => ({
        default: m.WhatsAppCampaignPage,
      })),
    () =>
      import("@/5-3-whatsapp-template/pages/WhatsAppTemplatePage").then((m) => ({
        default: m.WhatsAppTemplatePage,
      })),
    () =>
      import("@/5-3-whatsapp-template/pages/WhatsAppRecipientListsPage").then((m) => ({
        default: m.WhatsAppRecipientListsPage,
      })),
    () =>
      import("@/5-3-dashboard/pages/OmnichannelSettingsPage").then((m) => ({
        default: m.OmnichannelSettingsPage,
      })),
    () =>
      import("@/5-3-whatsapp/pages/WhatsAppTemplateFollowupsPage").then((m) => ({
        default: m.WhatsAppTemplateFollowupsPage,
      })),
  ];
  for (const fn of fns) void fn();
}

function prefetchToolsModuleTabs(): void {
  const fns: PrefetchFn[] = [
    () =>
      import("@/shared/components/mobile/dailyTaskRouteElement").then((m) => ({
        default: m.DailyTaskRouteElement,
      })),
    () => import("@/8-2-DailyTaskReport/pages/DailyTaskReportPage"),
    () =>
      import("@/shared/components/mobile/habitTrackerRouteElement").then((m) => ({
        default: m.HabitTrackerRouteElement,
      })),
    () =>
      import("@/shared/components/mobile/meetingNotesRouteElement").then((m) => ({
        default: m.MeetingNotesRouteElement,
      })),
    () => import("@/8-PasswordManager/pages/PasswordManagerPage"),
    () => import("@/8-4-pph-21/pages/PPh21CalculatorPage"),
    () => import("@/8-2-1-default-prices/pages/DefaultPricesPage"),
    () => import("@/8-2-pricing-tools/pages/PricingToolsPage"),
    () => import("@/8-2-promo-simulation/pages/PromoSimulationPage"),
    () => import("@/8-3-calculator/pages/CalculatorServicesPage"),
    () => import("@/8-3-calculator/pages/CalculatorSalesPage"),
  ];
  for (const fn of fns) void fn();
}

function prefetchSalesOperationsModuleTabs(): void {
  void import("@/5-2-activities/pages/SalesOperationsPage").then((m) => ({
    default: m.SalesOperationsPage,
  }));
  void import("@/5-2-jadwal-kunjungan/pages/VisitSchedulingRoute");
  void import("@/5-2-client_visits");
}

function prefetchModuleSiblingTabs(base: string): void {
  if (base.startsWith("/expenses")) {
    prefetchExpenseModuleTabs();
    return;
  }
  if (base.startsWith("/recruitment")) {
    prefetchRecruitmentModuleTabs();
    return;
  }
  if (base.startsWith("/attendance")) {
    prefetchAttendanceModuleTabs();
    return;
  }
  if (base.startsWith("/company")) {
    prefetchCompanyModuleTabs();
    return;
  }
  if (base.startsWith("/digital-marketing/social-media")) {
    prefetchSocialMediaModuleTabs();
    return;
  }
  if (base.startsWith("/kol-management")) {
    prefetchKolManagementModuleTabs();
    return;
  }
  if (base.startsWith("/omnichannel") || base.startsWith("/operations/consultant")) {
    prefetchOmnichannelModuleTabs();
    return;
  }
  if (base.startsWith("/tools")) {
    prefetchToolsModuleTabs();
    return;
  }
  if (base.startsWith("/operations/sales")) {
    prefetchSalesOperationsModuleTabs();
    return;
  }
  if (base === "/employees" || base.startsWith("/employees/")) {
    prefetchEmployeesModuleTabs();
  }
}

export function prefetchAppRoute(pathWithQuery: string): void {
  const base = pathBaseFromNavPath(pathWithQuery);
  prefetchModuleSiblingTabs(base);
  const fn = resolvePrefetch(base);
  if (!fn) return;
  if (!prefetchedPrefixes.has(base)) {
    prefetchedPrefixes.add(base);
    void fn();
  }
}

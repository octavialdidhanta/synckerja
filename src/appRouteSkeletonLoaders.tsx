/**
 * Route skeletons for PageAccessGuard `loadingShell` and route Suspense fallbacks.
 * Each skeleton is loaded on demand (separate chunk) so the initial route does not
 * download every module's layout shell at once.
 */
import { createDeferredSkeleton } from "@/shared/components/route-loading/createDeferredSkeleton";

export const RequestFormPageSkeleton = createDeferredSkeleton(() =>
  import("@/9-request-form/components/RequestFormPageSkeleton").then((m) => ({
    default: m.RequestFormPageSkeleton,
  })),
);

export const OkrRouteAccessLoadingShell = createDeferredSkeleton(() =>
  import("@/1-OKR/components/OkrRouteAccessLoadingShell").then((m) => ({
    default: m.OkrRouteAccessLoadingShell,
  })),
);

export const RecruitmentRouteSkeleton = createDeferredSkeleton(() =>
  import("@/2-2-recruitment-dashboard/components/RecruitmentSkeletons").then((m) => ({
    default: m.RecruitmentRouteSkeleton,
  })),
);

export const AttendanceGuardLoadingShell = createDeferredSkeleton(() =>
  import("@/2-3-attendance/components/AttendanceSkeletons").then((m) => ({
    default: m.AttendanceGuardLoadingShell,
  })),
);

export const PayrollRouteSkeleton = createDeferredSkeleton(() =>
  import("@/2-4-payroll/components/PayrollRouteSkeleton").then((m) => ({
    default: m.PayrollRouteSkeleton,
  })),
);

export const OrganizationGuardLoadingShell = createDeferredSkeleton(() =>
  import("@/2-8-organization/components/OrganizationPageSkeleton").then((m) => ({
    default: m.OrganizationGuardLoadingShell,
  })),
);

export const CompanyAssetsGuardLoadingShell = createDeferredSkeleton(() =>
  import("@/2-8-dashboard/skeletons/CompanyPageSkeletons").then((m) => ({
    default: m.CompanyAssetsGuardLoadingShell,
  })),
);

export const CompanyFilesGuardLoadingShell = createDeferredSkeleton(() =>
  import("@/2-8-dashboard/skeletons/CompanyPageSkeletons").then((m) => ({
    default: m.CompanyFilesGuardLoadingShell,
  })),
);

export const CompanyRouteSkeleton = createDeferredSkeleton(() =>
  import("@/2-8-dashboard/skeletons/CompanyRouteSkeleton").then((m) => ({
    default: m.CompanyRouteSkeleton,
  })),
);

export const AccessPermissionsPageSkeleton = createDeferredSkeleton(() =>
  import("@/2-9-PageAccess/skeletons/AccessPermissionsPageSkeleton").then((m) => ({
    default: m.AccessPermissionsPageSkeleton,
  })),
);

export const EmployeesPageSkeleton = createDeferredSkeleton(() =>
  import("@/2-1-employees/components/EmployeesPageSkeleton").then((m) => ({
    default: m.EmployeesPageSkeleton,
  })),
);

export const AddEmployeePageSkeleton = createDeferredSkeleton(() =>
  import("@/2-1-employees/add-employee/AddEmployeePageSkeleton").then((m) => ({
    default: m.AddEmployeePageSkeleton,
  })),
);

export const ExpenseDashboardRouteLoadingShell = createDeferredSkeleton(() =>
  import("@/shared/components/mobile/ExpenseDashboardRouteLoadingShell").then((m) => ({
    default: m.ExpenseDashboardRouteLoadingShell,
  })),
);

export const IncomeBankAccountRouteLoadingShell = createDeferredSkeleton(() =>
  import("@/shared/components/mobile/IncomeBankAccountRouteLoadingShell").then((m) => ({
    default: m.IncomeBankAccountRouteLoadingShell,
  })),
);

export const IncomeDashboardRouteLoadingShell = createDeferredSkeleton(() =>
  import("@/shared/components/mobile/IncomeDashboardRouteLoadingShell").then((m) => ({
    default: m.IncomeDashboardRouteLoadingShell,
  })),
);

export const IncomeTransactionRouteLoadingShell = createDeferredSkeleton(() =>
  import("@/shared/components/mobile/IncomeTransactionRouteLoadingShell").then((m) => ({
    default: m.IncomeTransactionRouteLoadingShell,
  })),
);

export const IncomePiutangRouteLoadingShell = createDeferredSkeleton(() =>
  import("@/shared/components/mobile/IncomePiutangRouteLoadingShell").then((m) => ({
    default: m.IncomePiutangRouteLoadingShell,
  })),
);

export const DebtRouteLoadingShell = createDeferredSkeleton(() =>
  import("@/shared/components/mobile/DebtRouteLoadingShell").then((m) => ({
    default: m.DebtRouteLoadingShell,
  })),
);

export const ApprovalsRouteLoadingShell = createDeferredSkeleton(() =>
  import("@/shared/components/mobile/ApprovalsRouteLoadingShell").then((m) => ({
    default: m.ApprovalsRouteLoadingShell,
  })),
);

export const PaymentProcessRouteLoadingShell = createDeferredSkeleton(() =>
  import("@/shared/components/mobile/PaymentProcessRouteLoadingShell").then((m) => ({
    default: m.PaymentProcessRouteLoadingShell,
  })),
);

export const ReminderBillsRouteLoadingShell = createDeferredSkeleton(() =>
  import("@/shared/components/mobile/ReminderBillsRouteLoadingShell").then((m) => ({
    default: m.ReminderBillsRouteLoadingShell,
  })),
);

export const DailyTaskRouteLoadingShell = createDeferredSkeleton(() =>
  import("@/shared/components/mobile/DailyTaskRouteLoadingShell").then((m) => ({
    default: m.DailyTaskRouteLoadingShell,
  })),
);

export const DailyTaskReportRouteLoadingShell = createDeferredSkeleton(() =>
  import("@/shared/components/mobile/DailyTaskReportRouteLoadingShell").then((m) => ({
    default: m.DailyTaskReportRouteLoadingShell,
  })),
);

export const HabitTrackerPageSkeleton = createDeferredSkeleton(() =>
  import("@/8-2-HabitTracker/skeletons/HabitTrackerPageSkeleton").then((m) => ({
    default: m.HabitTrackerPageSkeleton,
  })),
);

export const MeetingNotesRouteLoadingShell = createDeferredSkeleton(() =>
  import("@/shared/components/mobile/MeetingNotesRouteLoadingShell").then((m) => ({
    default: m.MeetingNotesRouteLoadingShell,
  })),
);

export const PasswordManagerPageSkeleton = createDeferredSkeleton(() =>
  import("@/8-PasswordManager/skeletons/PasswordManagerPageSkeleton").then((m) => ({
    default: m.PasswordManagerPageSkeleton,
  })),
);

export const PPh21PageSkeleton = createDeferredSkeleton(() =>
  import("@/8-4-pph-21/skeletons/PPh21PageSkeleton").then((m) => ({
    default: m.PPh21PageSkeleton,
  })),
);

export const CalculatorPageSkeleton = createDeferredSkeleton(() =>
  import("@/8-3-calculator/skeletons/CalculatorPageSkeleton").then((m) => ({
    default: m.CalculatorPageSkeleton,
  })),
);

export const PricingToolsPageSkeleton = createDeferredSkeleton(() =>
  import("@/8-2-pricing-tools/skeletons/PricingToolsPageSkeleton").then((m) => ({
    default: m.PricingToolsPageSkeleton,
  })),
);

export const PromoSimulationPageSkeleton = createDeferredSkeleton(() =>
  import("@/8-2-promo-simulation/skeletons/PromoSimulationPageSkeleton").then((m) => ({
    default: m.PromoSimulationPageSkeleton,
  })),
);

export const DefaultPricesPageSkeleton = createDeferredSkeleton(() =>
  import("@/8-2-1-default-prices/skeletons/DefaultPricesPageSkeleton").then((m) => ({
    default: m.DefaultPricesPageSkeleton,
  })),
);

export const ConsultantLivechatRouteLoadingShell = createDeferredSkeleton(() =>
  import("@/shared/components/mobile/ConsultantLivechatRouteLoadingShell").then((m) => ({
    default: m.ConsultantLivechatRouteLoadingShell,
  })),
);

export const ConsultantLeadsManagementRouteLoadingShell = createDeferredSkeleton(() =>
  import("@/shared/components/mobile/ConsultantLeadsManagementRouteLoadingShell").then((m) => ({
    default: m.ConsultantLeadsManagementRouteLoadingShell,
  })),
);

export const InstagramConnectPageSkeleton = createDeferredSkeleton(() =>
  import("@/5-3-whatsapp/skeletons/InstagramConnectPageSkeleton").then((m) => ({
    default: m.InstagramConnectPageSkeleton,
  })),
);

export const ConsultantCrmDashboardPageSkeleton = createDeferredSkeleton(() =>
  import("@/5-3-dashboard/skeletons/ConsultantCrmDashboardPageSkeleton").then((m) => ({
    default: m.ConsultantCrmDashboardPageSkeleton,
  })),
);

export const OmnichannelSettingsPageSkeleton = createDeferredSkeleton(() =>
  import("@/5-3-dashboard/skeletons/OmnichannelSettingsPageSkeleton").then((m) => ({
    default: m.OmnichannelSettingsPageSkeleton,
  })),
);

export const EmailConnectPageSkeleton = createDeferredSkeleton(() =>
  import("@/5-3-whatsapp/pages/EmailConnectPageSkeleton").then((m) => ({
    default: m.EmailConnectPageSkeleton,
  })),
);

export const SalesActivitiesPageSkeleton = createDeferredSkeleton(() =>
  import("@/5-2-activities/skeletons/SalesActivitiesPageSkeleton").then((m) => ({
    default: m.SalesActivitiesPageSkeleton,
  })),
);

export const VisitSchedulingPageSkeleton = createDeferredSkeleton(() =>
  import("@/5-2-jadwal-kunjungan/skeletons/VisitSchedulingPageSkeleton").then((m) => ({
    default: m.VisitSchedulingPageSkeleton,
  })),
);

export const ClientVisitsPageSkeleton = createDeferredSkeleton(() =>
  import("@/5-2-client_visits/skeletons/ClientVisitsPageSkeleton").then((m) => ({
    default: m.ClientVisitsPageSkeleton,
  })),
);

export const WhatsAppConnectPageSkeleton = createDeferredSkeleton(() =>
  import("@/5-3-whatsapp/skeletons/WhatsAppConnectPageSkeleton").then((m) => ({
    default: m.WhatsAppConnectPageSkeleton,
  })),
);

export const WhatsAppTemplatePageSkeleton = createDeferredSkeleton(() =>
  import("@/5-3-whatsapp-template/skeletons/WhatsAppTemplatePageSkeleton").then((m) => ({
    default: m.WhatsAppTemplatePageSkeleton,
  })),
);

export const KolManagementRouteLoadingShell = createDeferredSkeleton(() =>
  import("@/6-2-1-dashboard/kol-management/components/KolManagementRouteLoadingShell").then((m) => ({
    default: m.KolManagementRouteLoadingShell,
  })),
);

export const KolManagementDashboardPageSkeleton = createDeferredSkeleton(() =>
  import("@/6-2-1-dashboard/kol-management/skeletons/KolManagementDashboardPageSkeleton").then((m) => ({
    default: m.KolManagementDashboardPageSkeleton,
  })),
);

export const KolManagementKolManagementPageSkeleton = createDeferredSkeleton(() =>
  import("@/6-2-1-dashboard/kol-management/skeletons/KolManagementKolManagementPageSkeleton").then((m) => ({
    default: m.KolManagementKolManagementPageSkeleton,
  })),
);

export const KolManagementCampaignsPageSkeleton = createDeferredSkeleton(() =>
  import("@/6-2-1-dashboard/kol-management/skeletons/KolManagementCampaignsPageSkeleton").then((m) => ({
    default: m.KolManagementCampaignsPageSkeleton,
  })),
);

export const KolManagementContentPostPageSkeleton = createDeferredSkeleton(() =>
  import("@/6-2-1-dashboard/kol-management/skeletons/KolManagementContentPostPageSkeleton").then((m) => ({
    default: m.KolManagementContentPostPageSkeleton,
  })),
);

export const KolManagementPaymentTermsPageSkeleton = createDeferredSkeleton(() =>
  import("@/6-2-1-dashboard/kol-management/skeletons/KolManagementPaymentTermsPageSkeleton").then((m) => ({
    default: m.KolManagementPaymentTermsPageSkeleton,
  })),
);

export const SocialMediaShellSkeleton = createDeferredSkeleton(() =>
  import("@/6-1-dashboard/skeletons/SocialMediaShellSkeleton").then((m) => ({
    default: m.SocialMediaShellSkeleton,
  })),
);

export const SocialMediaDashboardSkeleton = createDeferredSkeleton(() =>
  import("@/6-1-dashboard/skeletons/SocialMediaDashboardSkeleton").then((m) => ({
    default: m.SocialMediaDashboardSkeleton,
  })),
);

export const ContentCalendarPageSkeleton = createDeferredSkeleton(() =>
  import("@/6-1-content-calendar/skeletons/ContentCalendarPageSkeleton").then((m) => ({
    default: m.ContentCalendarPageSkeleton,
  })),
);

export const ProductKnowledgePageSkeleton = createDeferredSkeleton(() =>
  import("@/6-1-product-knowledge/skeletons/ProductKnowledgePageSkeleton").then((m) => ({
    default: m.ProductKnowledgePageSkeleton,
  })),
);

export const ScriptGeneratorPageSkeleton = createDeferredSkeleton(() =>
  import("@/6-1-script-generator/skeletons/ScriptGeneratorPageSkeleton").then((m) => ({
    default: m.ScriptGeneratorPageSkeleton,
  })),
);

export const SocialMediaSettingsPageSkeleton = createDeferredSkeleton(() =>
  import("@/6-1-social-media-settings/skeletons/SocialMediaSettingsPageSkeleton").then((m) => ({
    default: m.SocialMediaSettingsPageSkeleton,
  })),
);

export const TrafficPageSkeleton = createDeferredSkeleton(() =>
  import("@/6-0-traffic/skeletons/TrafficPageSkeleton").then((m) => ({
    default: m.TrafficPageSkeleton,
  })),
);

export const GoogleAdsMetricsPageSkeleton = createDeferredSkeleton(() =>
  import("@/6-0-google-ads/skeletons/GoogleAdsMetricsPageSkeleton").then((m) => ({
    default: m.GoogleAdsMetricsPageSkeleton,
  })),
);

export const MetaAdsMetricsPageSkeleton = createDeferredSkeleton(() =>
  import("@/6-0-meta-ads/skeletons/MetaAdsMetricsPageSkeleton").then((m) => ({
    default: m.MetaAdsMetricsPageSkeleton,
  })),
);

export const TikTokAdsMetricsPageSkeleton = createDeferredSkeleton(() =>
  import("@/6-0-tiktok-ads/skeletons/TikTokAdsMetricsPageSkeleton").then((m) => ({
    default: m.TikTokAdsMetricsPageSkeleton,
  })),
);

export const SocialMediaPerformanceHubPageSkeleton = createDeferredSkeleton(() =>
  import("@/6-0-social-media-performance/skeletons/SocialMediaPerformanceHubPageSkeleton").then(
    (m) => ({
      default: m.SocialMediaPerformanceHubPageSkeleton,
    }),
  ),
);

export const TikTokContentPerformancePageSkeleton = createDeferredSkeleton(() =>
  import("@/6-0-social-media-performance/skeletons/TikTokContentPerformancePageSkeleton").then(
    (m) => ({
      default: m.TikTokContentPerformancePageSkeleton,
    }),
  ),
);

export const DigitalMarketingReportPageSkeleton = createDeferredSkeleton(() =>
  import("@/6-0-report/skeletons/DigitalMarketingReportPageSkeleton").then((m) => ({
    default: m.DigitalMarketingReportPageSkeleton,
  })),
);

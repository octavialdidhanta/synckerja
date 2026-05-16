/**
 * Route skeletons for `PageAccessGuard` `loadingShell` and route `Suspense` fallbacks.
 *
 * Must be **static** imports — `React.lazy` skeleton chunks are excluded from SW precache
 * and break after deploy (404 `*PageSkeleton-*.js`) when the main bundle still references an old hash.
 * Home shells stay in `App.tsx` (`HomePageSkeleton`, `HomePageRouteLoadingShell`).
 */
export { RequestFormPageSkeleton } from "@/9-request-form/components/RequestFormPageSkeleton";
export { OkrRouteAccessLoadingShell } from "@/1-OKR/components/OkrRouteAccessLoadingShell";
export { RecruitmentRouteSkeleton } from "@/2-2-recruitment-dashboard/components/RecruitmentSkeletons";
export { AttendanceGuardLoadingShell } from "@/2-3-attendance/components/AttendanceSkeletons";
export { PayrollRouteSkeleton } from "@/2-4-payroll/components/PayrollRouteSkeleton";
export { OrganizationGuardLoadingShell } from "@/2-8-organization/components/OrganizationPageSkeleton";
export {
  CompanyAssetsGuardLoadingShell,
  CompanyFilesGuardLoadingShell,
} from "@/2-8-dashboard/skeletons/CompanyPageSkeletons";
export { CompanyRouteSkeleton } from "@/2-8-dashboard/skeletons/CompanyRouteSkeleton";
export { AccessPermissionsPageSkeleton } from "@/2-9-PageAccess/skeletons/AccessPermissionsPageSkeleton";
export { EmployeesPageSkeleton } from "@/2-1-employees/components/EmployeesPageSkeleton";
export { AddEmployeePageSkeleton } from "@/2-1-employees/add-employee/AddEmployeePageSkeleton";
export { ExpenseDashboardRouteLoadingShell } from "@/shared/components/mobile/ExpenseDashboardRouteLoadingShell";
export { IncomeBankAccountRouteLoadingShell } from "@/shared/components/mobile/IncomeBankAccountRouteLoadingShell";
export { IncomeDashboardRouteLoadingShell } from "@/shared/components/mobile/IncomeDashboardRouteLoadingShell";
export { IncomeTransactionRouteLoadingShell } from "@/shared/components/mobile/IncomeTransactionRouteLoadingShell";
export { IncomePiutangRouteLoadingShell } from "@/shared/components/mobile/IncomePiutangRouteLoadingShell";
export { DebtRouteLoadingShell } from "@/shared/components/mobile/DebtRouteLoadingShell";
export { ApprovalsRouteLoadingShell } from "@/shared/components/mobile/ApprovalsRouteLoadingShell";
export { PaymentProcessRouteLoadingShell } from "@/shared/components/mobile/PaymentProcessRouteLoadingShell";
export { ReminderBillsRouteLoadingShell } from "@/shared/components/mobile/ReminderBillsRouteLoadingShell";
export { DailyTaskRouteLoadingShell } from "@/shared/components/mobile/DailyTaskRouteLoadingShell";
export { DailyTaskReportRouteLoadingShell } from "@/shared/components/mobile/DailyTaskReportRouteLoadingShell";
export { HabitTrackerPageSkeleton } from "@/8-2-HabitTracker/skeletons/HabitTrackerPageSkeleton";
export { MeetingNotesRouteLoadingShell } from "@/shared/components/mobile/MeetingNotesRouteLoadingShell";
export { PasswordManagerPageSkeleton } from "@/8-PasswordManager/skeletons/PasswordManagerPageSkeleton";
export { PPh21PageSkeleton } from "@/8-4-pph-21/skeletons/PPh21PageSkeleton";
export { CalculatorPageSkeleton } from "@/8-3-calculator/skeletons/CalculatorPageSkeleton";
export { PricingToolsPageSkeleton } from "@/8-2-pricing-tools/skeletons/PricingToolsPageSkeleton";
export { PromoSimulationPageSkeleton } from "@/8-2-promo-simulation/skeletons/PromoSimulationPageSkeleton";
export { DefaultPricesPageSkeleton } from "@/8-2-1-default-prices/skeletons/DefaultPricesPageSkeleton";
export { ConsultantLivechatRouteLoadingShell } from "@/shared/components/mobile/ConsultantLivechatRouteLoadingShell";
export { ConsultantLeadsManagementRouteLoadingShell } from "@/shared/components/mobile/ConsultantLeadsManagementRouteLoadingShell";
export { InstagramConnectPageSkeleton } from "@/5-3-whatsapp/skeletons/InstagramConnectPageSkeleton";
export { ConsultantCrmDashboardPageSkeleton } from "@/5-3-dashboard/skeletons/ConsultantCrmDashboardPageSkeleton";
export { OmnichannelSettingsPageSkeleton } from "@/5-3-dashboard/skeletons/OmnichannelSettingsPageSkeleton";
export { EmailConnectPageSkeleton } from "@/5-3-whatsapp/pages/EmailConnectPageSkeleton";
export { SalesActivitiesPageSkeleton } from "@/5-2-activities/skeletons/SalesActivitiesPageSkeleton";
export { VisitSchedulingPageSkeleton } from "@/5-2-jadwal-kunjungan";
export { ClientVisitsPageSkeleton } from "@/5-2-client_visits/skeletons/ClientVisitsPageSkeleton";
export { WhatsAppConnectPageSkeleton } from "@/5-3-whatsapp/skeletons/WhatsAppConnectPageSkeleton";
export { WhatsAppTemplatePageSkeleton } from "@/5-3-whatsapp-template/skeletons/WhatsAppTemplatePageSkeleton";
export { KolManagementRouteLoadingShell } from "@/6-2-1-dashboard/kol-management/components/KolManagementRouteLoadingShell";
export { KolManagementDashboardPageSkeleton } from "@/6-2-1-dashboard/kol-management/skeletons/KolManagementDashboardPageSkeleton";
export { KolManagementKolManagementPageSkeleton } from "@/6-2-1-dashboard/kol-management/skeletons/KolManagementKolManagementPageSkeleton";
export { KolManagementCampaignsPageSkeleton } from "@/6-2-1-dashboard/kol-management/skeletons/KolManagementCampaignsPageSkeleton";
export { KolManagementContentPostPageSkeleton } from "@/6-2-1-dashboard/kol-management/skeletons/KolManagementContentPostPageSkeleton";
export { KolManagementPaymentTermsPageSkeleton } from "@/6-2-1-dashboard/kol-management/skeletons/KolManagementPaymentTermsPageSkeleton";
export { SocialMediaShellSkeleton } from "@/6-1-dashboard/skeletons/SocialMediaShellSkeleton";
export { SocialMediaDashboardSkeleton } from "@/6-1-dashboard/skeletons/SocialMediaDashboardSkeleton";
export { ContentCalendarPageSkeleton } from "@/6-1-content-calendar/skeletons/ContentCalendarPageSkeleton";
export { ProductKnowledgePageSkeleton } from "@/6-1-product-knowledge/skeletons/ProductKnowledgePageSkeleton";
export { ScriptGeneratorPageSkeleton } from "@/6-1-script-generator/skeletons/ScriptGeneratorPageSkeleton";
export { SocialMediaSettingsPageSkeleton } from "@/6-1-social-media-settings/skeletons/SocialMediaSettingsPageSkeleton";
export { TrafficPageSkeleton } from "@/6-0-traffic/skeletons/TrafficPageSkeleton";

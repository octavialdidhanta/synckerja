import { lazy, Suspense, type ReactNode } from "react";
import { PageAccessGuard } from "@/shared/components/PageAccessGuard";
import {
  focusManager,
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/shared/components/ui/sonner";
import { Toaster } from "@/shared/components/ui/toaster";
import { TooltipProvider } from "@/shared/components/ui/tooltip";
import { RequireAuth } from "@/shared/components/RequireAuth";
import {
  MOBILE_INCOMES_BANK_ACCOUNT_PATH,
  MOBILE_INCOMES_DASHBOARD_PATH,
} from "@/mobile/3-dashboard/shared/mobileIncomesNavPaths";
import { MobileAppNavSuppressionProvider } from "@/shared/mobile/MobileAppNavSuppressionContext";
import { CapacitorKeyboardInsetProvider } from "@/shared/native/useCapacitorKeyboardInset";
import { NativeAppDisplayInit } from "@/shared/components/mobile/NativeAppDisplayInit";
import { NativeSafeAreaCssVarsInit } from "@/shared/hooks/useNativeSafeAreaCssVars";
import { NativeBootstrapSplashGate } from "@/shared/components/mobile/NativeBootstrapSplashGate";
import { NativeFcmRegistration } from "@/shared/native/NativeFcmRegistration";
import { ShareIntentRouteSync } from "@/shared/native/ShareIntentRouteSync";
import { NativeGoogleAuthInit } from "@/0-auth/native/NativeGoogleAuthInit";
import { NativeSupabaseOAuthBridge } from "@/0-auth/native/NativeSupabaseOAuthBridge";
import { NativeNotificationTapBridge } from "@/shared/native/NativeNotificationTapBridge";
import { AdaptiveAppLayout } from "@/shared/layouts";
import NotFound from "@/shared/pages/NotFound";
import { HomePageSkeleton } from "@/1-home/skeletons/HomePageSkeleton";
import { HomePageRouteLoadingShell } from "@/shared/components/mobile/HomePageRouteLoadingShell";
import { StandardRouteLoadingShell } from "@/shared/components/StandardRouteLoadingShell";
import {
  AccessPermissionsPageSkeleton,
  CalculatorPageSkeleton,
  ClientVisitsPageSkeleton,
  CompanyRouteSkeleton,
  ConsultantCrmDashboardPageSkeleton,
  ConsultantLivechatRouteLoadingShell,
  ContentCalendarPageSkeleton,
  DefaultPricesPageSkeleton,
  EmailConnectPageSkeleton,
  InstagramConnectPageSkeleton,
  KolManagementCampaignsPageSkeleton,
  KolManagementContentPostPageSkeleton,
  KolManagementDashboardPageSkeleton,
  KolManagementKolManagementPageSkeleton,
  KolManagementPaymentTermsPageSkeleton,
  KolManagementRouteLoadingShell,
  OmnichannelSettingsPageSkeleton,
  PasswordManagerPageSkeleton,
  PPh21PageSkeleton,
  PricingToolsPageSkeleton,
  ProductKnowledgePageSkeleton,
  PromoSimulationPageSkeleton,
  RecruitmentRouteSkeleton,
  RequestFormPageSkeleton,
  SalesActivitiesPageSkeleton,
  ScriptGeneratorPageSkeleton,
  SocialMediaDashboardSkeleton,
  SocialMediaSettingsPageSkeleton,
  SocialMediaShellSkeleton,
  TrafficPageSkeleton,
  GoogleAdsMetricsPageSkeleton,
  MetaAdsMetricsPageSkeleton,
  VisitSchedulingPageSkeleton,
  WhatsAppConnectPageSkeleton,
  WhatsAppTemplatePageSkeleton,
} from "@/appRouteSkeletonLoaders";

const PAGE_GUARD_LOADING_SHELL = <StandardRouteLoadingShell />;
import { DailyTaskProviderShell } from "@/shared/wrappers/DailyTaskProviderShell";
import {
  CustomerSurveyPublicFormPage,
  CustomerSurveyPublicThanksPage,
  SurveyPublicShell,
} from "@/features/customer-survey/public/SurveyPublicRoutes";
// Route elements are lazy-loaded below to keep the initial JS small.
import { SubscriptionExpiryGuard } from "@/10-subscription/shared/SubscriptionExpiryGuard";
import { SubscriptionRoleGuard } from "@/10-subscription/shared/SubscriptionRoleGuard";
import { OMNICHANNEL_SETTINGS_INDEX_REDIRECT_TO } from "@/5-3-dashboard/omnichannel-settings/constants/omnichannelSettingsSections";
import { AuthProvider } from "@/shared/auth/contexts/AuthContext";
import { LanguageProvider } from "@/shared/i18n/LanguageProvider";
import { CentralizedUserDataProvider } from "@/shared/auth/contexts/CentralizedUserDataContext";
import { CentralizedUserDataPathSync } from "@/shared/auth/contexts/CentralizedUserDataPathSync";
import { CurrentOrgProvider } from "@/shared/auth/contexts/CurrentOrgContext";
import { PermissionConfigurationProvider } from "@/shared/auth/page-access/usePermissionConfiguration";
import { HrManagementRoleGuard } from "@/shared/components/HrManagementRoleGuard";
import { useAuthSurface } from "@/shared/hooks/useAuthSurface";
const RecruitmentSuspense = ({ children }: { children: ReactNode }) => (
  <Suspense
    fallback={
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col" aria-busy>
        <RecruitmentRouteSkeleton />
      </div>
    }
  >
    {children}
  </Suspense>
);

const RecruitmentCandidateProfileHr = lazy(
  () => import("@/2-2-recruitment-dashboard/interviewees/CandidateProfile"),
);

const AccessPermissionsConfig = lazy(
  () =>
    import("@/2-9-PageAccess/pages/AccessPermissionsPage").then((m) => ({
      default: m.AccessPermissionsConfig,
    })),
);
const AccessPermissionsSuspense = ({ children }: { children: ReactNode }) => (
  <Suspense
    fallback={<AccessPermissionsPageSkeleton />}
  >
    {children}
  </Suspense>
);

const CompanyDashboardPage = lazy(() => import("@/2-8-dashboard/pages/CompanyDashboardPage"));

const RequestFormPurchasePage = lazy(() => import("@/9-request-form/pages/Purchase/Purchase"));
const RequestFormReimbursementPage = lazy(() => import("@/9-request-form/pages/Reimbursement/Reimbursement"));
const RequestFormCashAdvancePage = lazy(() => import("@/9-request-form/pages/CashAdvance/CashAdvance"));
const RequestFormLoanPage = lazy(() => import("@/9-request-form/pages/Loan/Loan"));

const DailyTaskReportPage = lazy(() => import("@/8-2-DailyTaskReport/pages/DailyTaskReportPage"));
const PasswordManagerPage = lazy(() => import("@/8-PasswordManager/pages/PasswordManagerPage"));
const PPh21CalculatorPage = lazy(() => import("@/8-4-pph-21/pages/PPh21CalculatorPage"));
const DefaultPricesPage = lazy(() => import("@/8-2-1-default-prices/pages/DefaultPricesPage"));
const CalculatorServicesPage = lazy(() => import("@/8-3-calculator/pages/CalculatorServicesPage"));
const CalculatorSalesPage = lazy(() => import("@/8-3-calculator/pages/CalculatorSalesPage"));
const PricingToolsPage = lazy(() => import("@/8-2-pricing-tools/pages/PricingToolsPage"));
const PromoSimulationPage = lazy(() => import("@/8-2-promo-simulation/pages/PromoSimulationPage"));
const KolManagementDashboardPage = lazy(
  () =>
    import("@/6-2-1-dashboard/kol-management/pages/KolManagementDashboardPage"),
);

const SocialMediaDashboardPage = lazy(() => import("@/6-1-dashboard/pages/SocialMediaDashboardPage"));
const SocialMediaContentCalendarPage = lazy(() => import("@/6-1-content-calendar/ContentCalendarPage"));
const SocialMediaProductKnowledgePage = lazy(() => import("@/6-1-product-knowledge/ProductKnowledgePage"));
const SocialMediaScriptGeneratorPage = lazy(() => import("@/6-1-script-generator/ScriptGeneratorPage"));
const SocialMediaDmSettingsPage = lazy(() => import("@/6-1-social-media-settings/SettingsPage"));
const TrafficPage = lazy(() => import("@/6-0-traffic/pages/TrafficPage"));
const GoogleAdsMetricsPage = lazy(() => import("@/6-0-google-ads/pages/GoogleAdsMetricsPage"));
const MetaAdsMetricsPage = lazy(() => import("@/6-0-meta-ads/pages/MetaAdsMetricsPage"));
const MobileWebTrafficPage = lazy(() => import("@/mobile/6-0-web-traffic/pages/MobileWebTrafficPage"));
const MobileWebTrafficPageSkeleton = lazy(
  () => import("@/mobile/6-0-web-traffic/pages/MobileWebTrafficPageSkeleton"),
);
const ReviewRouteGate = lazy(() =>
  import("@/6-1-dashboard/routes/ReviewRouteGate").then((m) => ({ default: m.ReviewRouteGate })),
);

const CRMDashboardPage = lazy(() =>
  import("@/5-3-dashboard/pages/CRMDashboardPage").then((m) => ({ default: m.CRMDashboardPage })),
);
const OmnichannelSettingsPage = lazy(() =>
  import("@/5-3-dashboard/pages/OmnichannelSettingsPage").then((m) => ({ default: m.OmnichannelSettingsPage })),
);
const SalesOperationsPage = lazy(() =>
  import("@/5-2-activities/pages/SalesOperationsPage").then((m) => ({ default: m.SalesOperationsPage })),
);
const WhatsAppConnectPage = lazy(() =>
  import("@/5-3-whatsapp/pages/WhatsAppConnectPage").then((m) => ({ default: m.WhatsAppConnectPage })),
);
const InstagramConnectPage = lazy(() =>
  import("@/5-3-whatsapp/pages/InstagramConnectPage").then((m) => ({
    default: m.InstagramConnectPage,
  })),
);
const EmailConnectPage = lazy(() =>
  import("@/5-3-whatsapp/pages/EmailConnectPage").then((m) => ({ default: m.EmailConnectPage })),
);
const WhatsAppTemplatePage = lazy(() =>
  import("@/5-3-whatsapp-template/pages/WhatsAppTemplatePage").then((m) => ({ default: m.WhatsAppTemplatePage })),
);
const WhatsAppRecipientListsPage = lazy(() =>
  import("@/5-3-whatsapp-template/pages/WhatsAppRecipientListsPage").then((m) => ({
    default: m.WhatsAppRecipientListsPage,
  })),
);
const WhatsAppRecipientListDetailPage = lazy(() =>
  import("@/5-3-whatsapp-template/pages/WhatsAppRecipientListDetailPage").then((m) => ({
    default: m.WhatsAppRecipientListDetailPage,
  })),
);
const WhatsAppCampaignPage = lazy(() =>
  import("@/5-3-whatsapp-template/pages/WhatsAppCampaignPage").then((m) => ({
    default: m.WhatsAppCampaignPage,
  })),
);

// Keep initial bundle small: lazy-load large desktop modules/pages.
import { OkrRouteElement } from "@/1-OKR/OkrRouteElement";
import { OkrRouteAccessLoadingShell } from "@/1-OKR/components/OkrRouteAccessLoadingShell";
const SettingsPage = lazy(() => import("@/1-home").then((m) => ({ default: m.SettingsPage })));
const TransferOwnershipPage = lazy(() =>
  import("@/1-home").then((m) => ({ default: m.TransferOwnershipPage })),
);
const SecuritySettings = lazy(() => import("@/1-home/settings").then((m) => ({ default: m.SecuritySettings })));

const PrivacyPolicyPage = lazy(() => import("@/policy").then((m) => ({ default: m.PrivacyPolicyPage })));
const TermsOfServicePage = lazy(() => import("@/policy").then((m) => ({ default: m.TermsOfServicePage })));
const AccountDeletionPage = lazy(() => import("@/policy").then((m) => ({ default: m.AccountDeletionPage })));

const EmployeePage = lazy(() => import("@/2-1-employees/EmployeePage"));
const ReprimandManagementPage = lazy(() => import("@/2-1-reprimand").then((m) => ({ default: m.ReprimandManagementPage })));
const AddEmployeePage = lazy(() => import("@/2-1-employees/add-employee/AddEmployeePage"));
const EmployeePersonalInfo = lazy(() => import("@/2-1-employees/MyInfo/PersonalInformation/pages/EmployeePersonalInfo"));
const EmployeeAddressInfo = lazy(() => import("@/2-1-employees/MyInfo/AddressInformation/pages/EmployeeAddressInfo"));
const EmployeeEmploymentInfo = lazy(() => import("@/2-1-employees/MyInfo/Employment/pages/EmployeeEmploymentInfo"));
const EmployeeEducationFormal = lazy(() => import("@/2-1-employees/MyInfo/Education/pages/EmployeeEducationFormal"));
const EmployeeEducationInformal = lazy(
  () => import("@/2-1-employees/MyInfo/InformalEducation/pages/EmployeeEducationInformal"),
);
const EmployeeWork = lazy(() => import("@/2-1-employees/MyInfo/WorkExperience/pages/EmployeeWork"));
const EmployeeFamily = lazy(() => import("@/2-1-employees/MyInfo/FamilyMembers/pages/EmployeeFamily"));
const EmployeeAttendance = lazy(() => import("@/2-1-employees/MyInfo/Attendance/pages/EmployeeAttendance"));
const EmployeeLeavePermit = lazy(() => import("@/2-1-employees/MyInfo/LeavePermit/pages/EmployeeLeavePermit"));
const EmployeeDocuments = lazy(() => import("@/2-1-employees/MyInfo/Documents/pages/EmployeeDocuments"));
const EmployeePayroll = lazy(() => import("@/2-1-employees/MyInfo/Payroll/pages/EmployeePayroll"));

const RecruitmentApplicationsPageWrapper = lazy(() =>
  import("@/2-2-recruitment-dashboard").then((m) => ({ default: m.ApplicationsPageWrapper })),
);
const RecruitmentDashboardOverviewPage = lazy(() =>
  import("@/2-2-recruitment-dashboard").then((m) => ({ default: m.DashboardOverview })),
);
const RecruitmentIntervieweesPage = lazy(() =>
  import("@/2-2-recruitment-dashboard").then((m) => ({ default: m.IntervieweesPage })),
);
const RecruitmentJobOpeningsPage = lazy(() =>
  import("@/2-2-recruitment-dashboard").then((m) => ({ default: m.JobOpeningsPage })),
);

const AttendancePage = lazy(() => import("@/2-3-attendance/AttendancePage").then((m) => ({ default: m.AttendancePage })));
const PayrollCalculationsPage = lazy(() => import("@/2-4-payroll/pages/PayrollCalculationsPageWrapper"));
const MyPayslipsPage = lazy(() => import("@/2-4-payroll/pages/MyPayslipsPage"));
const CompanyCompanyAssetsPage = lazy(() => import("@/2-8-company-assets/pages/CompanyCompanyAssetsPage"));
const CompanyFilesPage = lazy(() => import("@/2-8-files/pages/CompanyFilesPage"));
const CompanyOrganizationPage = lazy(() => import("@/2-8-organization/pages/CompanyOrganizationPage"));

const LoginRouteElement = lazy(() =>
  import("@/shared/components/mobile/authOnboardingRouteElements").then((m) => ({ default: m.LoginRouteElement })),
);
const GoogleOAuthCallbackRouteElement = lazy(() =>
  import("@/shared/components/mobile/authOnboardingRouteElements").then((m) => ({
    default: m.GoogleOAuthCallbackRouteElement,
  })),
);
const MetaOAuthCallbackRouteElement = lazy(() =>
  import("@/5-3-whatsapp/pages/MetaOAuthCallbackPage").then((m) => ({
    default: m.MetaOAuthCallbackPage,
  })),
);
const SupabaseSsoCallbackRouteElement = lazy(() =>
  import("@/shared/components/mobile/authOnboardingRouteElements").then((m) => ({
    default: m.SupabaseSsoCallbackRouteElement,
  })),
);
const ForgotPasswordRouteElement = lazy(() =>
  import("@/shared/components/mobile/authOnboardingRouteElements").then((m) => ({
    default: m.ForgotPasswordRouteElement,
  })),
);
const ResetPasswordRouteElement = lazy(() =>
  import("@/shared/components/mobile/authOnboardingRouteElements").then((m) => ({
    default: m.ResetPasswordRouteElement,
  })),
);
const RegisterRouteElement = lazy(() =>
  import("@/shared/components/mobile/authOnboardingRouteElements").then((m) => ({ default: m.RegisterRouteElement })),
);
const VerifyEmailRouteElement = lazy(() =>
  import("@/shared/components/mobile/authOnboardingRouteElements").then((m) => ({ default: m.VerifyEmailRouteElement })),
);
const EmailVerifiedRouteElement = lazy(() =>
  import("@/shared/components/mobile/authOnboardingRouteElements").then((m) => ({ default: m.EmailVerifiedRouteElement })),
);
const TermsAndConditionsRouteElement = lazy(() =>
  import("@/shared/components/mobile/authOnboardingRouteElements").then((m) => ({
    default: m.TermsAndConditionsRouteElement,
  })),
);
const CreateOrganizationRouteElement = lazy(() =>
  import("@/shared/components/mobile/authOnboardingRouteElements").then((m) => ({
    default: m.CreateOrganizationRouteElement,
  })),
);
const CreatePlanRouteElement = lazy(() =>
  import("@/shared/components/mobile/authOnboardingRouteElements").then((m) => ({ default: m.CreatePlanRouteElement })),
);
const EmployeeWelcomeRouteElement = lazy(() =>
  import("@/shared/components/mobile/authOnboardingRouteElements").then((m) => ({
    default: m.EmployeeWelcomeRouteElement,
  })),
);

const HomeRouteElement = lazy(() =>
  import("@/shared/components/mobile/mainAppMobileRouteElements").then((m) => ({ default: m.HomeRouteElement })),
);
const ProfileRouteElement = lazy(() =>
  import("@/shared/components/mobile/mainAppMobileRouteElements").then((m) => ({ default: m.ProfileRouteElement })),
);
const ScheduleRouteElement = lazy(() =>
  import("@/shared/components/mobile/mainAppMobileRouteElements").then((m) => ({ default: m.ScheduleRouteElement })),
);
const ClientVisitRouteElement = lazy(() =>
  import("@/shared/components/mobile/mainAppMobileRouteElements").then((m) => ({ default: m.ClientVisitRouteElement })),
);
const MobileAttendanceReportsRouteElement = lazy(() =>
  import("@/shared/components/mobile/mainAppMobileRouteElements").then((m) => ({
    default: m.MobileAttendanceReportsRouteElement,
  })),
);
const ProfileTabRouteElement = lazy(() =>
  import("@/shared/components/mobile/mainAppMobileRouteElements").then((m) => ({ default: m.ProfileTabRouteElement })),
);

const ExpensesDashboardRouteElement = lazy(() =>
  import("@/shared/components/mobile/expensesMobileRouteElements").then((m) => ({ default: m.ExpensesDashboardRouteElement })),
);
const ExpensesDebtRouteElement = lazy(() =>
  import("@/shared/components/mobile/expensesMobileRouteElements").then((m) => ({ default: m.ExpensesDebtRouteElement })),
);
const ExpensesApprovalsRouteElement = lazy(() =>
  import("@/shared/components/mobile/expensesMobileRouteElements").then((m) => ({ default: m.ExpensesApprovalsRouteElement })),
);
const ExpensesPaymentProcessRouteElement = lazy(() =>
  import("@/shared/components/mobile/expensesMobileRouteElements").then((m) => ({
    default: m.ExpensesPaymentProcessRouteElement,
  })),
);
const ExpensesReminderBillsRouteElement = lazy(() =>
  import("@/shared/components/mobile/expensesMobileRouteElements").then((m) => ({
    default: m.ExpensesReminderBillsRouteElement,
  })),
);

const IncomeDashboardRouteElement = lazy(() =>
  import("@/shared/components/mobile/incomesMobileRouteElements").then((m) => ({ default: m.IncomeDashboardRouteElement })),
);
const IncomeTransactionRouteElement = lazy(() =>
  import("@/shared/components/mobile/incomesMobileRouteElements").then((m) => ({
    default: m.IncomeTransactionRouteElement,
  })),
);
const IncomeBankAccountRouteElement = lazy(() =>
  import("@/shared/components/mobile/incomesMobileRouteElements").then((m) => ({
    default: m.IncomeBankAccountRouteElement,
  })),
);
const IncomePiutangRouteElement = lazy(() =>
  import("@/shared/components/mobile/incomesMobileRouteElements").then((m) => ({
    default: m.IncomePiutangRouteElement,
  })),
);

const HabitTrackerRouteElement = lazy(() =>
  import("@/shared/components/mobile/habitTrackerRouteElement").then((m) => ({ default: m.HabitTrackerRouteElement })),
);
const DailyTaskRouteElement = lazy(() =>
  import("@/shared/components/mobile/dailyTaskRouteElement").then((m) => ({ default: m.DailyTaskRouteElement })),
);
const MeetingNotesRouteElement = lazy(() =>
  import("@/shared/components/mobile/meetingNotesRouteElement").then((m) => ({ default: m.MeetingNotesRouteElement })),
);
const ConsultantLivechatRouteElement = lazy(() =>
  import("@/shared/components/mobile/consultantLivechatRouteElement").then((m) => ({
    default: m.ConsultantLivechatRouteElement,
  })),
);
const WhatsAppTemplateFollowupsPage = lazy(() =>
  import("@/5-3-whatsapp/pages/WhatsAppTemplateFollowupsPage").then((m) => ({
    default: m.WhatsAppTemplateFollowupsPage,
  })),
);
const ConsultantLeadsManagementRouteElement = lazy(() =>
  import("@/shared/components/mobile/consultantLeadsManagementRouteElement").then((m) => ({
    default: m.ConsultantLeadsManagementRouteElement,
  })),
);

const SubscriptionOverviewRouteElement = lazy(() =>
  import("@/shared/components/mobile/subscriptionMobileRouteElements").then((m) => ({
    default: m.SubscriptionOverviewRouteElement,
  })),
);
const SubscriptionPlansRouteElement = lazy(() =>
  import("@/shared/components/mobile/subscriptionMobileRouteElements").then((m) => ({
    default: m.SubscriptionPlansRouteElement,
  })),
);
const SubscriptionManagementRouteElement = lazy(() =>
  import("@/shared/components/mobile/subscriptionMobileRouteElements").then((m) => ({
    default: m.SubscriptionManagementRouteElement,
  })),
);

const DailyTaskReportRouteElement = lazy(() =>
  import("@/shared/components/mobile/dailyTaskReportRouteElement").then((m) => ({
    default: m.DailyTaskReportRouteElement,
  })),
);
const FirstLoginRouteElement = lazy(() =>
  import("@/2-1-employees/employee-invitation/FirstLogin").then((m) => ({
    default: m.default,
  })),
);
const ShareReceiptValidationRouteElement = lazy(() =>
  import("@/shared/components/mobile/shareReceiptValidationRouteElement").then((m) => ({
    default: m.ShareReceiptValidationRouteElement,
  })),
);

function AppRoutes() {
  const location = useLocation();
  const pathname = location.pathname || "/";
  const isHome = pathname === "/";

  const fallback = isHome ? (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-gray-100" aria-busy>
      <HomePageRouteLoadingShell />
      <span className="sr-only">Loading</span>
    </div>
  ) : (
    <div className="flex min-h-[40vh] flex-1 items-center justify-center bg-gray-50" aria-busy>
      <span className="sr-only">Loading</span>
    </div>
  );

  return (
    <Suspense fallback={fallback}>
      <Routes>
        <Route path="/login" element={<LoginRouteElement />} />
        <Route path="/first-login" element={<FirstLoginRouteElement />} />
        <Route path="/auth/google/callback" element={<GoogleOAuthCallbackRouteElement />} />
        <Route path="/auth/meta/callback" element={<MetaOAuthCallbackRouteElement />} />
        <Route path="/auth/sso/callback" element={<SupabaseSsoCallbackRouteElement />} />
        <Route
          path="/operations/instagram-connect"
          element={<Navigate to="/omnichannel/integrations/instagram" replace />}
        />
        <Route path="/forgot-password" element={<ForgotPasswordRouteElement />} />
        <Route path="/reset-password" element={<ResetPasswordRouteElement />} />
        <Route path="/register" element={<RegisterRouteElement />} />
        <Route path="/verify-email" element={<VerifyEmailRouteElement />} />
        <Route path="/email-verified" element={<EmailVerifiedRouteElement />} />
        <Route path="/terms-and-conditions" element={<TermsAndConditionsRouteElement />} />
        <Route path="/policy/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/policy/terms" element={<TermsOfServicePage />} />
        <Route path="/policy/account-deletion" element={<AccountDeletionPage />} />

        <Route
          path="/candidate/apply"
          element={
            <RecruitmentSuspense>
              <PublicJobApplication />
            </RecruitmentSuspense>
          }
        />
        <Route
          path="/apply/thank-you"
          element={
            <RecruitmentSuspense>
              <PublicApplicationThankYou />
            </RecruitmentSuspense>
          }
        />
        <Route
          path="/apply/preview/:token"
          element={
            <RecruitmentSuspense>
              <PublicJobPreview />
            </RecruitmentSuspense>
          }
        />
        <Route
          path="/candidate/profile/thank-you"
          element={
            <RecruitmentSuspense>
              <PublicCandidateProfileThankYou />
            </RecruitmentSuspense>
          }
        />
        <Route
          path="/candidate/profile"
          element={
            <RecruitmentSuspense>
              <PublicCandidateProfile />
            </RecruitmentSuspense>
          }
        />
        <Route
          path="/review/:token"
          element={
            <Suspense
              fallback={
                <div className="flex min-h-[40vh] flex-1 items-center justify-center bg-gray-50" aria-busy>
                  <span className="sr-only">Loading</span>
                </div>
              }
            >
              <ReviewRouteGate />
            </Suspense>
          }
        />

        <Route element={<RequireAuth />}>
          <Route element={<SubscriptionExpiryGuard />}>
            <Route element={<AdaptiveAppLayout />}>
              <Route
                path="/"
                element={
                  <PageAccessGuard
                    pagePath="/"
                    loadingShell={<HomePageRouteLoadingShell />}
                    loadingShellWrapperClassName="bg-gray-100"
                  >
                    <HomeRouteElement />
                  </PageAccessGuard>
                }
              />
              <Route
                path="/schedule"
                element={
                  <PageAccessGuard
                    pagePath="/operations/sales"
                    loadingShell={PAGE_GUARD_LOADING_SHELL}
                    loadingShellWrapperClassName="bg-surface-muted overflow-hidden"
                  >
                    <ScheduleRouteElement />
                  </PageAccessGuard>
                }
              />
              <Route
                path="/client-visit"
                element={
                  <PageAccessGuard
                    pagePath="/operations/sales"
                    loadingShell={PAGE_GUARD_LOADING_SHELL}
                    loadingShellWrapperClassName="bg-surface-muted overflow-hidden"
                  >
                    <ClientVisitRouteElement />
                  </PageAccessGuard>
                }
              />
              <Route
                path="/reports"
                element={
                  <PageAccessGuard requiresPermissions={false} loadingShell={PAGE_GUARD_LOADING_SHELL}>
                    <MobileAttendanceReportsRouteElement />
                  </PageAccessGuard>
                }
              />
              <Route
                path="/profile/payslips"
                element={
                  <PageAccessGuard pagePath="/settings" requiresPermissions={false} loadingShell={<HomePageSkeleton />}>
                    <MyPayslipsPage />
                  </PageAccessGuard>
                }
              />
              <Route
                path="/profile"
                element={
                  <PageAccessGuard pagePath="/settings" requiresPermissions={false} loadingShell={<HomePageSkeleton />}>
                    <ProfileTabRouteElement />
                  </PageAccessGuard>
                }
              />
              <Route
                path="/share/receipt-validation"
                element={
                  <PageAccessGuard requiresPermissions={false}>
                    <ShareReceiptValidationRouteElement />
                  </PageAccessGuard>
                }
              />
              <Route path="/settings" element={<SettingsPage />}>
                <Route index element={<ProfileRouteElement />} />
                <Route path="profile" element={<ProfileRouteElement />} />
                <Route path="security" element={<SecuritySettings />} />
              </Route>
              <Route path="/transfer-ownership" element={<TransferOwnershipPage />} />
              <Route path="/okr" element={<Navigate to="/okr/company-objective" replace />} />
              <Route
                path="/okr/*"
                element={
                  <PageAccessGuard
                    loadingShell={<OkrRouteAccessLoadingShell />}
                    loadingShellWrapperClassName="bg-gray-100 dark:bg-muted/30"
                  >
                    <OkrRouteElement />
                  </PageAccessGuard>
                }
              />
              <Route
                path="/employees"
                element={
                  <PageAccessGuard
                    pagePath="/employees"
                    loadingShell={PAGE_GUARD_LOADING_SHELL}
                    loadingShellWrapperClassName="bg-gray-100"
                  >
                    <EmployeePage />
                  </PageAccessGuard>
                }
              />
              <Route
                path="/employees/reprimand"
                element={
                  <PageAccessGuard
                    pagePath="/employees/reprimand"
                    loadingShell={PAGE_GUARD_LOADING_SHELL}
                    loadingShellWrapperClassName="bg-gray-100"
                  >
                    <HrManagementRoleGuard showPendingSkeleton={false}>
                      <ReprimandManagementPage />
                    </HrManagementRoleGuard>
                  </PageAccessGuard>
                }
              />
              <Route path="/my-info/personal" element={<EmployeePersonalInfo />} />
              <Route path="/my-info/address" element={<EmployeeAddressInfo />} />
              <Route path="/my-info/employment" element={<EmployeeEmploymentInfo />} />
              <Route path="/my-info/education/formal" element={<EmployeeEducationFormal />} />
              <Route path="/my-info/education/informal" element={<EmployeeEducationInformal />} />
              <Route path="/my-info/work" element={<EmployeeWork />} />
              <Route path="/my-info/family" element={<EmployeeFamily />} />
              <Route path="/my-info/attendance" element={<EmployeeAttendance />} />
              <Route path="/my-info/leave-permit" element={<EmployeeLeavePermit />} />
              <Route path="/my-info/documents" element={<EmployeeDocuments />} />
              <Route path="/my-info/payroll" element={<EmployeePayroll />} />
              <Route
                path="/attendance"
                element={
                  <PageAccessGuard loadingShell={PAGE_GUARD_LOADING_SHELL}>
                    <AttendancePage />
                  </PageAccessGuard>
                }
              />
              <Route
                path="/attendance/attendance"
                element={
                  <PageAccessGuard loadingShell={PAGE_GUARD_LOADING_SHELL}>
                    <AttendancePage />
                  </PageAccessGuard>
                }
              />
              <Route
                path="/attendance/settings"
                element={
                  <PageAccessGuard loadingShell={PAGE_GUARD_LOADING_SHELL}>
                    <AttendancePage />
                  </PageAccessGuard>
                }
              />
              <Route
                path="/access-permissions"
                element={
                  <PageAccessGuard
                    pagePath="/access-permissions"
                    loadingShell={PAGE_GUARD_LOADING_SHELL}
                    loadingShellWrapperClassName="bg-background"
                  >
                    <AccessPermissionsSuspense>
                      <AccessPermissionsConfig />
                    </AccessPermissionsSuspense>
                  </PageAccessGuard>
                }
              />
              <Route
                path="/access-permissions/page-access"
                element={
                  <PageAccessGuard
                    pagePath="/access-permissions/page-access"
                    loadingShell={PAGE_GUARD_LOADING_SHELL}
                    loadingShellWrapperClassName="bg-background"
                  >
                    <AccessPermissionsSuspense>
                      <AccessPermissionsConfig />
                    </AccessPermissionsSuspense>
                  </PageAccessGuard>
                }
              />
              <Route
                path="/access-permissions/overview"
                element={
                  <PageAccessGuard
                    pagePath="/access-permissions/overview"
                    loadingShell={PAGE_GUARD_LOADING_SHELL}
                    loadingShellWrapperClassName="bg-background"
                  >
                    <AccessPermissionsSuspense>
                      <AccessPermissionsConfig />
                    </AccessPermissionsSuspense>
                  </PageAccessGuard>
                }
              />
              <Route
                path="/access-permissions/roles"
                element={
                  <PageAccessGuard
                    pagePath="/access-permissions/roles"
                    loadingShell={PAGE_GUARD_LOADING_SHELL}
                    loadingShellWrapperClassName="bg-background"
                  >
                    <AccessPermissionsSuspense>
                      <AccessPermissionsConfig />
                    </AccessPermissionsSuspense>
                  </PageAccessGuard>
                }
              />
              <Route
                path="/access-permissions/pages"
                element={
                  <PageAccessGuard
                    pagePath="/access-permissions/pages"
                    loadingShell={PAGE_GUARD_LOADING_SHELL}
                    loadingShellWrapperClassName="bg-background"
                  >
                    <AccessPermissionsSuspense>
                      <AccessPermissionsConfig />
                    </AccessPermissionsSuspense>
                  </PageAccessGuard>
                }
              />
              <Route
                path="/payroll/calculations"
                element={
                  <PageAccessGuard loadingShell={PAGE_GUARD_LOADING_SHELL}>
                    <PayrollCalculationsPage />
                  </PageAccessGuard>
                }
              />
              <Route
                path="/company/dashboard"
                element={
                  <PageAccessGuard>
                    <CompanySuspense>
                      <CompanyDashboardPage />
                    </CompanySuspense>
                  </PageAccessGuard>
                }
              />
              <Route
                path="/company/company-assets"
                element={
                  <PageAccessGuard loadingShell={PAGE_GUARD_LOADING_SHELL}>
                    <CompanyCompanyAssetsPage />
                  </PageAccessGuard>
                }
              />
              <Route
                path="/company/files"
                element={
                  <PageAccessGuard loadingShell={PAGE_GUARD_LOADING_SHELL}>
                    <CompanyFilesPage />
                  </PageAccessGuard>
                }
              />
              <Route
                path="/company/organization"
                element={
                  <PageAccessGuard
                    pagePath="/company/organization"
                    loadingShell={PAGE_GUARD_LOADING_SHELL}
                  >
                    <CompanyOrganizationPage />
                  </PageAccessGuard>
                }
              />
              <Route path="/incomes" element={<Navigate to={MOBILE_INCOMES_DASHBOARD_PATH} replace />} />
              <Route
                path="/incomes/dashboard"
                element={
                  <PageAccessGuard pagePath="/incomes/dashboard" loadingShell={PAGE_GUARD_LOADING_SHELL}>
                    <IncomeDashboardRouteElement />
                  </PageAccessGuard>
                }
              />
              <Route
                path="/incomes/transaction/bank-account"
                element={
                  <PageAccessGuard pagePath="/incomes/transaction" loadingShell={PAGE_GUARD_LOADING_SHELL}>
                    <IncomeBankAccountRouteElement />
                  </PageAccessGuard>
                }
              />
              <Route
                path="/incomes/transaction"
                element={
                  <PageAccessGuard pagePath="/incomes/transaction" loadingShell={PAGE_GUARD_LOADING_SHELL}>
                    <IncomeTransactionRouteElement />
                  </PageAccessGuard>
                }
              />
              <Route
                path="/incomes/piutang"
                element={
                  <PageAccessGuard pagePath="/incomes/transaction" loadingShell={PAGE_GUARD_LOADING_SHELL}>
                    <IncomePiutangRouteElement />
                  </PageAccessGuard>
                }
              />
              <Route path="/incomes/bank-accounts" element={<Navigate to={MOBILE_INCOMES_BANK_ACCOUNT_PATH} replace />} />
              <Route path="/expenses" element={<Navigate to="/expenses/dashboard" replace />} />
              <Route
                path="/expenses/dashboard"
                element={
                  <PageAccessGuard pagePath="/expenses/dashboard" loadingShell={PAGE_GUARD_LOADING_SHELL}>
                    <ExpensesDashboardRouteElement />
                  </PageAccessGuard>
                }
              />
              <Route
                path="/expenses/debt"
                element={
                  <PageAccessGuard pagePath="/expenses/debt" loadingShell={PAGE_GUARD_LOADING_SHELL}>
                    <ExpensesDebtRouteElement />
                  </PageAccessGuard>
                }
              />
              <Route
                path="/expenses/approvals"
                element={
                  <PageAccessGuard pagePath="/expenses/approvals" loadingShell={PAGE_GUARD_LOADING_SHELL}>
                    <ExpensesApprovalsRouteElement />
                  </PageAccessGuard>
                }
              />
              <Route
                path="/expenses/payment-process"
                element={
                  <PageAccessGuard pagePath="/expenses/payment-process" loadingShell={PAGE_GUARD_LOADING_SHELL}>
                    <ExpensesPaymentProcessRouteElement />
                  </PageAccessGuard>
                }
              />
              <Route
                path="/expenses/reminder-bills"
                element={
                  <PageAccessGuard pagePath="/expenses/reminder-bills" loadingShell={PAGE_GUARD_LOADING_SHELL}>
                    <ExpensesReminderBillsRouteElement />
                  </PageAccessGuard>
                }
              />
              <Route path="/request-form" element={<Navigate to="/request-form/purchase" replace />} />
              <Route
                path="/request-form/purchase"
                element={
                  <RequestFormSuspense>
                    <RequestFormPurchasePage />
                  </RequestFormSuspense>
                }
              />
              <Route
                path="/request-form/reimbursement"
                element={
                  <RequestFormSuspense>
                    <RequestFormReimbursementPage />
                  </RequestFormSuspense>
                }
              />
              <Route
                path="/request-form/cash-advance"
                element={
                  <RequestFormSuspense>
                    <RequestFormCashAdvancePage />
                  </RequestFormSuspense>
                }
              />
              <Route
                path="/request-form/loan"
                element={
                  <RequestFormSuspense>
                    <RequestFormLoanPage />
                  </RequestFormSuspense>
                }
              />
              <Route
                path="/tools/daily-task"
                element={
                  <PageAccessGuard pagePath="/tools/daily-task" loadingShell={PAGE_GUARD_LOADING_SHELL}>
                    <DailyTaskRouteElement />
                  </PageAccessGuard>
                }
              />
              <Route
                path="/tools/daily-task-report"
                element={
                  <PageAccessGuard pagePath="/tools/daily-task-report" loadingShell={PAGE_GUARD_LOADING_SHELL}>
                    <DailyTaskReportRouteElement />
                  </PageAccessGuard>
                }
              />
              <Route
                path="/tools/meeting-notes"
                element={
                  <PageAccessGuard pagePath="/tools/meeting-notes" loadingShell={PAGE_GUARD_LOADING_SHELL}>
                    <MeetingNotesRouteElement />
                  </PageAccessGuard>
                }
              />
              <Route
                path="/tools/habits-tracker"
                element={
                  <PageAccessGuard pagePath="/tools/habits-tracker" loadingShell={PAGE_GUARD_LOADING_SHELL}>
                    <HabitTrackerRouteElement />
                  </PageAccessGuard>
                }
              />
              <Route
                path="/tools/password-manager"
                element={
                  <PageAccessGuard pagePath="/tools/password-manager" loadingShell={PAGE_GUARD_LOADING_SHELL}>
                    <PasswordManagerSuspense>
                      <PasswordManagerPage />
                    </PasswordManagerSuspense>
                  </PageAccessGuard>
                }
              />
              <Route
                path="/tools/pph21-calculator"
                element={
                  <PageAccessGuard pagePath="/tools/pph21-calculator" loadingShell={PAGE_GUARD_LOADING_SHELL}>
                    <PPh21CalculatorSuspense>
                      <PPh21CalculatorPage />
                    </PPh21CalculatorSuspense>
                  </PageAccessGuard>
                }
              />
              <Route
                path="/tools/default-prices"
                element={
                  <PageAccessGuard pagePath="/tools/default-prices" loadingShell={PAGE_GUARD_LOADING_SHELL}>
                    <DefaultPricesSuspense>
                      <DefaultPricesPage />
                    </DefaultPricesSuspense>
                  </PageAccessGuard>
                }
              />
              <Route
                path="/tools/pricing-tools"
                element={
                  <PageAccessGuard pagePath="/tools/pricing-tools" loadingShell={PAGE_GUARD_LOADING_SHELL}>
                    <PricingToolsSuspense>
                      <PricingToolsPage />
                    </PricingToolsSuspense>
                  </PageAccessGuard>
                }
              />
              <Route
                path="/tools/promo-simulation"
                element={
                  <PageAccessGuard pagePath="/tools/promo-simulation" loadingShell={PAGE_GUARD_LOADING_SHELL}>
                    <PromoSimulationSuspense>
                      <PromoSimulationPage />
                    </PromoSimulationSuspense>
                  </PageAccessGuard>
                }
              />
              <Route path="/tools/calculator" element={<Navigate to="/tools/calculator/services" replace />} />
              <Route
                path="/tools/calculator/services"
                element={
                  <PageAccessGuard pagePath="/tools/calculator" loadingShell={PAGE_GUARD_LOADING_SHELL}>
                    <CalculatorSuspense>
                      <CalculatorServicesPage />
                    </CalculatorSuspense>
                  </PageAccessGuard>
                }
              />
              <Route
                path="/tools/calculator/sales"
                element={
                  <PageAccessGuard pagePath="/tools/calculator" loadingShell={PAGE_GUARD_LOADING_SHELL}>
                    <CalculatorSuspense>
                      <CalculatorSalesPage />
                    </CalculatorSuspense>
                  </PageAccessGuard>
                }
              />
              <Route
                path="/omnichannel/settings"
                element={<Navigate to={OMNICHANNEL_SETTINGS_INDEX_REDIRECT_TO} replace />}
              />
              <Route
                path="/omnichannel/settings/:section"
                element={
                  <PageAccessGuard
                    pagePath="/omnichannel/settings"
                    loadingShell={PAGE_GUARD_LOADING_SHELL}
                    loadingShellWrapperClassName="bg-surface-muted overflow-hidden"
                  >
                    <OmnichannelSettingsSuspense>
                      <OmnichannelSettingsPage />
                    </OmnichannelSettingsSuspense>
                  </PageAccessGuard>
                }
              />
              <Route path="/operations/customer-service/dashboard" element={<Navigate to="/omnichannel/leads" replace />} />
              <Route path="/operations/customer-service/tickets" element={<Navigate to="/omnichannel/leads" replace />} />
              <Route path="/operations/customer-service" element={<Navigate to="/omnichannel/leads" replace />} />
              <Route path="/operations/consultant/sales-consultant" element={<Navigate to="/omnichannel/leads" replace />} />
              <Route path="/operations/sales" element={<Navigate to="/operations/sales/activities" replace />} />
              <Route
                path="/operations/sales/activities"
                element={
                  <PageAccessGuard
                    pagePath="/operations/sales"
                    loadingShell={PAGE_GUARD_LOADING_SHELL}
                    loadingShellWrapperClassName="bg-surface-muted overflow-hidden"
                  >
                    <SalesActivitiesOperationsSuspense>
                      <DailyTaskProviderShell>
                        <SalesOperationsPage />
                      </DailyTaskProviderShell>
                    </SalesActivitiesOperationsSuspense>
                  </PageAccessGuard>
                }
              />
              <Route
                path="/operations/sales/jadwal-kunjungan"
                element={
                  <PageAccessGuard
                    pagePath="/operations/sales"
                    loadingShell={PAGE_GUARD_LOADING_SHELL}
                    loadingShellWrapperClassName="bg-surface-muted overflow-hidden"
                  >
                    <JadwalKunjunganOperationsSuspense>
                      <DailyTaskProviderShell>
                        <SalesOperationsPage />
                      </DailyTaskProviderShell>
                    </JadwalKunjunganOperationsSuspense>
                  </PageAccessGuard>
                }
              />
              <Route
                path="/operations/sales/client-visits"
                element={
                  <PageAccessGuard
                    pagePath="/operations/sales"
                    loadingShell={PAGE_GUARD_LOADING_SHELL}
                    loadingShellWrapperClassName="bg-surface-muted overflow-hidden"
                  >
                    <ClientVisitsOperationsSuspense>
                      <DailyTaskProviderShell>
                        <SalesOperationsPage />
                      </DailyTaskProviderShell>
                    </ClientVisitsOperationsSuspense>
                  </PageAccessGuard>
                }
              />
              <Route
                path="/omnichannel/crm"
                element={
                  <PageAccessGuard
                    pagePath="/omnichannel/crm"
                    loadingShell={PAGE_GUARD_LOADING_SHELL}
                    loadingShellWrapperClassName="bg-surface-muted overflow-hidden"
                  >
                    <ConsultantCrmDashboardSuspense>
                      <CRMDashboardPage />
                    </ConsultantCrmDashboardSuspense>
                  </PageAccessGuard>
                }
              />
              <Route
                path="/omnichannel/leads"
                element={
                  <PageAccessGuard
                    pagePath="/omnichannel/leads"
                    loadingShell={PAGE_GUARD_LOADING_SHELL}
                    loadingShellWrapperClassName="bg-surface-muted overflow-hidden"
                  >
                    <ConsultantLeadsManagementRouteElement />
                  </PageAccessGuard>
                }
              />
              <Route
                path="/omnichannel/integrations/whatsapp"
                element={
                  <PageAccessGuard
                    pagePath="/omnichannel/integrations/whatsapp"
                    loadingShell={PAGE_GUARD_LOADING_SHELL}
                    loadingShellWrapperClassName="bg-surface-muted"
                  >
                    <WhatsAppConnectSuspense>
                      <WhatsAppConnectPage />
                    </WhatsAppConnectSuspense>
                  </PageAccessGuard>
                }
              />
              <Route
                path="/omnichannel/integrations/instagram"
                element={
                  <PageAccessGuard
                    pagePath="/omnichannel/integrations/instagram"
                    loadingShellWrapperClassName="bg-surface-muted"
                    loadingShell={
                      <div
                        className="flex h-full min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden"
                        aria-busy
                        aria-label="Loading Connect Instagram"
                      >
                        <span className="sr-only">Loading Connect Instagram</span>
                        <InstagramConnectPageSkeleton mode="route" />
                      </div>
                    }
                  >
                    <InstagramConnectOperationsSuspense>
                      <InstagramConnectPage />
                    </InstagramConnectOperationsSuspense>
                  </PageAccessGuard>
                }
              />
              <Route
                path="/omnichannel/integrations/email"
                element={
                  <PageAccessGuard
                    pagePath="/omnichannel/integrations/email"
                    loadingShell={PAGE_GUARD_LOADING_SHELL}
                    loadingShellWrapperClassName="bg-surface-muted"
                  >
                    <EmailConnectOperationsSuspense>
                      <EmailConnectPage />
                    </EmailConnectOperationsSuspense>
                  </PageAccessGuard>
                }
              />
              <Route
                path="/omnichannel/livechat"
                element={
                  <PageAccessGuard
                    pagePath="/omnichannel/livechat"
                    loadingShell={PAGE_GUARD_LOADING_SHELL}
                    loadingShellWrapperClassName="bg-surface-muted"
                  >
                    <ConsultantLivechatRouteElement />
                  </PageAccessGuard>
                }
              />
              <Route
                path="/omnichannel/livechat/template-follow-ups"
                element={
                  <PageAccessGuard
                    pagePath="/omnichannel/livechat"
                    loadingShell={PAGE_GUARD_LOADING_SHELL}
                    loadingShellWrapperClassName="bg-surface-muted"
                  >
                    <WhatsAppTemplateFollowupsPageSuspense />
                  </PageAccessGuard>
                }
              />
              <Route
                path="/operations/consultant/whatsapp/templates/recipient-lists"
                element={<Navigate to="/omnichannel/campaign/recipient-lists" replace />}
              />
              <Route
                path="/omnichannel/campaign/recipient-lists/:listId"
                element={
                  <PageAccessGuard
                    pagePath="/omnichannel/campaign/recipient-lists"
                    loadingShell={PAGE_GUARD_LOADING_SHELL}
                    loadingShellWrapperClassName="bg-surface-muted"
                  >
                    <WhatsAppTemplateSuspense>
                      <WhatsAppRecipientListDetailPage />
                    </WhatsAppTemplateSuspense>
                  </PageAccessGuard>
                }
              />
              <Route
                path="/omnichannel/campaign/recipient-lists"
                element={
                  <PageAccessGuard
                    pagePath="/omnichannel/campaign/recipient-lists"
                    loadingShell={PAGE_GUARD_LOADING_SHELL}
                    loadingShellWrapperClassName="bg-surface-muted"
                  >
                    <WhatsAppTemplateSuspense>
                      <WhatsAppRecipientListsPage />
                    </WhatsAppTemplateSuspense>
                  </PageAccessGuard>
                }
              />
              <Route
                path="/omnichannel/campaign/whatsapp"
                element={
                  <PageAccessGuard
                    pagePath="/omnichannel/campaign/whatsapp"
                    loadingShell={PAGE_GUARD_LOADING_SHELL}
                    loadingShellWrapperClassName="bg-surface-muted"
                  >
                    <WhatsAppTemplateSuspense>
                      <WhatsAppCampaignPage />
                    </WhatsAppTemplateSuspense>
                  </PageAccessGuard>
                }
              />
              <Route
                path="/operations/consultant/whatsapp/templates"
                element={<Navigate to="/omnichannel/campaign/templates" replace />}
              />
              <Route
                path="/omnichannel/campaign/templates"
                element={
                  <PageAccessGuard
                    pagePath="/omnichannel/campaign/templates"
                    loadingShell={PAGE_GUARD_LOADING_SHELL}
                    loadingShellWrapperClassName="bg-surface-muted"
                  >
                    <WhatsAppTemplateSuspense>
                      <WhatsAppTemplatePage />
                    </WhatsAppTemplateSuspense>
                  </PageAccessGuard>
                }
              />
              <Route element={<SubscriptionRoleGuard />}>
                <Route path="/subscription" element={<Navigate to="/subscription/overview" replace />} />
                <Route path="/subscription/overview" element={<SubscriptionOverviewRouteElement />} />
                <Route path="/subscription/plans" element={<SubscriptionPlansRouteElement />} />
                <Route path="/subscription/management" element={<SubscriptionManagementRouteElement />} />
              </Route>
            </Route>
            <Route
              path="/employees/add"
              element={
                <PageAccessGuard
                  pagePath="/employees/add"
                  loadingShell={PAGE_GUARD_LOADING_SHELL}
                  loadingShellWrapperClassName="bg-gray-50"
                >
                  <AddEmployeePage />
                </PageAccessGuard>
              }
            />
            <Route path="/create-organization" element={<CreateOrganizationRouteElement />} />
            <Route path="/create-plan" element={<CreatePlanRouteElement />} />
            <Route path="/employee-welcome" element={<EmployeeWelcomeRouteElement />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
const InstagramConnectOperationsSuspense = ({ children }: { children: ReactNode }) => (
  <Suspense
    fallback={
      <div
        className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface-muted"
        aria-busy
        aria-label="Loading Connect Instagram"
      >
        <span className="sr-only">Loading Connect Instagram</span>
        <InstagramConnectPageSkeleton mode="route" />
      </div>
    }
  >
    {children}
  </Suspense>
);

const ConsultantCrmDashboardSuspense = ({ children }: { children: ReactNode }) => (
  <Suspense
    fallback={
      <div
        className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface-muted"
        aria-busy
        aria-label="Loading CRM dashboard"
      >
        <ConsultantCrmDashboardPageSkeleton />
      </div>
    }
  >
    {children}
  </Suspense>
);

const OmnichannelSettingsSuspense = ({ children }: { children: ReactNode }) => (
  <Suspense
    fallback={
      <div
        className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface-muted"
        aria-busy
        aria-label="Loading omnichannel settings"
      >
        <OmnichannelSettingsPageSkeleton />
      </div>
    }
  >
    {children}
  </Suspense>
);

const EmailConnectOperationsSuspense = ({ children }: { children: ReactNode }) => (
  <Suspense
    fallback={
      <div
        className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface-muted"
        aria-busy
        aria-label="Loading connect email"
      >
        <EmailConnectPageSkeleton />
      </div>
    }
  >
    {children}
  </Suspense>
);

const WhatsAppConnectSuspense = ({ children }: { children: ReactNode }) => (
  <Suspense
    fallback={
      <div
        className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface-muted"
        aria-busy
        aria-label="Loading"
      >
        <WhatsAppConnectPageSkeleton />
      </div>
    }
  >
    {children}
  </Suspense>
);

const WhatsAppTemplateSuspense = ({ children }: { children: ReactNode }) => (
  <Suspense
    fallback={
      <div
        className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface-muted"
        aria-busy
        aria-label="Loading WhatsApp templates"
      >
        <WhatsAppTemplatePageSkeleton />
      </div>
    }
  >
    {children}
  </Suspense>
);

function WhatsAppTemplateFollowupsPageSuspense() {
  return (
    <Suspense
      fallback={
        <div
          className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface-muted"
          aria-busy
          aria-label="Loading template follow-ups"
        >
          <ConsultantLivechatRouteLoadingShell />
        </div>
      }
    >
      <WhatsAppTemplateFollowupsPage />
    </Suspense>
  );
}

const SalesActivitiesOperationsSuspense = ({ children }: { children: ReactNode }) => (
  <Suspense
    fallback={
      <div
        className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface-muted"
        aria-busy
        aria-label="Loading sales activities"
      >
        <SalesActivitiesPageSkeleton />
      </div>
    }
  >
    {children}
  </Suspense>
);

const JadwalKunjunganOperationsSuspense = ({ children }: { children: ReactNode }) => (
  <Suspense
    fallback={
      <div
        className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface-muted"
        aria-busy
        aria-label="Loading jadwal kunjungan"
      >
        <VisitSchedulingPageSkeleton />
      </div>
    }
  >
    {children}
  </Suspense>
);

const ClientVisitsOperationsSuspense = ({ children }: { children: ReactNode }) => (
  <Suspense
    fallback={
      <div
        className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface-muted"
        aria-busy
        aria-label="Loading client visits"
      >
        <ClientVisitsPageSkeleton />
      </div>
    }
  >
    {children}
  </Suspense>
);

const PasswordManagerSuspense = ({ children }: { children: ReactNode }) => (
  <Suspense
    fallback={
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-gray-100" aria-busy>
        <PasswordManagerPageSkeleton />
      </div>
    }
  >
    {children}
  </Suspense>
);

const PPh21CalculatorSuspense = ({ children }: { children: ReactNode }) => (
  <Suspense
    fallback={
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-gray-100" aria-busy>
        <PPh21PageSkeleton />
      </div>
    }
  >
    {children}
  </Suspense>
);

const CalculatorSuspense = ({ children }: { children: ReactNode }) => (
  <Suspense
    fallback={
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-gray-100" aria-busy>
        <CalculatorPageSkeleton />
      </div>
    }
  >
    {children}
  </Suspense>
);

const PricingToolsSuspense = ({ children }: { children: ReactNode }) => (
  <Suspense
    fallback={
      <div
        className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-background font-sans"
        aria-busy
      >
        <PricingToolsPageSkeleton />
      </div>
    }
  >
    {children}
  </Suspense>
);

const PromoSimulationSuspense = ({ children }: { children: ReactNode }) => (
  <Suspense
    fallback={
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-background" aria-busy>
        <PromoSimulationPageSkeleton />
      </div>
    }
  >
    {children}
  </Suspense>
);

const DefaultPricesSuspense = ({ children }: { children: ReactNode }) => (
  <Suspense
    fallback={
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-gray-100" aria-busy>
        <DefaultPricesPageSkeleton />
      </div>
    }
  >
    {children}
  </Suspense>
);

const KolManagementSuspense = ({ children }: { children: ReactNode }) => (
  <Suspense
    fallback={
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-gray-100" aria-busy>
        <KolManagementRouteLoadingShell />
      </div>
    }
  >
    {children}
  </Suspense>
);

/** Rute `/kol-management/dashboard` — guard + Suspense memakai skeleton layout yang sama dengan halaman live. */
const KolManagementDashboardSuspense = ({ children }: { children: ReactNode }) => (
  <Suspense
    fallback={
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-gray-100" aria-busy>
        <KolManagementDashboardPageSkeleton />
      </div>
    }
  >
    {children}
  </Suspense>
);

/** Rute `/kol-management/kol-management` — daftar KOL + sidebar overview. */
const KolManagementKolManagementSuspense = ({ children }: { children: ReactNode }) => (
  <Suspense
    fallback={
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-gray-100" aria-busy>
        <KolManagementKolManagementPageSkeleton />
      </div>
    }
  >
    {children}
  </Suspense>
);

/** Rute `/kol-management/campaigns` — tabel kampanye + metrik + sidebar. */
const KolManagementCampaignsSuspense = ({ children }: { children: ReactNode }) => (
  <Suspense
    fallback={
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-gray-100" aria-busy>
        <KolManagementCampaignsPageSkeleton />
      </div>
    }
  >
    {children}
  </Suspense>
);

/** Rute `/kol-management/content-post` — daftar content post + metrik + sidebar. */
const KolManagementContentPostSuspense = ({ children }: { children: ReactNode }) => (
  <Suspense
    fallback={
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-gray-100" aria-busy>
        <KolManagementContentPostPageSkeleton />
      </div>
    }
  >
    {children}
  </Suspense>
);

/** Rute `/kol-management/payment-terms` — template & agreement payment terms. */
const KolManagementPaymentTermsSuspense = ({ children }: { children: ReactNode }) => (
  <Suspense
    fallback={
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-gray-100" aria-busy>
        <KolManagementPaymentTermsPageSkeleton />
      </div>
    }
  >
    {children}
  </Suspense>
);

const SocialMediaSuspense = ({ children }: { children: ReactNode }) => (
  <Suspense
    fallback={
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-gray-100" aria-busy>
        <SocialMediaShellSkeleton />
      </div>
    }
  >
    {children}
  </Suspense>
);

const SocialMediaDashboardSuspense = ({ children }: { children: ReactNode }) => (
  <Suspense
    fallback={
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-gray-100" aria-busy>
        <SocialMediaDashboardSkeleton />
      </div>
    }
  >
    {children}
  </Suspense>
);

const TrafficSuspense = ({ children }: { children: ReactNode }) => (
  <Suspense
    fallback={
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-gray-100" aria-busy>
        <TrafficPageSkeleton />
      </div>
    }
  >
    {children}
  </Suspense>
);

function TrafficMobileAwareLoadingShell() {
  const { isDesktop } = useAuthSurface();
  if (isDesktop) return <TrafficPageSkeleton />;
  return (
    <Suspense fallback={<TrafficPageSkeleton />}>
      <MobileWebTrafficPageSkeleton />
    </Suspense>
  );
}

function TrafficMobileAwareRouteElement() {
  const { isDesktop } = useAuthSurface();
  return (
    <Suspense
      fallback={
        <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-gray-100" aria-busy>
          <TrafficMobileAwareLoadingShell />
        </div>
      }
    >
      {isDesktop ? <TrafficPage /> : <MobileWebTrafficPage />}
    </Suspense>
  );
}

function GoogleAdsMetricsPageRouteElement() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-gray-100" aria-busy>
          <GoogleAdsMetricsPageSkeleton />
        </div>
      }
    >
      <GoogleAdsMetricsPage />
    </Suspense>
  );
}

function MetaAdsMetricsPageRouteElement() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-gray-100" aria-busy>
          <MetaAdsMetricsPageSkeleton />
        </div>
      }
    >
      <MetaAdsMetricsPage />
    </Suspense>
  );
}

const SocialMediaProductKnowledgeSuspense = ({ children }: { children: ReactNode }) => (
  <Suspense
    fallback={
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-gray-100" aria-busy>
        <ProductKnowledgePageSkeleton />
      </div>
    }
  >
    {children}
  </Suspense>
);

const SocialMediaScriptGeneratorSuspense = ({ children }: { children: ReactNode }) => (
  <Suspense
    fallback={
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-gray-100" aria-busy>
        <ScriptGeneratorPageSkeleton />
      </div>
    }
  >
    {children}
  </Suspense>
);

const SocialMediaSettingsSuspense = ({ children }: { children: ReactNode }) => (
  <Suspense
    fallback={
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-muted/40" aria-busy>
        <SocialMediaSettingsPageSkeleton />
      </div>
    }
  >
    {children}
  </Suspense>
);

/** Rute content calendar — skeleton selaras layout halaman (bukan shell dashboard generik). */
const ContentCalendarSuspense = ({ children }: { children: ReactNode }) => (
  <Suspense
    fallback={
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-gray-100" aria-busy>
        <ContentCalendarPageSkeleton />
      </div>
    }
  >
    {children}
  </Suspense>
);

const CompanySuspense = ({ children }: { children: ReactNode }) => (
  <Suspense
    fallback={
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col" aria-busy>
        <CompanyRouteSkeleton />
      </div>
    }
  >
    {children}
  </Suspense>
);

const RequestFormSuspense = ({ children }: { children: ReactNode }) => (
  <Suspense
    fallback={
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col" aria-busy>
        <RequestFormPageSkeleton />
      </div>
    }
  >
    {children}
  </Suspense>
);

const PublicJobApplication = lazy(() => import("@/2-2-recruitment-dashboard/applications/public/JobApplication"));
const PublicApplicationThankYou = lazy(
  () => import("@/2-2-recruitment-dashboard/applications/public/ApplicationThankYou"),
);
const PublicJobPreview = lazy(() => import("@/2-2-recruitment-dashboard/applications/public/JobPreview"));
const PublicCandidateProfile = lazy(() => import("@/2-2-recruitment-dashboard/applications/public/CandidateProfile"));
const PublicCandidateProfileThankYou = lazy(
  () => import("@/2-2-recruitment-dashboard/applications/public/CandidateProfileThankYou"),
);

/** Tab/window focus tidak memicu refetch massal (halaman-tidak-reload-otomatis). */
focusManager.setEventListener(() => () => {});
focusManager.setFocused(true);
onlineManager.setEventListener(() => () => {});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      /** Satu siklus fetch per query saat load; hindari refetch kedua saat tab online lagi / remount. */
      refetchOnReconnect: false,
      refetchOnMount: false,
      staleTime: 60_000,
      gcTime: 10 * 60_000,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <CapacitorKeyboardInsetProvider>
      <MobileAppNavSuppressionProvider>
      <NativeAppDisplayInit />
      <NativeSafeAreaCssVarsInit />
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <Toaster />
        <Sonner />
        <AuthProvider>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <CentralizedUserDataProvider>
            <PermissionConfigurationProvider>
              <CurrentOrgProvider>
              <NativeBootstrapSplashGate />
              <NativeFcmRegistration />
              <BrowserRouter
                future={{
                  v7_relativeSplatPath: true,
                  v7_startTransition: true,
                }}
              >
              <LanguageProvider>
                <ShareIntentRouteSync />
                <CentralizedUserDataPathSync />
                <NativeGoogleAuthInit />
                <NativeSupabaseOAuthBridge />
                <NativeNotificationTapBridge />
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                  <Suspense
                    fallback={
                      typeof window !== "undefined" && window.location.pathname === "/" ? (
                        <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-gray-100" aria-busy>
                          <HomePageRouteLoadingShell />
                          <span className="sr-only">Loading</span>
                        </div>
                      ) : (
                        <div
                          className="flex min-h-[40vh] flex-1 items-center justify-center bg-gray-50"
                          aria-busy
                        >
                          <span className="sr-only">Loading</span>
                        </div>
                      )
                    }
                  >
                    <Routes>
                  <Route path="/login" element={<LoginRouteElement />} />
                  <Route path="/first-login" element={<FirstLoginRouteElement />} />
                  <Route path="/auth/google/callback" element={<GoogleOAuthCallbackRouteElement />} />
                  <Route path="/auth/meta/callback" element={<MetaOAuthCallbackRouteElement />} />
                  <Route path="/auth/sso/callback" element={<SupabaseSsoCallbackRouteElement />} />
                  <Route
                    path="/operations/instagram-connect"
                    element={<Navigate to="/omnichannel/integrations/instagram" replace />}
                  />
                  <Route path="/forgot-password" element={<ForgotPasswordRouteElement />} />
                  <Route path="/reset-password" element={<ResetPasswordRouteElement />} />
                  <Route path="/register" element={<RegisterRouteElement />} />
                  <Route path="/verify-email" element={<VerifyEmailRouteElement />} />
                  <Route path="/email-verified" element={<EmailVerifiedRouteElement />} />
                  <Route path="/terms-and-conditions" element={<TermsAndConditionsRouteElement />} />
                  <Route path="/policy/privacy" element={<PrivacyPolicyPage />} />
                  <Route path="/policy/terms" element={<TermsOfServicePage />} />
                  <Route path="/policy/account-deletion" element={<AccountDeletionPage />} />

                  <Route
                    path="/candidate/apply"
                    element={
                      <RecruitmentSuspense>
                        <PublicJobApplication />
                      </RecruitmentSuspense>
                    }
                  />
                  <Route
                    path="/apply/thank-you"
                    element={
                      <RecruitmentSuspense>
                        <PublicApplicationThankYou />
                      </RecruitmentSuspense>
                    }
                  />
                  <Route
                    path="/apply/preview/:token"
                    element={
                      <RecruitmentSuspense>
                        <PublicJobPreview />
                      </RecruitmentSuspense>
                    }
                  />
                  <Route
                    path="/candidate/profile/thank-you"
                    element={
                      <RecruitmentSuspense>
                        <PublicCandidateProfileThankYou />
                      </RecruitmentSuspense>
                    }
                  />
                  <Route
                    path="/candidate/profile"
                    element={
                      <RecruitmentSuspense>
                        <PublicCandidateProfile />
                      </RecruitmentSuspense>
                    }
                  />
                  <Route
                    path="/review/:token"
                    element={
                      <Suspense
                        fallback={
                          <div
                            className="flex min-h-[40vh] flex-1 items-center justify-center bg-gray-50"
                            aria-busy
                          >
                            <span className="sr-only">Loading</span>
                          </div>
                        }
                      >
                        <ReviewRouteGate />
                      </Suspense>
                    }
                  />

                  <Route
                    path="/s/:token/thanks"
                    element={
                      <SurveyPublicShell>
                        <CustomerSurveyPublicThanksPage />
                      </SurveyPublicShell>
                    }
                  />
                  <Route
                    path="/s/:token"
                    element={
                      <SurveyPublicShell>
                        <CustomerSurveyPublicFormPage />
                      </SurveyPublicShell>
                    }
                  />

                  <Route element={<RequireAuth />}>
                    <Route element={<SubscriptionExpiryGuard />}>
                      <Route element={<AdaptiveAppLayout />}>
                        <Route
                          path="/"
                          element={
                            <PageAccessGuard
                              pagePath="/"
                              loadingShell={<HomePageRouteLoadingShell />}
                              loadingShellWrapperClassName="bg-gray-100"
                            >
                              <HomeRouteElement />
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/schedule"
                          element={
                            <PageAccessGuard
                              pagePath="/operations/sales"
                              loadingShell={PAGE_GUARD_LOADING_SHELL}
                              loadingShellWrapperClassName="bg-surface-muted overflow-hidden"
                            >
                              <ScheduleRouteElement />
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/client-visit"
                          element={
                            <PageAccessGuard
                              pagePath="/operations/sales"
                              loadingShell={PAGE_GUARD_LOADING_SHELL}
                              loadingShellWrapperClassName="bg-surface-muted overflow-hidden"
                            >
                              <ClientVisitRouteElement />
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/reports"
                          element={
                            <PageAccessGuard requiresPermissions={false} loadingShell={PAGE_GUARD_LOADING_SHELL}>
                              <MobileAttendanceReportsRouteElement />
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/profile/payslips"
                          element={
                            <PageAccessGuard pagePath="/settings" requiresPermissions={false} loadingShell={<HomePageSkeleton />}>
                              <MyPayslipsPage />
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/profile"
                          element={
                            <PageAccessGuard pagePath="/settings" requiresPermissions={false} loadingShell={<HomePageSkeleton />}>
                              <ProfileTabRouteElement />
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/share/receipt-validation"
                          element={
                            <PageAccessGuard requiresPermissions={false}>
                              <ShareReceiptValidationRouteElement />
                            </PageAccessGuard>
                          }
                        />
                        <Route path="/settings" element={<SettingsPage />}>
                          <Route index element={<ProfileRouteElement />} />
                          <Route path="profile" element={<ProfileRouteElement />} />
                          <Route path="security" element={<SecuritySettings />} />
                        </Route>
                        <Route path="/transfer-ownership" element={<TransferOwnershipPage />} />
                        <Route path="/okr" element={<Navigate to="/okr/company-objective" replace />} />
                        <Route
                          path="/okr/*"
                          element={
                            <PageAccessGuard
                              loadingShell={<OkrRouteAccessLoadingShell />}
                              loadingShellWrapperClassName="bg-gray-100 dark:bg-muted/30"
                            >
                              <OkrRouteElement />
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/employees"
                          element={
                            <PageAccessGuard
                              pagePath="/employees"
                              loadingShell={PAGE_GUARD_LOADING_SHELL}
                              loadingShellWrapperClassName="bg-gray-100"
                            >
                              <EmployeePage />
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/employees/reprimand"
                          element={
                            <PageAccessGuard
                              pagePath="/employees/reprimand"
                              loadingShell={PAGE_GUARD_LOADING_SHELL}
                              loadingShellWrapperClassName="bg-gray-100"
                            >
                              <HrManagementRoleGuard showPendingSkeleton={false}>
                                <ReprimandManagementPage />
                              </HrManagementRoleGuard>
                            </PageAccessGuard>
                          }
                        />
                        <Route path="/my-info/personal" element={<EmployeePersonalInfo />} />
                        <Route path="/my-info/address" element={<EmployeeAddressInfo />} />
                        <Route path="/my-info/employment" element={<EmployeeEmploymentInfo />} />
                        <Route path="/my-info/education/formal" element={<EmployeeEducationFormal />} />
                        <Route path="/my-info/education/informal" element={<EmployeeEducationInformal />} />
                        <Route path="/my-info/work" element={<EmployeeWork />} />
                        <Route path="/my-info/family" element={<EmployeeFamily />} />
                        <Route path="/my-info/attendance" element={<EmployeeAttendance />} />
                        <Route path="/my-info/leave-permit" element={<EmployeeLeavePermit />} />
                        <Route path="/my-info/documents" element={<EmployeeDocuments />} />
                        <Route path="/my-info/payroll" element={<EmployeePayroll />} />
                        <Route
                          path="/attendance"
                          element={
                            <PageAccessGuard loadingShell={PAGE_GUARD_LOADING_SHELL}>
                              <AttendancePage />
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/attendance/attendance"
                          element={
                            <PageAccessGuard loadingShell={PAGE_GUARD_LOADING_SHELL}>
                              <AttendancePage />
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/attendance/settings"
                          element={
                            <PageAccessGuard loadingShell={PAGE_GUARD_LOADING_SHELL}>
                              <AttendancePage />
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/access-permissions"
                          element={
                            <PageAccessGuard
                              pagePath="/access-permissions"
                              loadingShell={PAGE_GUARD_LOADING_SHELL}
                              loadingShellWrapperClassName="bg-background"
                            >
                              <AccessPermissionsSuspense>
                                <AccessPermissionsConfig />
                              </AccessPermissionsSuspense>
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/access-permissions/page-access"
                          element={
                            <PageAccessGuard
                              pagePath="/access-permissions/page-access"
                              loadingShell={PAGE_GUARD_LOADING_SHELL}
                              loadingShellWrapperClassName="bg-background"
                            >
                              <AccessPermissionsSuspense>
                                <AccessPermissionsConfig />
                              </AccessPermissionsSuspense>
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/access-permissions/overview"
                          element={
                            <PageAccessGuard
                              pagePath="/access-permissions/overview"
                              loadingShell={PAGE_GUARD_LOADING_SHELL}
                              loadingShellWrapperClassName="bg-background"
                            >
                              <AccessPermissionsSuspense>
                                <AccessPermissionsConfig />
                              </AccessPermissionsSuspense>
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/access-permissions/roles"
                          element={
                            <PageAccessGuard
                              pagePath="/access-permissions/roles"
                              loadingShell={PAGE_GUARD_LOADING_SHELL}
                              loadingShellWrapperClassName="bg-background"
                            >
                              <AccessPermissionsSuspense>
                                <AccessPermissionsConfig />
                              </AccessPermissionsSuspense>
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/access-permissions/pages"
                          element={
                            <PageAccessGuard
                              pagePath="/access-permissions/pages"
                              loadingShell={PAGE_GUARD_LOADING_SHELL}
                              loadingShellWrapperClassName="bg-background"
                            >
                              <AccessPermissionsSuspense>
                                <AccessPermissionsConfig />
                              </AccessPermissionsSuspense>
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/payroll/calculations"
                          element={
                            <PageAccessGuard loadingShell={PAGE_GUARD_LOADING_SHELL}>
                              <PayrollCalculationsPage />
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/company/dashboard"
                          element={
                            <PageAccessGuard>
                              <CompanySuspense>
                                <CompanyDashboardPage />
                              </CompanySuspense>
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/company/company-assets"
                          element={
                            <PageAccessGuard loadingShell={PAGE_GUARD_LOADING_SHELL}>
                              <CompanyCompanyAssetsPage />
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/company/files"
                          element={
                            <PageAccessGuard loadingShell={PAGE_GUARD_LOADING_SHELL}>
                              <CompanyFilesPage />
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/company/organization"
                          element={
                            <PageAccessGuard
                              pagePath="/company/organization"
                              loadingShell={PAGE_GUARD_LOADING_SHELL}
                            >
                              <CompanyOrganizationPage />
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/incomes"
                          element={<Navigate to={MOBILE_INCOMES_DASHBOARD_PATH} replace />}
                        />
                        <Route
                          path="/incomes/dashboard"
                          element={
                            <PageAccessGuard
                              pagePath="/incomes/dashboard"
                              loadingShell={PAGE_GUARD_LOADING_SHELL}
                            >
                              <IncomeDashboardRouteElement />
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/incomes/transaction/bank-account"
                          element={
                            <PageAccessGuard
                              pagePath="/incomes/transaction"
                              loadingShell={PAGE_GUARD_LOADING_SHELL}
                            >
                              <IncomeBankAccountRouteElement />
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/incomes/transaction"
                          element={
                            <PageAccessGuard
                              pagePath="/incomes/transaction"
                              loadingShell={PAGE_GUARD_LOADING_SHELL}
                            >
                              <IncomeTransactionRouteElement />
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/incomes/piutang"
                          element={
                            <PageAccessGuard
                              pagePath="/incomes/transaction"
                              loadingShell={PAGE_GUARD_LOADING_SHELL}
                            >
                              <IncomePiutangRouteElement />
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/incomes/bank-accounts"
                          element={<Navigate to={MOBILE_INCOMES_BANK_ACCOUNT_PATH} replace />}
                        />
                        <Route
                          path="/expenses"
                          element={<Navigate to="/expenses/dashboard" replace />}
                        />
                        <Route
                          path="/expenses/dashboard"
                          element={
                            <PageAccessGuard
                              pagePath="/expenses/dashboard"
                              loadingShell={PAGE_GUARD_LOADING_SHELL}
                            >
                              <ExpensesDashboardRouteElement />
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/expenses/debt"
                          element={
                            <PageAccessGuard
                              pagePath="/expenses/debt"
                              loadingShell={PAGE_GUARD_LOADING_SHELL}
                            >
                              <ExpensesDebtRouteElement />
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/expenses/approvals"
                          element={
                            <PageAccessGuard
                              pagePath="/expenses/approvals"
                              loadingShell={PAGE_GUARD_LOADING_SHELL}
                            >
                              <ExpensesApprovalsRouteElement />
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/expenses/payment-process"
                          element={
                            <PageAccessGuard
                              pagePath="/expenses/payment-process"
                              loadingShell={PAGE_GUARD_LOADING_SHELL}
                            >
                              <ExpensesPaymentProcessRouteElement />
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/expenses/reminder-bills"
                          element={
                            <PageAccessGuard
                              pagePath="/expenses/reminder-bills"
                              loadingShell={PAGE_GUARD_LOADING_SHELL}
                            >
                              <ExpensesReminderBillsRouteElement />
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/request-form"
                          element={<Navigate to="/request-form/purchase" replace />}
                        />
                        <Route
                          path="/request-form/purchase"
                          element={
                            <RequestFormSuspense>
                              <RequestFormPurchasePage />
                            </RequestFormSuspense>
                          }
                        />
                        <Route
                          path="/request-form/reimbursement"
                          element={
                            <RequestFormSuspense>
                              <RequestFormReimbursementPage />
                            </RequestFormSuspense>
                          }
                        />
                        <Route
                          path="/request-form/cash-advance"
                          element={
                            <RequestFormSuspense>
                              <RequestFormCashAdvancePage />
                            </RequestFormSuspense>
                          }
                        />
                        <Route
                          path="/request-form/loan"
                          element={
                            <RequestFormSuspense>
                              <RequestFormLoanPage />
                            </RequestFormSuspense>
                          }
                        />
                        <Route
                          path="/tools/daily-task"
                          element={
                            <PageAccessGuard pagePath="/tools/daily-task" loadingShell={PAGE_GUARD_LOADING_SHELL}>
                              <DailyTaskRouteElement />
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/tools/daily-task-report"
                          element={
                            <PageAccessGuard pagePath="/tools/daily-task-report" loadingShell={PAGE_GUARD_LOADING_SHELL}>
                              <DailyTaskReportRouteElement />
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/tools/meeting-notes"
                          element={
                            <PageAccessGuard pagePath="/tools/meeting-notes" loadingShell={PAGE_GUARD_LOADING_SHELL}>
                              <MeetingNotesRouteElement />
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/tools/habits-tracker"
                          element={
                            <PageAccessGuard pagePath="/tools/habits-tracker" loadingShell={PAGE_GUARD_LOADING_SHELL}>
                              <HabitTrackerRouteElement />
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/tools/password-manager"
                          element={
                            <PageAccessGuard
                              pagePath="/tools/password-manager"
                              loadingShell={PAGE_GUARD_LOADING_SHELL}
                            >
                              <PasswordManagerSuspense>
                                <PasswordManagerPage />
                              </PasswordManagerSuspense>
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/tools/pph21-calculator"
                          element={
                            <PageAccessGuard
                              pagePath="/tools/pph21-calculator"
                              loadingShell={PAGE_GUARD_LOADING_SHELL}
                            >
                              <PPh21CalculatorSuspense>
                                <PPh21CalculatorPage />
                              </PPh21CalculatorSuspense>
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/tools/default-prices"
                          element={
                            <PageAccessGuard
                              pagePath="/tools/default-prices"
                              loadingShell={PAGE_GUARD_LOADING_SHELL}
                            >
                              <DefaultPricesSuspense>
                                <DefaultPricesPage />
                              </DefaultPricesSuspense>
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/tools/pricing-tools"
                          element={
                            <PageAccessGuard
                              pagePath="/tools/pricing-tools"
                              loadingShell={PAGE_GUARD_LOADING_SHELL}
                            >
                              <PricingToolsSuspense>
                                <PricingToolsPage />
                              </PricingToolsSuspense>
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/tools/promo-simulation"
                          element={
                            <PageAccessGuard
                              pagePath="/tools/promo-simulation"
                              loadingShell={PAGE_GUARD_LOADING_SHELL}
                            >
                              <PromoSimulationSuspense>
                                <PromoSimulationPage />
                              </PromoSimulationSuspense>
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/tools/calculator"
                          element={<Navigate to="/tools/calculator/services" replace />}
                        />
                        <Route
                          path="/tools/calculator/services"
                          element={
                            <PageAccessGuard
                              pagePath="/tools/calculator"
                              loadingShell={PAGE_GUARD_LOADING_SHELL}
                            >
                              <CalculatorSuspense>
                                <CalculatorServicesPage />
                              </CalculatorSuspense>
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/tools/calculator/sales"
                          element={
                            <PageAccessGuard
                              pagePath="/tools/calculator"
                              loadingShell={PAGE_GUARD_LOADING_SHELL}
                            >
                              <CalculatorSuspense>
                                <CalculatorSalesPage />
                              </CalculatorSuspense>
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/omnichannel/settings"
                          element={<Navigate to={OMNICHANNEL_SETTINGS_INDEX_REDIRECT_TO} replace />}
                        />
                        <Route
                          path="/omnichannel/settings/:section"
                          element={
                            <PageAccessGuard
                              pagePath="/omnichannel/settings"
                              loadingShell={PAGE_GUARD_LOADING_SHELL}
                              loadingShellWrapperClassName="bg-surface-muted overflow-hidden"
                            >
                              <OmnichannelSettingsSuspense>
                                <OmnichannelSettingsPage />
                              </OmnichannelSettingsSuspense>
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/operations/customer-service/dashboard"
                          element={<Navigate to="/omnichannel/leads" replace />}
                        />
                        <Route
                          path="/operations/customer-service/tickets"
                          element={<Navigate to="/omnichannel/leads" replace />}
                        />
                        <Route
                          path="/operations/customer-service"
                          element={<Navigate to="/omnichannel/leads" replace />}
                        />
                        <Route
                          path="/operations/consultant/sales-consultant"
                          element={<Navigate to="/omnichannel/leads" replace />}
                        />
                        <Route path="/operations/sales" element={<Navigate to="/operations/sales/activities" replace />} />
                        <Route
                          path="/operations/sales/activities"
                          element={
                            <PageAccessGuard
                              pagePath="/operations/sales"
                              loadingShell={PAGE_GUARD_LOADING_SHELL}
                              loadingShellWrapperClassName="bg-surface-muted overflow-hidden"
                            >
                              <SalesActivitiesOperationsSuspense>
                                <DailyTaskProviderShell>
                                  <SalesOperationsPage />
                                </DailyTaskProviderShell>
                              </SalesActivitiesOperationsSuspense>
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/operations/sales/jadwal-kunjungan"
                          element={
                            <PageAccessGuard
                              pagePath="/operations/sales"
                              loadingShell={PAGE_GUARD_LOADING_SHELL}
                              loadingShellWrapperClassName="bg-surface-muted overflow-hidden"
                            >
                              <JadwalKunjunganOperationsSuspense>
                                <DailyTaskProviderShell>
                                  <SalesOperationsPage />
                                </DailyTaskProviderShell>
                              </JadwalKunjunganOperationsSuspense>
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/operations/sales/client-visits"
                          element={
                            <PageAccessGuard
                              pagePath="/operations/sales"
                              loadingShell={PAGE_GUARD_LOADING_SHELL}
                              loadingShellWrapperClassName="bg-surface-muted overflow-hidden"
                            >
                              <ClientVisitsOperationsSuspense>
                                <DailyTaskProviderShell>
                                  <SalesOperationsPage />
                                </DailyTaskProviderShell>
                              </ClientVisitsOperationsSuspense>
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/omnichannel/crm"
                          element={
                            <PageAccessGuard
                              pagePath="/omnichannel/crm"
                              loadingShell={PAGE_GUARD_LOADING_SHELL}
                              loadingShellWrapperClassName="bg-surface-muted overflow-hidden"
                            >
                              <ConsultantCrmDashboardSuspense>
                                <CRMDashboardPage />
                              </ConsultantCrmDashboardSuspense>
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/omnichannel/leads"
                          element={
                            <PageAccessGuard
                              pagePath="/omnichannel/leads"
                              loadingShell={PAGE_GUARD_LOADING_SHELL}
                              loadingShellWrapperClassName="bg-surface-muted overflow-hidden"
                            >
                              <ConsultantLeadsManagementRouteElement />
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/omnichannel/integrations/whatsapp"
                          element={
                            <PageAccessGuard
                              pagePath="/omnichannel/integrations/whatsapp"
                              loadingShell={PAGE_GUARD_LOADING_SHELL}
                              loadingShellWrapperClassName="bg-surface-muted"
                            >
                              <WhatsAppConnectSuspense>
                                <WhatsAppConnectPage />
                              </WhatsAppConnectSuspense>
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/omnichannel/integrations/instagram"
                          element={
                            <PageAccessGuard
                              pagePath="/omnichannel/integrations/instagram"
                              loadingShellWrapperClassName="bg-surface-muted"
                              loadingShell={
                                <div
                                  className="flex h-full min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden"
                                  aria-busy
                                  aria-label="Loading Connect Instagram"
                                >
                                  <span className="sr-only">Loading Connect Instagram</span>
                                  <InstagramConnectPageSkeleton mode="route" />
                                </div>
                              }
                            >
                              <InstagramConnectOperationsSuspense>
                                <InstagramConnectPage />
                              </InstagramConnectOperationsSuspense>
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/omnichannel/integrations/email"
                          element={
                            <PageAccessGuard
                              pagePath="/omnichannel/integrations/email"
                              loadingShell={PAGE_GUARD_LOADING_SHELL}
                              loadingShellWrapperClassName="bg-surface-muted"
                            >
                              <EmailConnectOperationsSuspense>
                                <EmailConnectPage />
                              </EmailConnectOperationsSuspense>
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/omnichannel/livechat"
                          element={
                            <PageAccessGuard
                              pagePath="/omnichannel/livechat"
                              loadingShell={PAGE_GUARD_LOADING_SHELL}
                              loadingShellWrapperClassName="bg-surface-muted"
                            >
                              <ConsultantLivechatRouteElement />
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/omnichannel/livechat/template-follow-ups"
                          element={
                            <PageAccessGuard
                              pagePath="/omnichannel/livechat"
                              loadingShell={PAGE_GUARD_LOADING_SHELL}
                              loadingShellWrapperClassName="bg-surface-muted"
                            >
                              <WhatsAppTemplateFollowupsPageSuspense />
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/operations/consultant/whatsapp/templates/recipient-lists"
                          element={<Navigate to="/omnichannel/campaign/recipient-lists" replace />}
                        />
                        <Route
                          path="/omnichannel/campaign/recipient-lists/:listId"
                          element={
                            <PageAccessGuard
                              pagePath="/omnichannel/campaign/recipient-lists"
                              loadingShell={PAGE_GUARD_LOADING_SHELL}
                              loadingShellWrapperClassName="bg-surface-muted"
                            >
                              <WhatsAppTemplateSuspense>
                                <WhatsAppRecipientListDetailPage />
                              </WhatsAppTemplateSuspense>
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/omnichannel/campaign/recipient-lists"
                          element={
                            <PageAccessGuard
                              pagePath="/omnichannel/campaign/recipient-lists"
                              loadingShell={PAGE_GUARD_LOADING_SHELL}
                              loadingShellWrapperClassName="bg-surface-muted"
                            >
                              <WhatsAppTemplateSuspense>
                                <WhatsAppRecipientListsPage />
                              </WhatsAppTemplateSuspense>
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/omnichannel/campaign/whatsapp"
                          element={
                            <PageAccessGuard
                              pagePath="/omnichannel/campaign/whatsapp"
                              loadingShell={PAGE_GUARD_LOADING_SHELL}
                              loadingShellWrapperClassName="bg-surface-muted"
                            >
                              <WhatsAppTemplateSuspense>
                                <WhatsAppCampaignPage />
                              </WhatsAppTemplateSuspense>
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/operations/consultant/whatsapp/templates"
                          element={<Navigate to="/omnichannel/campaign/templates" replace />}
                        />
                        <Route
                          path="/omnichannel/campaign/templates"
                          element={
                            <PageAccessGuard
                              pagePath="/omnichannel/campaign/templates"
                              loadingShell={PAGE_GUARD_LOADING_SHELL}
                              loadingShellWrapperClassName="bg-surface-muted"
                            >
                              <WhatsAppTemplateSuspense>
                                <WhatsAppTemplatePage />
                              </WhatsAppTemplateSuspense>
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/kol-management/dashboard"
                          element={
                            <PageAccessGuard
                              pagePath="/kol-management/dashboard"
                              preserveAppChromeOnDeny
                              loadingShell={PAGE_GUARD_LOADING_SHELL}
                              loadingShellWrapperClassName="bg-gray-100"
                            >
                              <KolManagementDashboardSuspense>
                                <KolManagementDashboardPage />
                              </KolManagementDashboardSuspense>
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/kol-management/kol-management"
                          element={
                            <PageAccessGuard
                              pagePath="/kol-management/kol-management"
                              preserveAppChromeOnDeny
                              loadingShell={PAGE_GUARD_LOADING_SHELL}
                              loadingShellWrapperClassName="bg-gray-100"
                            >
                              <KolManagementKolManagementSuspense>
                                <KolManagementDashboardPage />
                              </KolManagementKolManagementSuspense>
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/kol-management/campaigns"
                          element={
                            <PageAccessGuard
                              pagePath="/kol-management/campaigns"
                              preserveAppChromeOnDeny
                              loadingShell={PAGE_GUARD_LOADING_SHELL}
                              loadingShellWrapperClassName="bg-gray-100"
                            >
                              <KolManagementCampaignsSuspense>
                                <KolManagementDashboardPage />
                              </KolManagementCampaignsSuspense>
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/kol-management/content-post"
                          element={
                            <PageAccessGuard
                              pagePath="/kol-management/content-post"
                              preserveAppChromeOnDeny
                              loadingShell={PAGE_GUARD_LOADING_SHELL}
                              loadingShellWrapperClassName="bg-gray-100"
                            >
                              <KolManagementContentPostSuspense>
                                <KolManagementDashboardPage />
                              </KolManagementContentPostSuspense>
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/kol-management/payment-terms"
                          element={
                            <PageAccessGuard
                              pagePath="/kol-management/payment-terms"
                              preserveAppChromeOnDeny
                              loadingShell={PAGE_GUARD_LOADING_SHELL}
                              loadingShellWrapperClassName="bg-gray-100"
                            >
                              <KolManagementPaymentTermsSuspense>
                                <KolManagementDashboardPage />
                              </KolManagementPaymentTermsSuspense>
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/digital-marketing/social-media"
                          element={<Navigate to="/digital-marketing/social-media/dashboard" replace />}
                        />
                        <Route
                          path="/digital-marketing/social-media/dashboard"
                          element={
                            <PageAccessGuard
                              pagePath="/digital-marketing/social-media"
                              preserveAppChromeOnDeny
                              loadingShell={PAGE_GUARD_LOADING_SHELL}
                              loadingShellWrapperClassName="bg-gray-100"
                            >
                              <SocialMediaDashboardSuspense>
                                <SocialMediaDashboardPage />
                              </SocialMediaDashboardSuspense>
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/digital-marketing/social-media/content-calendar"
                          element={
                            <PageAccessGuard
                              pagePath="/digital-marketing/social-media"
                              preserveAppChromeOnDeny
                              loadingShell={PAGE_GUARD_LOADING_SHELL}
                              loadingShellWrapperClassName="bg-gray-100"
                            >
                              <ContentCalendarSuspense>
                                <SocialMediaContentCalendarPage />
                              </ContentCalendarSuspense>
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/digital-marketing/social-media/product-knowledge"
                          element={
                            <PageAccessGuard
                              pagePath="/digital-marketing/social-media"
                              preserveAppChromeOnDeny
                              loadingShell={PAGE_GUARD_LOADING_SHELL}
                              loadingShellWrapperClassName="bg-gray-100"
                            >
                              <SocialMediaProductKnowledgeSuspense>
                                <SocialMediaProductKnowledgePage />
                              </SocialMediaProductKnowledgeSuspense>
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/digital-marketing/social-media/script-generator"
                          element={
                            <PageAccessGuard
                              pagePath="/digital-marketing/social-media"
                              preserveAppChromeOnDeny
                              loadingShell={PAGE_GUARD_LOADING_SHELL}
                              loadingShellWrapperClassName="bg-gray-100"
                            >
                              <SocialMediaScriptGeneratorSuspense>
                                <SocialMediaScriptGeneratorPage />
                              </SocialMediaScriptGeneratorSuspense>
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/digital-marketing/social-media/settings"
                          element={
                            <PageAccessGuard
                              pagePath="/digital-marketing/social-media"
                              preserveAppChromeOnDeny
                              loadingShell={PAGE_GUARD_LOADING_SHELL}
                              loadingShellWrapperClassName="bg-muted/40"
                            >
                              <SocialMediaSettingsSuspense>
                                <SocialMediaDmSettingsPage />
                              </SocialMediaSettingsSuspense>
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/digital-marketing/traffic"
                          element={
                            <PageAccessGuard
                              pagePath="/digital-marketing/traffic"
                              loadingShell={
                                <TrafficMobileAwareLoadingShell />
                              }
                              loadingShellWrapperClassName="bg-gray-100"
                            >
                              <TrafficMobileAwareRouteElement />
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/digital-marketing/google-ads/settings"
                          element={
                            <PageAccessGuard
                              pagePath="/digital-marketing/google-ads"
                              loadingShell={<GoogleAdsMetricsPageSkeleton />}
                              loadingShellWrapperClassName="bg-gray-100"
                            >
                              <GoogleAdsMetricsPageRouteElement />
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/digital-marketing/google-ads"
                          element={
                            <PageAccessGuard
                              pagePath="/digital-marketing/google-ads"
                              loadingShell={<GoogleAdsMetricsPageSkeleton />}
                              loadingShellWrapperClassName="bg-gray-100"
                            >
                              <GoogleAdsMetricsPageRouteElement />
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/digital-marketing/meta-ads/settings"
                          element={
                            <PageAccessGuard
                              pagePath="/digital-marketing/meta-ads"
                              loadingShell={<MetaAdsMetricsPageSkeleton />}
                              loadingShellWrapperClassName="bg-gray-100"
                            >
                              <MetaAdsMetricsPageRouteElement />
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/digital-marketing/meta-ads"
                          element={
                            <PageAccessGuard
                              pagePath="/digital-marketing/meta-ads"
                              loadingShell={<MetaAdsMetricsPageSkeleton />}
                              loadingShellWrapperClassName="bg-gray-100"
                            >
                              <MetaAdsMetricsPageRouteElement />
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/recruitment"
                          element={
                            <HrManagementRoleGuard
                              showPendingSkeleton={false}
                              deniedTitleKey="recruitment.accessDenied.title"
                              deniedDescriptionKey="recruitment.accessDenied.description"
                              deniedBackLabelKey="recruitment.accessDenied.back"
                              deniedNavigateTo="/"
                            >
                              <RecruitmentDashboardOverviewPage />
                            </HrManagementRoleGuard>
                          }
                        />
                        <Route
                          path="/recruitment/job-openings"
                          element={
                            <HrManagementRoleGuard
                              showPendingSkeleton={false}
                              deniedTitleKey="recruitment.accessDenied.title"
                              deniedDescriptionKey="recruitment.accessDenied.description"
                              deniedBackLabelKey="recruitment.accessDenied.back"
                              deniedNavigateTo="/"
                            >
                              <RecruitmentJobOpeningsPage />
                            </HrManagementRoleGuard>
                          }
                        />
                        <Route
                          path="/recruitment/applications"
                          element={
                            <HrManagementRoleGuard
                              showPendingSkeleton={false}
                              deniedTitleKey="recruitment.accessDenied.title"
                              deniedDescriptionKey="recruitment.accessDenied.description"
                              deniedBackLabelKey="recruitment.accessDenied.back"
                              deniedNavigateTo="/"
                            >
                              <RecruitmentApplicationsPageWrapper />
                            </HrManagementRoleGuard>
                          }
                        />
                        <Route
                          path="/recruitment/interviewees"
                          element={
                            <HrManagementRoleGuard
                              showPendingSkeleton={false}
                              deniedTitleKey="recruitment.accessDenied.title"
                              deniedDescriptionKey="recruitment.accessDenied.description"
                              deniedBackLabelKey="recruitment.accessDenied.back"
                              deniedNavigateTo="/"
                            >
                              <RecruitmentIntervieweesPage />
                            </HrManagementRoleGuard>
                          }
                        />
                        <Route
                          path="/recruitment/candidates/:id"
                          element={
                            <HrManagementRoleGuard
                              deniedTitleKey="recruitment.accessDenied.title"
                              deniedDescriptionKey="recruitment.accessDenied.description"
                              deniedBackLabelKey="recruitment.accessDenied.back"
                              deniedNavigateTo="/"
                            >
                              <RecruitmentSuspense>
                                <RecruitmentCandidateProfileHr />
                              </RecruitmentSuspense>
                            </HrManagementRoleGuard>
                          }
                        />
                        <Route element={<SubscriptionRoleGuard />}>
                          <Route path="/subscription" element={<Navigate to="/subscription/overview" replace />} />
                          <Route path="/subscription/overview" element={<SubscriptionOverviewRouteElement />} />
                          <Route path="/subscription/plans" element={<SubscriptionPlansRouteElement />} />
                          <Route path="/subscription/management" element={<SubscriptionManagementRouteElement />} />
                        </Route>
                      </Route>
                      <Route
                        path="/employees/add"
                        element={
                          <PageAccessGuard
                            pagePath="/employees/add"
                            loadingShell={PAGE_GUARD_LOADING_SHELL}
                            loadingShellWrapperClassName="bg-gray-50"
                          >
                            <AddEmployeePage />
                          </PageAccessGuard>
                        }
                      />
                      <Route path="/create-organization" element={<CreateOrganizationRouteElement />} />
                      <Route path="/create-plan" element={<CreatePlanRouteElement />} />
                      <Route path="/employee-welcome" element={<EmployeeWelcomeRouteElement />} />
                    </Route>
                  </Route>

                  <Route path="*" element={<NotFound />} />
                    </Routes>
                  </Suspense>
                </div>
              </LanguageProvider>
              </BrowserRouter>
              </CurrentOrgProvider>
            </PermissionConfigurationProvider>
          </CentralizedUserDataProvider>
          </div>
        </AuthProvider>
      </div>
      </MobileAppNavSuppressionProvider>
      </CapacitorKeyboardInsetProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;


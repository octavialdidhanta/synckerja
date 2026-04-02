import { lazy, Suspense, type ReactNode } from "react";
import { RequestFormPageSkeleton } from "@/9-request-form/components/RequestFormPageSkeleton";
import { PageAccessGuard } from "@/shared/components/PageAccessGuard";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/shared/components/ui/sonner";
import { Toaster } from "@/shared/components/ui/toaster";
import { TooltipProvider } from "@/shared/components/ui/tooltip";
import { RequireAuth } from "@/shared/components/RequireAuth";
import { AppShellLayout } from "@/shared/layouts";
import NotFound from "@/shared/pages/NotFound";
import { ForgotPasswordPage, LoginPage, ResetPasswordPage } from "@/0-auth";
import { OKRPage } from "@/1-OKR";
import { ModernHomePage, SettingsPage, TransferOwnershipPage } from "@/1-home";
import { ProfileSettings, SecuritySettings } from "@/1-home/settings";
import { RegisterPage, VerifyEmailPage, EmailVerifiedPage } from "@/0-register/index.ts";
import {
  CreateOrganizationPage,
  CreatePlanPage,
  EmployeeWelcomePage,
  TermsAndConditionsPage,
} from "@/0-onboarding/index.ts";
import {
  ManagementPage,
  OverviewPage,
  PlansPage,
  SubscriptionExpiryGuard,
  SubscriptionRoleGuard,
} from "@/10-subscription";
import { AuthProvider } from "@/shared/auth/contexts/AuthContext";
import { CentralizedUserDataProvider } from "@/shared/auth/contexts/CentralizedUserDataContext";
import { CurrentOrgProvider } from "@/shared/auth/contexts/CurrentOrgContext";
import { PermissionConfigurationProvider } from "@/shared/auth/page-access/usePermissionConfiguration";
import EmployeePage from "@/2-1-employees/EmployeePage";
import { ReprimandManagementPage } from "@/2-1-reprimand";
import { HrManagementRoleGuard } from "@/shared/components/HrManagementRoleGuard";
import AddEmployeePage from "@/2-1-employees/add-employee/AddEmployeePage";
import EmployeePersonalInfo from "@/2-1-employees/MyInfo/PersonalInformation/pages/EmployeePersonalInfo";
import EmployeeAddressInfo from "@/2-1-employees/MyInfo/AddressInformation/pages/EmployeeAddressInfo";
import EmployeeEmploymentInfo from "@/2-1-employees/MyInfo/Employment/pages/EmployeeEmploymentInfo";
import EmployeeEducationFormal from "@/2-1-employees/MyInfo/Education/pages/EmployeeEducationFormal";
import EmployeeEducationInformal from "@/2-1-employees/MyInfo/InformalEducation/pages/EmployeeEducationInformal";
import EmployeeWork from "@/2-1-employees/MyInfo/WorkExperience/pages/EmployeeWork";
import EmployeeFamily from "@/2-1-employees/MyInfo/FamilyMembers/pages/EmployeeFamily";
import EmployeeAttendance from "@/2-1-employees/MyInfo/Attendance/pages/EmployeeAttendance";
import EmployeeLeavePermit from "@/2-1-employees/MyInfo/LeavePermit/pages/EmployeeLeavePermit";
import EmployeeDocuments from "@/2-1-employees/MyInfo/Documents/pages/EmployeeDocuments";
import EmployeePayroll from "@/2-1-employees/MyInfo/Payroll/pages/EmployeePayroll";
import {
  ApplicationsPageWrapper as RecruitmentApplicationsPageWrapper,
  DashboardOverview as RecruitmentDashboardOverviewPage,
  IntervieweesPage as RecruitmentIntervieweesPage,
  JobOpeningsPage as RecruitmentJobOpeningsPage,
} from "@/2-2-recruitment-dashboard";
import { RecruitmentRouteSkeleton } from "@/2-2-recruitment-dashboard/components/RecruitmentSkeletons";
import { AttendancePage } from "@/2-3-attendance/AttendancePage";
import { AttendanceGuardLoadingShell } from "@/2-3-attendance/components/AttendanceSkeletons";
import { PayrollRouteSkeleton } from "@/2-4-payroll/components/PayrollRouteSkeleton";
import CompanyCompanyAssetsPage from "@/2-8-company-assets/pages/CompanyCompanyAssetsPage";
import CompanyFilesPage from "@/2-8-files/pages/CompanyFilesPage";
import CompanyOrganizationPage from "@/2-8-organization/pages/CompanyOrganizationPage";
import { OrganizationGuardLoadingShell } from "@/2-8-organization/components/OrganizationPageSkeleton";
import PayrollCalculationsPage from "@/2-4-payroll/pages/PayrollCalculationsPageWrapper";
import {
  CompanyAssetsGuardLoadingShell,
  CompanyFilesGuardLoadingShell,
} from "@/2-8-dashboard/skeletons/CompanyPageSkeletons";
import { CompanyRouteSkeleton } from "@/2-8-dashboard/skeletons/CompanyRouteSkeleton";
import { AccessPermissionsPageSkeleton } from "@/2-9-PageAccess/skeletons/AccessPermissionsPageSkeleton";
import { IncomeDashboardSkeleton } from "@/4-1-dashboard/skeletons/IncomeDashboardSkeleton";
import { IncomeTransactionSkeleton } from "@/4-1-transaction/components/IncomeTransactionSkeleton";
import { ExpenseDashboardSkeleton } from "@/4-2-dashboard/skeletons/ExpenseDashboardSkeleton";
import { DebtPageSkeleton } from "@/4-2-debt/skeletons/DebtPageSkeleton";
import { ApprovalsPageSkeleton } from "@/4-2-approvals/skeletons/ApprovalsPageSkeleton";
import { PaymentProcessPageSkeleton } from "@/4-2-payment-process/skeletons/PaymentProcessPageSkeleton";
import { ReminderBillsPageSkeleton } from "@/4-2-reminder-bills/skeletons/ReminderBillsPageSkeleton";
import { DailyTaskPageSkeleton } from "@/8-2-DailyTask/skeletons/DailyTaskPageSkeleton";
import { DailyTaskReportPageSkeleton } from "@/8-2-DailyTaskReport/skeletons/DailyTaskReportPageSkeleton";
import { HabitTrackerPageSkeleton } from "@/8-2-HabitTracker/skeletons/HabitTrackerPageSkeleton";
import { MeetingNotesPageSkeleton } from "@/8-1-meeting-notes/skeletons/MeetingNotesPageSkeleton";

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

const IncomeDashboardPage = lazy(() => import("@/4-1-dashboard/pages/IncomeDashboardPage"));
const IncomeTransactionShellPage = lazy(() => import("@/4-1-transaction/pages/IncomeTransactionShellPage"));

const ExpenseDashboardPage = lazy(() => import("@/4-2-dashboard/pages/ExpenseDashboardPage"));
const ExpenseDebtPage = lazy(() => import("@/4-2-debt/pages/DebtPage"));
const ExpenseApprovalsPage = lazy(() => import("@/4-2-approvals/pages/ApprovalsPage"));
const ExpensePaymentProcessPage = lazy(() => import("@/4-2-payment-process/pages/PaymentProcessPage"));
const ExpenseReminderBillsPage = lazy(() => import("@/4-2-reminder-bills/pages/ReminderBillsPage"));

const DailyTaskPage = lazy(() => import("@/8-2-DailyTask/pages/DailyTaskPage"));
const DailyTaskReportPage = lazy(() => import("@/8-2-DailyTaskReport/pages/DailyTaskReportPage"));
const HabitTrackerPage = lazy(() => import("@/8-2-HabitTracker/pages/HabitTrackerPage"));
const MeetingNotesToolPage = lazy(() => import("@/8-1-meeting-notes/pages/MeetingNotesPage"));

const IncomeDashboardSuspense = ({ children }: { children: ReactNode }) => (
  <Suspense
    fallback={
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-gray-100" aria-busy>
        <IncomeDashboardSkeleton />
      </div>
    }
  >
    {children}
  </Suspense>
);

const IncomeTransactionSuspense = ({ children }: { children: ReactNode }) => (
  <Suspense
    fallback={
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-gray-100" aria-busy>
        <IncomeTransactionSkeleton />
      </div>
    }
  >
    {children}
  </Suspense>
);

const ExpenseDashboardSuspense = ({ children }: { children: ReactNode }) => (
  <Suspense
    fallback={
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-gray-100" aria-busy>
        <ExpenseDashboardSkeleton />
      </div>
    }
  >
    {children}
  </Suspense>
);

const ExpenseDebtSuspense = ({ children }: { children: ReactNode }) => (
  <Suspense
    fallback={
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-gray-100" aria-busy>
        <DebtPageSkeleton />
      </div>
    }
  >
    {children}
  </Suspense>
);

const ExpenseApprovalsSuspense = ({ children }: { children: ReactNode }) => (
  <Suspense
    fallback={
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-gray-100" aria-busy>
        <ApprovalsPageSkeleton />
      </div>
    }
  >
    {children}
  </Suspense>
);

const ExpensePaymentProcessSuspense = ({ children }: { children: ReactNode }) => (
  <Suspense
    fallback={
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-gray-100" aria-busy>
        <PaymentProcessPageSkeleton />
      </div>
    }
  >
    {children}
  </Suspense>
);

const ExpenseReminderBillsSuspense = ({ children }: { children: ReactNode }) => (
  <Suspense
    fallback={
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-gray-100" aria-busy>
        <ReminderBillsPageSkeleton />
      </div>
    }
  >
    {children}
  </Suspense>
);

const DailyTaskSuspense = ({ children }: { children: ReactNode }) => (
  <Suspense
    fallback={
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-gray-100" aria-busy>
        <DailyTaskPageSkeleton />
      </div>
    }
  >
    {children}
  </Suspense>
);

const DailyTaskReportSuspense = ({ children }: { children: ReactNode }) => (
  <Suspense
    fallback={
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-gray-100" aria-busy>
        <DailyTaskReportPageSkeleton />
      </div>
    }
  >
    {children}
  </Suspense>
);

const MeetingNotesSuspense = ({ children }: { children: ReactNode }) => (
  <Suspense
    fallback={
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-gray-100" aria-busy>
        <MeetingNotesPageSkeleton />
      </div>
    }
  >
    {children}
  </Suspense>
);

const HabitTrackerSuspense = ({ children }: { children: ReactNode }) => (
  <Suspense
    fallback={
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-gray-100" aria-busy>
        <HabitTrackerPageSkeleton />
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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      /** Satu siklus fetch per query saat load; hindari refetch kedua saat tab online lagi / remount. */
      refetchOnReconnect: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <Toaster />
        <Sonner />
        <AuthProvider>
          <CentralizedUserDataProvider>
            <PermissionConfigurationProvider>
              <CurrentOrgProvider>
              <BrowserRouter
                future={{
                  v7_relativeSplatPath: true,
                  v7_startTransition: true,
                }}
              >
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                  <Routes>
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                  <Route path="/reset-password" element={<ResetPasswordPage />} />
                  <Route path="/register" element={<RegisterPage />} />
                  <Route path="/verify-email" element={<VerifyEmailPage />} />
                  <Route path="/email-verified" element={<EmailVerifiedPage />} />
                  <Route path="/terms-and-conditions" element={<TermsAndConditionsPage />} />

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

                  <Route element={<RequireAuth />}>
                    <Route element={<SubscriptionExpiryGuard />}>
                      <Route element={<AppShellLayout />}>
                        <Route path="/" element={<ModernHomePage />} />
                        <Route path="/settings" element={<SettingsPage />}>
                          <Route index element={<ProfileSettings />} />
                          <Route path="profile" element={<ProfileSettings />} />
                          <Route path="security" element={<SecuritySettings />} />
                        </Route>
                        <Route path="/transfer-ownership" element={<TransferOwnershipPage />} />
                        <Route path="/okr" element={<Navigate to="/okr/company-objective" replace />} />
                        <Route path="/okr/*" element={<OKRPage />} />
                        <Route path="/employees" element={<EmployeePage />} />
                        <Route
                          path="/employees/reprimand"
                          element={
                            <HrManagementRoleGuard showPendingSkeleton={false}>
                              <ReprimandManagementPage />
                            </HrManagementRoleGuard>
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
                            <PageAccessGuard loadingShell={<AttendanceGuardLoadingShell />}>
                              <AttendancePage />
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/attendance/attendance"
                          element={
                            <PageAccessGuard loadingShell={<AttendanceGuardLoadingShell />}>
                              <AttendancePage />
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/attendance/settings"
                          element={
                            <PageAccessGuard loadingShell={<AttendanceGuardLoadingShell />}>
                              <AttendancePage />
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/access-permissions"
                          element={
                            <PageAccessGuard requiresPermissions={false}>
                              <AccessPermissionsSuspense>
                                <AccessPermissionsConfig />
                              </AccessPermissionsSuspense>
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/access-permissions/page-access"
                          element={
                            <PageAccessGuard requiresPermissions={false}>
                              <AccessPermissionsSuspense>
                                <AccessPermissionsConfig />
                              </AccessPermissionsSuspense>
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/access-permissions/overview"
                          element={
                            <PageAccessGuard requiresPermissions={false}>
                              <AccessPermissionsSuspense>
                                <AccessPermissionsConfig />
                              </AccessPermissionsSuspense>
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/access-permissions/roles"
                          element={
                            <PageAccessGuard requiresPermissions={false}>
                              <AccessPermissionsSuspense>
                                <AccessPermissionsConfig />
                              </AccessPermissionsSuspense>
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/access-permissions/pages"
                          element={
                            <PageAccessGuard requiresPermissions={false}>
                              <AccessPermissionsSuspense>
                                <AccessPermissionsConfig />
                              </AccessPermissionsSuspense>
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/payroll/calculations"
                          element={
                            <PageAccessGuard loadingShell={<PayrollRouteSkeleton />}>
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
                            <PageAccessGuard loadingShell={<CompanyAssetsGuardLoadingShell />}>
                              <CompanyCompanyAssetsPage />
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/company/files"
                          element={
                            <PageAccessGuard loadingShell={<CompanyFilesGuardLoadingShell />}>
                              <CompanyFilesPage />
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/company/organization"
                          element={
                            <PageAccessGuard loadingShell={<OrganizationGuardLoadingShell />}>
                              <CompanyOrganizationPage />
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/incomes/dashboard"
                          element={
                            <PageAccessGuard
                              pagePath="/incomes/dashboard"
                              loadingShell={<IncomeDashboardSkeleton />}
                            >
                              <IncomeDashboardSuspense>
                                <IncomeDashboardPage />
                              </IncomeDashboardSuspense>
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/incomes/transaction"
                          element={
                            <PageAccessGuard
                              pagePath="/incomes/transaction"
                              loadingShell={<IncomeTransactionSkeleton />}
                            >
                              <IncomeTransactionSuspense>
                                <IncomeTransactionShellPage />
                              </IncomeTransactionSuspense>
                            </PageAccessGuard>
                          }
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
                              loadingShell={<ExpenseDashboardSkeleton />}
                            >
                              <ExpenseDashboardSuspense>
                                <ExpenseDashboardPage />
                              </ExpenseDashboardSuspense>
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/expenses/debt"
                          element={
                            <PageAccessGuard
                              pagePath="/expenses/debt"
                              loadingShell={<DebtPageSkeleton />}
                            >
                              <ExpenseDebtSuspense>
                                <ExpenseDebtPage />
                              </ExpenseDebtSuspense>
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/expenses/approvals"
                          element={
                            <PageAccessGuard
                              pagePath="/expenses/approvals"
                              loadingShell={<ApprovalsPageSkeleton />}
                            >
                              <ExpenseApprovalsSuspense>
                                <ExpenseApprovalsPage />
                              </ExpenseApprovalsSuspense>
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/expenses/payment-process"
                          element={
                            <PageAccessGuard
                              pagePath="/expenses/payment-process"
                              loadingShell={<PaymentProcessPageSkeleton />}
                            >
                              <ExpensePaymentProcessSuspense>
                                <ExpensePaymentProcessPage />
                              </ExpensePaymentProcessSuspense>
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/expenses/reminder-bills"
                          element={
                            <PageAccessGuard
                              pagePath="/expenses/reminder-bills"
                              loadingShell={<ReminderBillsPageSkeleton />}
                            >
                              <ExpenseReminderBillsSuspense>
                                <ExpenseReminderBillsPage />
                              </ExpenseReminderBillsSuspense>
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
                            <PageAccessGuard pagePath="/tools/daily-task" loadingShell={<DailyTaskPageSkeleton />}>
                              <DailyTaskSuspense>
                                <DailyTaskPage />
                              </DailyTaskSuspense>
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/tools/daily-task-report"
                          element={
                            <PageAccessGuard pagePath="/tools/daily-task-report" loadingShell={<DailyTaskReportPageSkeleton />}>
                              <DailyTaskReportSuspense>
                                <DailyTaskReportPage />
                              </DailyTaskReportSuspense>
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/tools/meeting-notes"
                          element={
                            <PageAccessGuard pagePath="/tools/meeting-notes" loadingShell={<MeetingNotesPageSkeleton />}>
                              <MeetingNotesSuspense>
                                <MeetingNotesToolPage />
                              </MeetingNotesSuspense>
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/tools/habits-tracker"
                          element={
                            <PageAccessGuard pagePath="/tools/habits-tracker" loadingShell={<HabitTrackerPageSkeleton />}>
                              <HabitTrackerSuspense>
                                <HabitTrackerPage />
                              </HabitTrackerSuspense>
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
                          <Route path="/subscription/overview" element={<OverviewPage />} />
                          <Route path="/subscription/plans" element={<PlansPage />} />
                          <Route path="/subscription/management" element={<ManagementPage />} />
                        </Route>
                      </Route>
                      <Route path="/employees/add" element={<AddEmployeePage />} />
                      <Route path="/create-organization" element={<CreateOrganizationPage />} />
                      <Route path="/create-plan" element={<CreatePlanPage />} />
                      <Route path="/employee-welcome" element={<EmployeeWelcomePage />} />
                    </Route>
                  </Route>

                  <Route path="*" element={<NotFound />} />
                  </Routes>
                </div>
              </BrowserRouter>
              </CurrentOrgProvider>
            </PermissionConfigurationProvider>
          </CentralizedUserDataProvider>
        </AuthProvider>
      </div>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;


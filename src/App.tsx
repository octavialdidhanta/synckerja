import { lazy, Suspense, type ReactNode } from "react";
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
import { ModulePlaceholderPage } from "@/shared/pages/ModulePlaceholderPage";
import { RecruitmentRouteSkeleton } from "@/2-2-recruitment-dashboard/components/RecruitmentSkeletons";
import { AttendanceRouteSkeleton } from "@/2-3-attendance/components/AttendanceSkeletons";

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

const AttendanceSuspense = ({ children }: { children: ReactNode }) => (
  <Suspense
    fallback={
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col" aria-busy>
        <AttendanceRouteSkeleton />
      </div>
    }
  >
    {children}
  </Suspense>
);

const RecruitmentDashboardOverview = lazy(() => import("@/2-2-recruitment-dashboard/dashboard/DashboardOverview"));
const RecruitmentJobOpeningsPage = lazy(() => import("@/2-2-recruitment-dashboard/dashboard/JobOpeningsPage"));
const RecruitmentApplicationsPageWrapper = lazy(
  () => import("@/2-2-recruitment-dashboard/dashboard/ApplicationsPageWrapper"),
);
const RecruitmentIntervieweesPage = lazy(() => import("@/2-2-recruitment-dashboard/interviewees/IntervieweesPage"));
const RecruitmentCandidateProfileHr = lazy(
  () => import("@/2-2-recruitment-dashboard/interviewees/CandidateProfile"),
);

const AttendancePage = lazy(() => import("@/2-3-attendance/AttendancePage"));
const AccessPermissionsConfig = lazy(
  () =>
    import("@/2-9-PageAccess/component/AccessPermissionsPage").then((m) => ({
      default: m.AccessPermissionsConfig,
    })),
);
const PageAccessTab = lazy(() =>
  import("@/2-9-PageAccess/PageAccessTab").then((m) => ({ default: m.PageAccessTab })),
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

const queryClient = new QueryClient();

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
                            <HrManagementRoleGuard>
                              <ReprimandManagementPage />
                            </HrManagementRoleGuard>
                          }
                        />
                        <Route path="/employees/add" element={<AddEmployeePage />} />
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
                            <PageAccessGuard>
                              <AttendanceSuspense>
                                <AttendancePage />
                              </AttendanceSuspense>
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/attendance/attendance"
                          element={
                            <PageAccessGuard>
                              <AttendanceSuspense>
                                <AttendancePage />
                              </AttendanceSuspense>
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/attendance/settings"
                          element={
                            <PageAccessGuard>
                              <AttendanceSuspense>
                                <AttendancePage />
                              </AttendanceSuspense>
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/access-permissions"
                          element={
                            <PageAccessGuard requiresPermissions={false}>
                              <Suspense fallback={<div className="p-8">Loading…</div>}>
                                <AccessPermissionsConfig />
                              </Suspense>
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/access-permissions/page-access"
                          element={
                            <PageAccessGuard requiresPermissions={false}>
                              <Suspense fallback={<div className="p-8">Loading…</div>}>
                                <PageAccessTab />
                              </Suspense>
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/access-permissions/overview"
                          element={
                            <PageAccessGuard requiresPermissions={false}>
                              <Suspense fallback={<div className="p-8">Loading…</div>}>
                                <AccessPermissionsConfig />
                              </Suspense>
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/access-permissions/roles"
                          element={
                            <PageAccessGuard requiresPermissions={false}>
                              <Suspense fallback={<div className="p-8">Loading…</div>}>
                                <AccessPermissionsConfig />
                              </Suspense>
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/access-permissions/pages"
                          element={
                            <PageAccessGuard requiresPermissions={false}>
                              <Suspense fallback={<div className="p-8">Loading…</div>}>
                                <AccessPermissionsConfig />
                              </Suspense>
                            </PageAccessGuard>
                          }
                        />
                        <Route
                          path="/payroll"
                          element={<ModulePlaceholderPage titleKey="layout.placeholder.payrollTitle" />}
                        />
                        <Route
                          path="/recruitment"
                          element={
                            <HrManagementRoleGuard
                              deniedTitleKey="recruitment.accessDenied.title"
                              deniedDescriptionKey="recruitment.accessDenied.description"
                              deniedBackLabelKey="recruitment.accessDenied.back"
                              deniedNavigateTo="/"
                            >
                              <RecruitmentSuspense>
                                <RecruitmentDashboardOverview />
                              </RecruitmentSuspense>
                            </HrManagementRoleGuard>
                          }
                        />
                        <Route
                          path="/recruitment/job-openings"
                          element={
                            <HrManagementRoleGuard
                              deniedTitleKey="recruitment.accessDenied.title"
                              deniedDescriptionKey="recruitment.accessDenied.description"
                              deniedBackLabelKey="recruitment.accessDenied.back"
                              deniedNavigateTo="/"
                            >
                              <RecruitmentSuspense>
                                <RecruitmentJobOpeningsPage />
                              </RecruitmentSuspense>
                            </HrManagementRoleGuard>
                          }
                        />
                        <Route
                          path="/recruitment/applications"
                          element={
                            <HrManagementRoleGuard
                              deniedTitleKey="recruitment.accessDenied.title"
                              deniedDescriptionKey="recruitment.accessDenied.description"
                              deniedBackLabelKey="recruitment.accessDenied.back"
                              deniedNavigateTo="/"
                            >
                              <RecruitmentSuspense>
                                <RecruitmentApplicationsPageWrapper />
                              </RecruitmentSuspense>
                            </HrManagementRoleGuard>
                          }
                        />
                        <Route
                          path="/recruitment/interviewees"
                          element={
                            <HrManagementRoleGuard
                              deniedTitleKey="recruitment.accessDenied.title"
                              deniedDescriptionKey="recruitment.accessDenied.description"
                              deniedBackLabelKey="recruitment.accessDenied.back"
                              deniedNavigateTo="/"
                            >
                              <RecruitmentSuspense>
                                <RecruitmentIntervieweesPage />
                              </RecruitmentSuspense>
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


import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/shared/components/ui/sonner";
import { Toaster } from "@/shared/components/ui/toaster";
import { TooltipProvider } from "@/shared/components/ui/tooltip";
import { RequireAuth } from "@/shared/components/RequireAuth";
import { AppShellLayout } from "@/shared/layouts";
import NotFound from "@/shared/pages/NotFound";
import { ForgotPasswordPage, LoginPage, ResetPasswordPage } from "@/0-auth";
import { DashboardPage, SettingsPage, TransferOwnershipPage } from "@/1-home";
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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <Toaster />
        <Sonner />
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

              <Route element={<RequireAuth />}>
                <Route element={<SubscriptionExpiryGuard />}>
                  <Route element={<AppShellLayout />}>
                    <Route path="/" element={<DashboardPage />} />
                    <Route path="/settings" element={<SettingsPage />}>
                      <Route index element={<ProfileSettings />} />
                      <Route path="profile" element={<ProfileSettings />} />
                      <Route path="security" element={<SecuritySettings />} />
                    </Route>
                    <Route path="/transfer-ownership" element={<TransferOwnershipPage />} />
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
      </div>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

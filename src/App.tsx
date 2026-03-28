import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/shared/components/ui/sonner";
import { Toaster } from "@/shared/components/ui/toaster";
import { TooltipProvider } from "@/shared/components/ui/tooltip";
import { RequireAuth } from "@/shared/components/RequireAuth";
import NotFound from "@/shared/pages/NotFound";
import { ForgotPasswordPage, LoginPage, ResetPasswordPage } from "@/0-auth";
import { DashboardPage, SettingsPage } from "@/1-home";
import { RegisterPage, VerifyEmailPage, EmailVerifiedPage } from "@/0-register/index.ts";
import {
  CreateOrganizationPage,
  CreatePlanPage,
  EmployeeWelcomePage,
  TermsAndConditionsPage,
} from "@/0-onboarding/index.ts";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter
        future={{
          v7_relativeSplatPath: true,
          v7_startTransition: true,
        }}
      >
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/email-verified" element={<EmailVerifiedPage />} />
          <Route path="/terms-and-conditions" element={<TermsAndConditionsPage />} />

          <Route element={<RequireAuth />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/create-organization" element={<CreateOrganizationPage />} />
            <Route path="/create-plan" element={<CreatePlanPage />} />
            <Route path="/employee-welcome" element={<EmployeeWelcomePage />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import i18n from "@/shared/i18n/index.ts";
import { SurveyPublicRoutes } from "@/features/customer-survey/public/SurveyPublicRoutes";
import { BrowserRouter } from "react-router-dom";

const surveyQueryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1 } },
});

/** Hostname-only mini-app for public CES survey links (`/s/:token`). */
export function SurveyPublicApp() {
  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={surveyQueryClient}>
        <BrowserRouter>
          <SurveyPublicRoutes />
        </BrowserRouter>
      </QueryClientProvider>
    </I18nextProvider>
  );
}

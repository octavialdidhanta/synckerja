import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SurveyPublicRoutes } from "@/features/customer-survey/public/SurveyPublicRoutes";
import { BrowserRouter } from "react-router-dom";

const surveyQueryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1 } },
});

/** Hostname-only mini-app for public CES survey links (`/s/:token`). Expects `I18nextProvider` from `main.tsx`. */
export function SurveyPublicApp() {
  return (
    <QueryClientProvider client={surveyQueryClient}>
      <BrowserRouter>
        <SurveyPublicRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

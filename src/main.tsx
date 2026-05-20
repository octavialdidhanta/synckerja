import { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import { initI18n } from "@/shared/i18n/index.ts";
import { RouteSkeletonBootShell } from "@/shared/components/route-loading/createDeferredSkeleton";
import "./index.css";

const App = lazy(() => import("./App.tsx"));

const SurveyPublicApp = lazy(() =>
  import("@/features/customer-survey/public/SurveyPublicApp.tsx").then((m) => ({
    default: m.SurveyPublicApp,
  })),
);

function deferRegisterServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  const register = () => {
    import("virtual:pwa-register")
      .then(({ registerSW }) => {
        registerSW({ immediate: false });
      })
      .catch(() => undefined);
  };

  window.addEventListener(
    "load",
    () => {
      if ("requestIdleCallback" in window) {
        (window as Window & { requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => void }).requestIdleCallback(
          register,
          { timeout: 2000 },
        );
      } else {
        window.setTimeout(register, 800);
      }
    },
    { once: true },
  );
}

deferRegisterServiceWorker();

const surveyHost = import.meta.env.VITE_PUBLIC_SURVEY_HOSTNAME?.trim();
const rootEl = document.getElementById("root")!;

const preferFastI18nBoot =
  typeof window !== "undefined" &&
  /^\/(?:login|register|forgot-password|reset-password|verify-email|email-verified|terms-and-conditions)(?:\/|$)/.test(
    window.location.pathname,
  );

void initI18n({ preferFastBoot: preferFastI18nBoot }).then((i18n) => {
  const isSurveyHost =
    typeof window !== "undefined" &&
    surveyHost &&
    window.location.hostname.toLowerCase() === surveyHost.toLowerCase();

  createRoot(rootEl).render(
    <I18nextProvider i18n={i18n}>
      <Suspense fallback={<RouteSkeletonBootShell className="min-h-screen" />}>
        {isSurveyHost ? <SurveyPublicApp /> : <App />}
      </Suspense>
    </I18nextProvider>,
  );
});

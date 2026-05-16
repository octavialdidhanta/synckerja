import { createRoot } from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import i18n from "@/shared/i18n/index.ts";
import App from "./App.tsx";
import { SurveyPublicApp } from "@/features/customer-survey/public/SurveyPublicApp.tsx";
import "./index.css";

function deferRegisterServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  const register = () => {
    import("virtual:pwa-register")
      .then(({ registerSW }) => {
        registerSW({ immediate: true });
      })
      // Avoid crashing the app if SW registration fails.
      .catch(() => undefined);
  };

  // Defer workbox download out of critical path.
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

if (
  typeof window !== "undefined" &&
  surveyHost &&
  window.location.hostname.toLowerCase() === surveyHost.toLowerCase()
) {
  createRoot(rootEl).render(<SurveyPublicApp />);
} else {
  createRoot(rootEl).render(
    <I18nextProvider i18n={i18n}>
      <App />
    </I18nextProvider>,
  );
}

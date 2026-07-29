import { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import { initI18n } from "@/shared/i18n/index.ts";
import { RouteSkeletonBootShell } from "@/shared/components/route-loading/createDeferredSkeleton";
import "./index.css";

const ASSET_RELOAD_KEY = "sj-asset-reload";

const App = lazy(() =>
  import("./App.tsx").then((m) => {
    sessionStorage.removeItem(ASSET_RELOAD_KEY);
    return m;
  }),
);

const SurveyPublicApp = lazy(() =>
  import("@/features/customer-survey/public/SurveyPublicApp.tsx").then((m) => {
    sessionStorage.removeItem(ASSET_RELOAD_KEY);
    return { default: m.SurveyPublicApp };
  }),
);

function isStaleAssetFailure(reason: unknown): boolean {
  const message =
    reason instanceof Error
      ? reason.message
      : typeof reason === "string"
        ? reason
        : reason && typeof reason === "object" && "message" in reason
          ? String((reason as { message: unknown }).message)
          : String(reason ?? "");
  return (
    /Failed to fetch dynamically imported module/i.test(message) ||
    /error loading dynamically imported module/i.test(message) ||
    /Loading chunk [\w-]+ failed/i.test(message) ||
    /Importing a module script failed/i.test(message) ||
    /no-response/i.test(message)
  );
}

/** Setelah deploy, chunk hash lama / SW no-response — satu kali clear SW/cache lalu reload. */
function setupAssetLoadRecovery() {
  const reloadOnce = async () => {
    if (sessionStorage.getItem(ASSET_RELOAD_KEY) === "1") return;
    sessionStorage.setItem(ASSET_RELOAD_KEY, "1");
    try {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch {
      // ignore — tetap reload
    }
    window.location.reload();
  };

  window.addEventListener("vite:preloadError", (event) => {
    event.preventDefault();
    void reloadOnce();
  });

  // Script tag di index.html (bukan dynamic import) — MIME text/html setelah deploy.
  window.addEventListener(
    "error",
    (event) => {
      const el = event.target;
      if (!(el instanceof HTMLScriptElement)) return;
      const src = el.src || "";
      if (!src.includes("/assets/")) return;
      void reloadOnce();
    },
    true,
  );

  // Dynamic import / Workbox no-response sering muncul sebagai unhandledrejection, bukan vite:preloadError.
  window.addEventListener("unhandledrejection", (event) => {
    if (!isStaleAssetFailure(event.reason)) return;
    event.preventDefault();
    void reloadOnce();
  });
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  void import("virtual:pwa-register")
    .then(({ registerSW }) => {
      registerSW({
        immediate: true,
        onRegisteredSW(_swUrl, registration) {
          // Buang cache runtime lama yang pernah CacheFirst /assets — bisa memutus fetch.
          void caches.delete("synckerja-build-assets");
          if (!registration) return;
          window.setInterval(() => {
            void registration.update();
          }, 60 * 60 * 1000);
        },
      });
    })
    .catch(() => undefined);
}

setupAssetLoadRecovery();
registerServiceWorker();

const surveyHost = import.meta.env.VITE_PUBLIC_SURVEY_HOSTNAME?.trim();
const rootEl = document.getElementById("root")!;

void initI18n({ preferFastBoot: true }).then((i18n) => {
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

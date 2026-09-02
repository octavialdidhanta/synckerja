import { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import { initI18n } from "@/shared/i18n/index.ts";
import { RouteSkeletonBootShell } from "@/shared/components/route-loading/createDeferredSkeleton";
import { shouldMountOrderStoreApp, publicOrderHostname } from "@/synckerja-order/shared/lib/orderUrls";
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

const OrderStoreApp = lazy(() =>
  import("@/synckerja-order/0-storefront/OrderStoreApp.tsx").then((m) => {
    sessionStorage.removeItem(ASSET_RELOAD_KEY);
    return { default: m.OrderStoreApp };
  }),
);

/** Setelah deploy, chunk hash lama bisa 404/HTML — satu kali clear SW/cache lalu reload. */
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
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  void import("virtual:pwa-register")
    .then(({ registerSW }) => {
      registerSW({
        immediate: true,
        onRegisteredSW(_swUrl, registration) {
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
const orderHost =
  import.meta.env.VITE_PUBLIC_ORDER_HOSTNAME?.trim() || publicOrderHostname();
const rootEl = document.getElementById("root")!;

void (async () => {
  const [{ ensureNativeAppSurface }, i18n] = await Promise.all([
    import("@/shared/native/appSurface"),
    initI18n({ preferFastBoot: true }),
  ]);
  await ensureNativeAppSurface();

  const hostname = typeof window !== "undefined" ? window.location.hostname.toLowerCase() : "";
  const pathname = typeof window !== "undefined" ? window.location.pathname : "/";
  const isSurveyHost = Boolean(surveyHost && hostname === surveyHost.toLowerCase());
  const isOrderHost = shouldMountOrderStoreApp({
    hostname,
    pathname,
    expectedHost: orderHost,
    allowLanStorefront: import.meta.env.DEV,
  });

  createRoot(rootEl).render(
    <I18nextProvider i18n={i18n}>
      <Suspense fallback={<RouteSkeletonBootShell className="min-h-screen" />}>
        {isOrderHost ? <OrderStoreApp /> : isSurveyHost ? <SurveyPublicApp /> : <App />}
      </Suspense>
    </I18nextProvider>,
  );
})();

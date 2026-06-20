import { defineConfig, loadEnv } from "vite";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import basicSsl from "@vitejs/plugin-basic-ssl";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";
import { componentTagger } from "lovable-tagger";
import { deferAppCssPlugin } from "./vite/deferAppCssPlugin";
import { omnichannelApiDocsPlugin } from "./vite/omnichannelApiDocsPlugin";
/** Must run before default resolve: legacy `@/features/share/*` meant `src/shared/*` (not `src/features/share/*`). */
function legacyFeaturesShareResolve(): Plugin {
  const sharePrefix = "@/features/share/";
  const uiPrefix = "@/features/ui/";
  return {
    name: "legacy-features-share-resolve",
    enforce: "pre",
    resolveId(id) {
      if (id.startsWith(sharePrefix)) {
        const rest = id.slice(sharePrefix.length);
        return path.resolve(__dirname, "src/shared", rest);
      }
      if (id.startsWith(uiPrefix)) {
        const rest = id.slice(uiPrefix.length);
        return path.resolve(__dirname, "src/shared/components/ui", rest);
      }
      return undefined;
    },
  };
}

function normalizeViteEnv(value: string | undefined): string {
  const trimmed = (value ?? "").trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const envDir = path.resolve(__dirname);
  const fileEnv = loadEnv(mode, envDir, "");

  const supabaseUrl =
    process.env.VITE_SUPABASE_URL?.trim() ||
    fileEnv.VITE_SUPABASE_URL?.trim() ||
    "";
  const supabaseAnon =
    process.env.VITE_SUPABASE_ANON_KEY?.trim() ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    fileEnv.VITE_SUPABASE_ANON_KEY?.trim() ||
    fileEnv.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    "";
  const googleSsoWebClientId =
    process.env.VITE_GOOGLE_SSO_WEB_CLIENT_ID?.trim() ||
    fileEnv.VITE_GOOGLE_SSO_WEB_CLIENT_ID?.trim() ||
    "";
  const metaAppId =
    normalizeViteEnv(process.env.VITE_META_APP_ID) ||
    normalizeViteEnv(fileEnv.VITE_META_APP_ID);
  const threadsAppId =
    normalizeViteEnv(process.env.VITE_THREADS_APP_ID) ||
    normalizeViteEnv(fileEnv.VITE_THREADS_APP_ID);
  const threadsOAuthRedirectUri =
    normalizeViteEnv(process.env.VITE_THREADS_OAUTH_REDIRECT_URI) ||
    normalizeViteEnv(fileEnv.VITE_THREADS_OAUTH_REDIRECT_URI);
  const metaOAuthConfigId =
    normalizeViteEnv(process.env.VITE_META_OAUTH_CONFIG_ID) ||
    normalizeViteEnv(fileEnv.VITE_META_OAUTH_CONFIG_ID);
  const metaFacebookOAuthConfigId =
    normalizeViteEnv(process.env.VITE_META_FACEBOOK_OAUTH_CONFIG_ID) ||
    normalizeViteEnv(fileEnv.VITE_META_FACEBOOK_OAUTH_CONFIG_ID);
  const devHttps =
    normalizeViteEnv(process.env.VITE_DEV_HTTPS) === "1" ||
    normalizeViteEnv(fileEnv.VITE_DEV_HTTPS) === "1";

  return {
  envDir,
  define: {
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(supabaseUrl),
    "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(supabaseAnon),
    "import.meta.env.VITE_GOOGLE_SSO_WEB_CLIENT_ID": JSON.stringify(googleSsoWebClientId),
    "import.meta.env.VITE_META_APP_ID": JSON.stringify(metaAppId),
    "import.meta.env.VITE_THREADS_APP_ID": JSON.stringify(threadsAppId),
    "import.meta.env.VITE_THREADS_OAUTH_REDIRECT_URI": JSON.stringify(threadsOAuthRedirectUri),
    "import.meta.env.VITE_META_OAUTH_CONFIG_ID": JSON.stringify(metaOAuthConfigId),
    "import.meta.env.VITE_META_FACEBOOK_OAUTH_CONFIG_ID": JSON.stringify(metaFacebookOAuthConfigId),
  },
  server: {
    host: "::",
    port: 8080,
    ...(devHttps ? { https: {} } : {}),
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    ...(devHttps ? [basicSsl()] : []),
    omnichannelApiDocsPlugin(),
    legacyFeaturesShareResolve(),
    react(),
    deferAppCssPlugin(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "pwa-192.png",
        "pwa-512.png",
        "robots.txt",
        "placeholder.svg",
      ],
      manifest: {
        name: "Synckerja Office",
        short_name: "Synckerja",
        description: "Synckerja Office — platform kerja terintegrasi.",
        theme_color: "#f3f4f6",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        lang: "en",
        icons: [
          {
            src: "pwa-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "pwa-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "pwa-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        /** Precache minimal: hindari unduh seluruh dist (~12MB) saat first visit (LCP). */
        globPatterns: [
          "index.html",
          "favicon.png",
          "pwa-192.png",
          "pwa-512.png",
          "brand/**/*",
          "robots.txt",
          "placeholder.svg",
        ],
        globIgnores: ["**/node_modules/**"],
        navigateFallback: "/index.html",
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === "script" || request.destination === "style",
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "synckerja-assets",
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
          {
            urlPattern: ({ url }) =>
              url.hostname.endsWith(".supabase.co") && url.pathname.includes("/storage/v1/"),
            handler: "CacheFirst",
            options: {
              cacheName: "synckerja-supabase-storage",
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  build: {
    target: "es2020",
    minify: "esbuild",
    cssCodeSplit: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/shared/i18n/translations-id")) return "i18n-id";
          if (id.includes("/shared/i18n/translations-en")) return "i18n-en";
          if (id.includes("/locales/en.json")) return "locale-en";
          if (id.includes("/locales/id.json")) return "locale-id";
          if (!id.includes("node_modules")) return;
          // Semua paket yang memanggil React.* harus satu chunk agar tidak undefined saat load.
          if (
            id.includes("react-dom") ||
            id.includes("/react/") ||
            id.includes("scheduler") ||
            id.includes("react-router") ||
            id.includes("@tanstack/react-query") ||
            id.includes("lucide-react") ||
            id.includes("@radix-ui") ||
            id.includes("react-i18next") ||
            id.includes("recharts") ||
            id.includes("@floating-ui")
          ) {
            return "vendor-react";
          }
          if (id.includes("@supabase")) return "vendor-supabase";
          if (id.includes("sonner")) return "vendor-sonner";
          if (id.includes("@capacitor")) return "vendor-capacitor";
          if (id.includes("date-fns")) return "vendor-date";
          if (id.includes("i18next")) return "vendor-i18n";
          if (id.includes("xlsx")) return "vendor-xlsx";
          if (
            id.includes("jspdf") ||
            id.includes("pdf-lib") ||
            id.includes("html2canvas")
          ) {
            return "vendor-pdf";
          }
        },
      },
    },
  },
  resolve: {
    alias: [
      {
        find: "@supabase/types",
        replacement: path.resolve(__dirname, "supabase/types.ts"),
      },
      {
        find: /^@\/onboarding\/(.*)$/,
        replacement: `${path.resolve(__dirname, "src/0-onboarding")}/$1`,
      },
      {
        find: /^@\/register\/(.*)$/,
        replacement: `${path.resolve(__dirname, "src/0-register")}/$1`,
      },
      // Legacy android-mobile paths: `@/features/share/*` → `src/shared/*`, `@/features/ui/*` → shadcn under shared
      {
        find: "@/features/share/i18n/useAppTranslation",
        replacement: path.resolve(__dirname, "src/shared/i18n/useAppTranslation"),
      },
      {
        find: /^@\/features\/share\/(.*)$/,
        replacement: `${path.resolve(__dirname, "src/shared")}/$1`,
      },
      {
        find: /^@\/features\/ui\/(.*)$/,
        replacement: `${path.resolve(__dirname, "src/shared/components/ui")}/$1`,
      },
      // Legacy subscription splits (`10-Plans`, `10-management`, `10-overview`) → unified `src/10-subscription`
      {
        find: /^@\/features\/10-overview\/hooks\/(.*)$/,
        replacement: `${path.resolve(__dirname, "src/10-subscription/hooks")}/$1`,
      },
      {
        find: /^@\/features\/10-overview\/(.*)$/,
        replacement: `${path.resolve(__dirname, "src/10-subscription/overview")}/$1`,
      },
      {
        find: /^@\/features\/10-Plans\/(.*)$/,
        replacement: `${path.resolve(__dirname, "src/10-subscription")}/$1`,
      },
      {
        find: /^@\/features\/10-management\/(.*)$/,
        replacement: `${path.resolve(__dirname, "src/10-subscription")}/$1`,
      },
      {
        find: /^@\/features\/(.*)$/,
        replacement: `${path.resolve(__dirname, "src")}/$1`,
      },
      {
        find: /^@\/mobile\/(.*)$/,
        replacement: `${path.resolve(__dirname, "android-mobile")}/$1`,
      },
      {
        find: /^@\/mobile-app\/(.*)$/,
        replacement: `${path.resolve(__dirname, "android-mobile/main-app-port")}/$1`,
      },
      {
        find: /^@\/ios-mobile\/(.*)$/,
        replacement: `${path.resolve(__dirname, "IOS-mobile")}/$1`,
      },
      { find: "@", replacement: path.resolve(__dirname, "./src") },
    ],
    dedupe: ["react", "react-dom", "scheduler", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
  };
});

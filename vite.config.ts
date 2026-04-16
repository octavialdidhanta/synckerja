import { defineConfig, loadEnv } from "vite";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";
import { componentTagger } from "lovable-tagger";

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

  return {
  envDir,
  define: {
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(supabaseUrl),
    "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(supabaseAnon),
  },
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;

          // Keep React runtime isolated for better long-term caching.
          if (id.includes("/react/") || id.includes("/react-dom/")) return "react-vendor";

          // Router + state/query libs are common across routes.
          if (id.includes("react-router")) return "router";
          if (id.includes("@tanstack/react-query")) return "query";

          // Auth/client SDK.
          if (id.includes("@supabase/")) return "supabase";

          // Radix UI tends to be sizable; split it out.
          if (id.includes("@radix-ui/")) return "radix";

          // Date-fns can be moderately big.
          if (id.includes("date-fns")) return "date";

          return "vendor";
        },
      },
    },
  },
  plugins: [
    legacyFeaturesShareResolve(),
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "favicon.png",
        "robots.txt",
        "placeholder.svg",
        "brand/synckerja-logo.png",
        "brand/synckerja-logo.svg",
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
        lang: "id",
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
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2,woff,ttf}"],
        navigateFallback: "/index.html",
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
      },
    }),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
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
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
  };
});

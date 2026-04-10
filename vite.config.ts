import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";
import { componentTagger } from "lovable-tagger";

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
  plugins: [
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
        orientation: "any",
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

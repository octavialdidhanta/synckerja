import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
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
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: [
      {
        find: /^@\/onboarding\/(.*)$/,
        replacement: `${path.resolve(__dirname, "src/0-onboarding")}/$1`,
      },
      {
        find: /^@\/register\/(.*)$/,
        replacement: `${path.resolve(__dirname, "src/0-register")}/$1`,
      },
      { find: "@", replacement: path.resolve(__dirname, "./src") },
    ],
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
  };
});

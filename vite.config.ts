import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // Always load `.env` from this package root (same folder as this file).
  envDir: path.resolve(__dirname),
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
}));

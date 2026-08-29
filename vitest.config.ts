import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.{test,spec}.{ts,tsx}", "POS-kasir-mobile/**/*.{test,spec}.{ts,tsx}"],
    passWithNoTests: true,
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
      {
        find: /^@\/mobile\/(.*)$/,
        replacement: `${path.resolve(__dirname, "android-mobile")}/$1`,
      },
      {
        find: /^@\/pos-mobile\/(.*)$/,
        replacement: `${path.resolve(__dirname, "POS-kasir-mobile")}/$1`,
      },
      { find: "@", replacement: path.resolve(__dirname, "./src") },
    ],
  },
});

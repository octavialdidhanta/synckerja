import { createClient } from "@supabase/supabase-js";

const url = String(import.meta.env.VITE_SUPABASE_URL ?? "").trim();
const anonKey = String(
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
    "",
).trim();

if (!url || !anonKey) {
  throw new Error(
    "Supabase env missing: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the project root .env, then restart the dev server. For production, set the same VITE_* variables in your host/build environment (they are inlined at build time).",
  );
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: "pkce",
  },
});

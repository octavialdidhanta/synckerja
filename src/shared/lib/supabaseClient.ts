import { createClient, type User } from "@supabase/supabase-js";
import { processLock } from "@supabase/auth-js";

export const SUPABASE_URL = String(import.meta.env.VITE_SUPABASE_URL ?? "").trim();
const url = SUPABASE_URL;
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
    /**
     * Default browser `navigatorLock` (Web Locks API) times out at 5s, then another waiter
     * may `steal` the lock — the previous holder gets `AbortError: Lock broken... steal`.
     * Heavy dashboards trigger many parallel `getSession` / `getUser` calls; serializing
     * auth work in-process avoids that cascade. Cross-tab coordination is slightly weaker;
     * acceptable for typical single-tab SPA usage.
     */
    lock: processLock,
    // Note: @supabase/supabase-js v2 _initSupabaseAuthClient does not forward
    // lockAcquireTimeout to GoTrueClient yet, so this may have no effect until upstream fixes it.
    lockAcquireTimeout: 60_000,
  },
});

/** Single in-flight `getUser()` shared by concurrent callers (e.g. many table rows). */
let authUserCoalesce: Promise<User | null> | null = null;

export function getAuthUserCoalesced(): Promise<User | null> {
  if (!authUserCoalesce) {
    authUserCoalesce = supabase.auth
      .getUser()
      .then(({ data, error }) => {
        if (error) throw error;
        return data.user ?? null;
      })
      .finally(() => {
        authUserCoalesce = null;
      });
  }
  return authUserCoalesce;
}

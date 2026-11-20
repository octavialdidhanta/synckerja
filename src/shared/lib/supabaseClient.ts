import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { processLock as authProcessLock } from "@supabase/auth-js";

/** GoTrue passes `acquireTimeout` into the lock; default is 5s when `lockAcquireTimeout` is not forwarded from createClient (supabase-js quirk). Bump positive timeouts so parallel listeners do not hit ProcessLockAcquireTimeoutError. */
function processLockWithMinAcquireTimeout<R>(
  name: string,
  acquireTimeout: number,
  fn: () => Promise<R>
): Promise<R> {
  if (acquireTimeout === 0 || acquireTimeout < 0) {
    return authProcessLock(name, acquireTimeout, fn);
  }
  return authProcessLock(name, Math.max(acquireTimeout, 60_000), fn);
}

export const SUPABASE_URL = String(import.meta.env.VITE_SUPABASE_URL ?? "").trim();
const url = SUPABASE_URL;
const anonKey = String(
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
    "",
).trim();

/** Pass as `apikey` on direct `fetch` calls to Edge Functions (see Supabase invoke headers). */
export const SUPABASE_ANON_KEY = anonKey;

if (!url || !anonKey) {
  throw new Error(
    "Supabase env missing: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the project root .env, then restart the dev server. For production, set the same VITE_* variables in your host/build environment (they are inlined at build time).",
  );
}

/**
 * Single shared client (same pattern as synckerja-reference `integrations/supabase/client.ts`).
 * Without this, Vite HMR or duplicate module graphs can instantiate multiple GoTrue clients;
 * each queues on the same in-process auth lock (`processLock`), default acquire timeout 5s,
 * which surfaces as ProcessLockAcquireTimeoutError. One instance avoids that contention.
 *
 * Note: `@supabase/supabase-js` does not forward `lockAcquireTimeout` into GoTrueClient,
 * so GoTrue keeps the default 5s wait. We wrap `processLock` to enforce a minimum
 * acquire timeout for positive values (see `processLockWithMinAcquireTimeout`).
 */
/** Increment when Supabase client options change so HMR/open tabs pick up the new config (singleton survives reload). */
const SUPABASE_SINGLETON_REVISION = 4;

declare global {
  interface Window {
    __SUPABASE_CLIENT_INSTANCE__?: SupabaseClient;
    __SUPABASE_CLIENT_REVISION__?: number;
  }
}

const NODE_SINGLETON_KEY = "__synckerja_supabase_singleton__" as const;
const NODE_REVISION_KEY = "__synckerja_supabase_revision__" as const;

/**
 * Public candidate pages (/candidate/profile?token=...) authenticate with a per-applicant token
 * sent as the `x-candidate-token` header; RLS only exposes the row(s) holding that token.
 * Set it with `setCandidateAccessToken(token)` on those pages and clear it on unmount.
 */
let candidateAccessToken: string | null = null;
const CANDIDATE_TOKEN_PATTERN = /^cand_[0-9a-f]{48}$/;

export function setCandidateAccessToken(token: string | null | undefined): void {
  const t = (token ?? "").trim();
  candidateAccessToken = CANDIDATE_TOKEN_PATTERN.test(t) ? t : null;
}

export function isCandidateAccessToken(token: string | null | undefined): boolean {
  return CANDIDATE_TOKEN_PATTERN.test((token ?? "").trim());
}

const candidateAwareFetch: typeof fetch = (input, init) => {
  if (!candidateAccessToken) return fetch(input, init);
  const target = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (!target.includes("/rest/v1/")) return fetch(input, init);
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
  headers.set("x-candidate-token", candidateAccessToken);
  return fetch(input, { ...init, headers });
};

function createSupabaseClient(): SupabaseClient {
  return createClient(url, anonKey, {
    global: { fetch: candidateAwareFetch },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
      storage: typeof window !== "undefined" ? window.localStorage : undefined,
      /**
       * Default browser `navigatorLock` (Web Locks API) times out at 5s, then another waiter
       * may `steal` the lock — the previous holder gets `AbortError: Lock broken... steal`.
       * Heavy dashboards trigger many parallel `getSession` / `getUser` calls; serializing
       * auth work in-process avoids that cascade. Cross-tab coordination is slightly weaker;
       * acceptable for typical single-tab SPA usage.
       */
      lock: processLockWithMinAcquireTimeout,
      // Read by GoTrue at runtime but missing from the installed supabase-js auth option types.
      ...({ lockAcquireTimeout: 60_000 } as Record<string, unknown>),
    },
  });
}

function getSupabaseSingleton(): SupabaseClient {
  if (typeof window !== "undefined") {
    const stale =
      !window.__SUPABASE_CLIENT_INSTANCE__ ||
      window.__SUPABASE_CLIENT_REVISION__ !== SUPABASE_SINGLETON_REVISION;
    if (stale) {
      window.__SUPABASE_CLIENT_INSTANCE__ = createSupabaseClient();
      window.__SUPABASE_CLIENT_REVISION__ = SUPABASE_SINGLETON_REVISION;
    }
    return window.__SUPABASE_CLIENT_INSTANCE__;
  }
  const g = globalThis as typeof globalThis & {
    [NODE_SINGLETON_KEY]?: SupabaseClient;
    [NODE_REVISION_KEY]?: number;
  };
  if (!g[NODE_SINGLETON_KEY] || g[NODE_REVISION_KEY] !== SUPABASE_SINGLETON_REVISION) {
    g[NODE_SINGLETON_KEY] = createSupabaseClient();
    g[NODE_REVISION_KEY] = SUPABASE_SINGLETON_REVISION;
  }
  return g[NODE_SINGLETON_KEY]!;
}

export const supabase = getSupabaseSingleton();

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

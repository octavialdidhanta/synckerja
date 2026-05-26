import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/shared/lib/supabaseClient";

const PKCE_BUSY_MESSAGE = "PKCE code verifier not found in storage";

function isPkceVerifierMissingError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return msg.includes(PKCE_BUSY_MESSAGE) || msg.toLowerCase().includes("code verifier");
}

async function readSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session ?? null;
}

async function waitForSession(maxMs = 12_000): Promise<Session | null> {
  const started = Date.now();
  while (Date.now() - started < maxMs) {
    const session = await readSession();
    if (session) return session;
    await new Promise((r) => setTimeout(r, 120));
  }
  return null;
}

/**
 * Completes Supabase Google PKCE callback without double exchange (React Strict Mode / detectSessionInUrl).
 */
export async function resolveSsoOAuthSession(authCode: string | null): Promise<Session> {
  const existing = await readSession();
  if (existing) return existing;

  if (!authCode?.trim()) {
    throw new Error("missing_auth_code");
  }

  const code = authCode.trim();
  const exchangeLockKey = `synckerja_sso_pkce_${code}`;

  try {
    const lock = sessionStorage.getItem(exchangeLockKey);
    if (lock === "done") {
      const afterPeer = await waitForSession();
      if (afterPeer) return afterPeer;
    }

    if (lock !== "pending" && lock !== "done") {
      sessionStorage.setItem(exchangeLockKey, "pending");
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error && data.session) {
        sessionStorage.setItem(exchangeLockKey, "done");
        return data.session;
      }

      if (error && isPkceVerifierMissingError(error)) {
        const raced = await waitForSession(4_000);
        if (raced) {
          sessionStorage.setItem(exchangeLockKey, "done");
          return raced;
        }
        throw error;
      }

      if (error) throw error;
    } else {
      const peer = await waitForSession();
      if (peer) return peer;
    }
  } catch (err) {
    if (isPkceVerifierMissingError(err)) {
      const raced = await waitForSession(4_000);
      if (raced) {
        sessionStorage.setItem(exchangeLockKey, "done");
        return raced;
      }
    }
    throw err;
  }

  const finalSession = await waitForSession();
  if (finalSession) {
    sessionStorage.setItem(exchangeLockKey, "done");
    return finalSession;
  }

  throw new Error(PKCE_BUSY_MESSAGE);
}

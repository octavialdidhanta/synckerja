import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/shared/auth/contexts/AuthContext";
import { supabase } from "@/shared/lib/supabaseClient";
import { decodeJwtAal, needsMfaChallengeAtLogin } from "./mfaUtils";

export type MfaSessionGateStatus = "resolving" | "allowed" | "challenge";

/**
 * Resolves whether the current session may access protected routes.
 * Users with enrolled TOTP must complete MFA (AAL2) before passing.
 */
export function useRequireMfaSession(): MfaSessionGateStatus {
  const { user, session, loading: authLoading } = useAuth();
  const accessToken = session?.access_token;
  const [status, setStatus] = useState<MfaSessionGateStatus>("resolving");
  const resolveGenerationRef = useRef(0);

  const resolveAal = useCallback(async (token: string | undefined, hasUser: boolean) => {
    if (!token || !hasUser) {
      setStatus("allowed");
      return;
    }

    const jwtAal = decodeJwtAal(token);
    if (jwtAal === "aal2") {
      setStatus("allowed");
      return;
    }

    const generation = ++resolveGenerationRef.current;
    setStatus("resolving");

    try {
      const needsChallenge = await needsMfaChallengeAtLogin();
      if (generation !== resolveGenerationRef.current) return;
      setStatus(needsChallenge ? "challenge" : "allowed");
    } catch {
      if (generation !== resolveGenerationRef.current) return;
      setStatus("allowed");
    }
  }, []);

  useEffect(() => {
    if (authLoading) {
      setStatus("resolving");
      return;
    }

    if (!user || !accessToken) {
      setStatus("allowed");
      return;
    }

    const jwtAal = decodeJwtAal(accessToken);
    if (jwtAal === "aal2") {
      setStatus("allowed");
      return;
    }

    void resolveAal(accessToken, true);
  }, [authLoading, user, accessToken, resolveAal]);

  useEffect(() => {
    if (!user) return;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (
        event === "TOKEN_REFRESHED" ||
        event === "SIGNED_IN" ||
        event === "SIGNED_OUT" ||
        event === "USER_UPDATED"
      ) {
        void resolveAal(nextSession?.access_token, !!nextSession?.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [user, resolveAal]);

  if (authLoading) return "resolving";
  if (!user) return "allowed";

  return status;
}

/** Sync hint for Suspense fallback — true when JWT is not AAL2 and user exists. */
export function mayNeedMfaChallengeSync(
  user: { id: string } | null,
  accessToken: string | undefined,
): boolean {
  if (!user || !accessToken) return false;
  return decodeJwtAal(accessToken) !== "aal2";
}

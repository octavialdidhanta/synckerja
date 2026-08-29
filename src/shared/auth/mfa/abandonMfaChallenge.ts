import { cleanupAuthState } from "@/shared/auth/utils/authCleanup";
import { supabase } from "@/shared/lib/supabaseClient";

/** Best-effort audit log when user leaves MFA challenge without verifying. */
export async function logMfaChallengeAbandoned(): Promise<void> {
  try {
    await supabase.rpc("log_auth_security_event", {
      p_event: "mfa_challenge_abandoned",
      p_metadata: {},
    });
  } catch {
    // Do not block return to login on logging failure.
  }
}

/**
 * Ends the MFA-pending (AAL1) session on this device and returns to the login form.
 * Uses local sign-out via the provided `signOut` (typically `useAuth().signOut`).
 */
export async function abandonMfaChallengeAndReturnToLogin(
  navigate: (path: string, opts?: { replace?: boolean }) => void,
  signOut: () => Promise<void>,
  loginPath = "/login",
): Promise<void> {
  await logMfaChallengeAbandoned();
  try {
    await signOut();
  } catch {
    cleanupAuthState();
  }
  navigate(loginPath, { replace: true });
}

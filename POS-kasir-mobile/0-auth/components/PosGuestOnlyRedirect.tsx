import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/shared/auth/contexts/AuthContext";
import { needsMfaChallengeAtLogin } from "@/shared/auth/mfa/mfaUtils";
import { mfaLoginChallengePath } from "@/shared/auth/mfa/mfaLoginPaths";
import { POS_AUTH_PATHS, POS_POST_LOGIN_REDIRECT } from "../lib/posAuthPaths";

/**
 * Public POS auth screens (welcome / login) must not stay reachable via Android
 * hardware back after a successful session — history often still contains `/pos/login`
 * when those steps were pushed instead of replaced.
 *
 * Bounce signed-in users forward with `replace` so the auth entry is dropped from history.
 */
export function PosGuestOnlyRedirect() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (authLoading || !user) return;

    let cancelled = false;
    void (async () => {
      const needsMfa = await needsMfaChallengeAtLogin();
      if (cancelled) return;
      if (needsMfa) {
        navigate(mfaLoginChallengePath(POS_POST_LOGIN_REDIRECT, POS_AUTH_PATHS.loginMfa), {
          replace: true,
        });
        return;
      }
      navigate(POS_AUTH_PATHS.selectOutlet, { replace: true });
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user, navigate]);

  return null;
}

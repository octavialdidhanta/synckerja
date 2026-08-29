import { routeAfterLogin } from "@/0-auth/lib/postLoginRouting";
import { needsMfaChallengeAtLogin } from "./mfaUtils";
import { mfaLoginChallengePath } from "./mfaLoginPaths";

export type ResolvePostAuthRoutingOptions = {
  /** Override MFA challenge route base (default `/login/mfa`). Use `/pos/login/mfa` for POS. */
  mfaChallengeBasePath?: string;
};

export async function resolvePostAuthRouting(
  navigate: (path: string, opts?: { replace?: boolean }) => void,
  redirectToParam?: string | null,
  options?: ResolvePostAuthRoutingOptions,
): Promise<void> {
  const needsMfa = await needsMfaChallengeAtLogin();
  if (needsMfa) {
    navigate(
      mfaLoginChallengePath(redirectToParam, options?.mfaChallengeBasePath ?? "/login/mfa"),
      { replace: true },
    );
    return;
  }
  await routeAfterLogin(navigate, redirectToParam);
}

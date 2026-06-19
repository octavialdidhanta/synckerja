import { routeAfterLogin } from "@/0-auth/lib/postLoginRouting";
import { needsMfaChallengeAtLogin } from "./mfaUtils";
import { mfaLoginChallengePath } from "./mfaLoginPaths";

export async function resolvePostAuthRouting(
  navigate: (path: string, opts?: { replace?: boolean }) => void,
  redirectToParam?: string | null,
): Promise<void> {
  const needsMfa = await needsMfaChallengeAtLogin();
  if (needsMfa) {
    navigate(mfaLoginChallengePath(redirectToParam), { replace: true });
    return;
  }
  await routeAfterLogin(navigate, redirectToParam);
}

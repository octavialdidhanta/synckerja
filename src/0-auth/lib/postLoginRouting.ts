import { supabase } from "@/shared/lib/supabaseClient";
import { isSessionAccessTokenExpired } from "@/shared/auth/utils/expiredAuth";
import { isPosAuthSurface } from "@/pos-mobile/0-auth/lib/posAuthSurface";
import { POS_AUTH_PATHS } from "@/pos-mobile/0-auth/lib/posAuthPaths";

export function safeInternalRedirectPath(raw: string | null): string | null {
  if (raw == null || raw === "") return null;
  const decoded = (() => {
    try {
      return decodeURIComponent(raw);
    } catch {
      return null;
    }
  })();
  if (decoded == null || !decoded.startsWith("/") || decoded.startsWith("//")) return null;
  return decoded;
}

export async function routeAfterLogin(
  navigate: (path: string, opts?: { replace?: boolean }) => void,
  redirectToParam?: string | null,
) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user || isSessionAccessTokenExpired(session)) return;

  const { data: memberships, error: uoErr } = await supabase
    .from("user_organizations")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1);

  if (uoErr || !memberships?.length) {
    const { data: hasVerifiedToken, error: verifyErr } = await supabase.rpc("registration_has_verified_email", {
      p_user_id: user.id,
      p_email: (user.email ?? "").trim(),
    });
    if (verifyErr || !hasVerifiedToken) {
      navigate(isPosAuthSurface() ? POS_AUTH_PATHS.register : "/register", { replace: true });
      return;
    }
    navigate("/create-organization", { replace: true });
    return;
  }

  const orgId = memberships[0].organization_id;
  const { data: subs, error: subErr } = await supabase
    .from("organization_subscriptions")
    .select("id")
    .eq("organization_id", orgId)
    .limit(1);

  if (subErr || !subs?.length) {
    navigate("/create-plan", { replace: true });
    return;
  }

  if (!localStorage.getItem("hasSeenEmployeeWelcome")) {
    navigate("/employee-welcome", { replace: true });
    return;
  }

  try {
    sessionStorage.setItem("forceRefreshUserData", "1");
  } catch {
    /* ignore quota / private mode */
  }

  const next = safeInternalRedirectPath(redirectToParam ?? null);
  if (next) {
    navigate(next, { replace: true });
    return;
  }
  navigate(isPosAuthSurface() ? POS_AUTH_PATHS.selectOutlet : "/", { replace: true });
}

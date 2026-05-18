import { supabase } from "@/shared/lib/supabaseClient";

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
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

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
      navigate("/register", { replace: true });
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
  navigate(next ?? "/", { replace: true });
}

import { supabase } from "@/shared/lib/supabaseClient";
import { routeAfterLogin, safeInternalRedirectPath } from "@/0-auth/lib/postLoginRouting";
import { completeGoogleSsoLogin } from "@/0-auth/lib/completeGoogleSsoLogin";
import { signInWithNativeGoogle } from "@/0-auth/lib/nativeGoogleSso";
import { getSsoRedirectUrl, isNativeCapacitorAuth } from "@/0-auth/lib/ssoRedirectUrl";

export const SSO_REDIRECT_TO_STORAGE_KEY = "synckerja_sso_redirect_to";
export const SSO_OAUTH_MODE_STORAGE_KEY = "synckerja_sso_oauth_mode";

export type GoogleSignInMode = "login" | "register";

export type StartGoogleSignInOptions = {
  mode: GoogleSignInMode;
  redirectToParam?: string | null;
  /** On native, completes login in-app via `routeAfterLogin` (no browser redirect). */
  navigate?: (path: string, opts?: { replace?: boolean }) => void;
};

export type StartGoogleSignInResult = {
  error: string | null;
  /** Native flow finished session + routing without leaving the app. */
  completedInApp?: boolean;
};

/** @deprecated Use getSsoRedirectUrl() */
export function getSsoCallbackUrl(): string {
  return getSsoRedirectUrl();
}

export function stashSsoRedirectTo(redirectToParam: string | null | undefined): void {
  const safe = safeInternalRedirectPath(redirectToParam ?? null);
  try {
    if (safe) {
      sessionStorage.setItem(SSO_REDIRECT_TO_STORAGE_KEY, safe);
    } else {
      sessionStorage.removeItem(SSO_REDIRECT_TO_STORAGE_KEY);
    }
  } catch {
    /* ignore quota / private mode */
  }
}

export function readStashedSsoRedirectTo(): string | null {
  try {
    return safeInternalRedirectPath(sessionStorage.getItem(SSO_REDIRECT_TO_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function clearStashedSsoRedirectTo(): void {
  try {
    sessionStorage.removeItem(SSO_REDIRECT_TO_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function stashSsoOAuthMode(mode: GoogleSignInMode): void {
  try {
    sessionStorage.setItem(SSO_OAUTH_MODE_STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
}

export function readStashedSsoOAuthMode(): GoogleSignInMode | null {
  try {
    const v = sessionStorage.getItem(SSO_OAUTH_MODE_STORAGE_KEY);
    return v === "login" || v === "register" ? v : null;
  } catch {
    return null;
  }
}

export function clearStashedSsoOAuthMode(): void {
  try {
    sessionStorage.removeItem(SSO_OAUTH_MODE_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

async function startWebGoogleOAuth(options: StartGoogleSignInOptions): Promise<StartGoogleSignInResult> {
  const redirectTo = getSsoRedirectUrl();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      queryParams: {
        access_type: "online",
        prompt: "select_account",
      },
    },
  });

  if (error) {
    clearStashedSsoRedirectTo();
    clearStashedSsoOAuthMode();
    return { error: error.message };
  }

  if (data?.url) {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
    window.location.assign(data.url);
  }

  return { error: null };
}

async function startNativeGoogleSignIn(options: StartGoogleSignInOptions): Promise<StartGoogleSignInResult> {
  if (!options.navigate) {
    return { error: "missing_navigate" };
  }

  const nativeResult = await signInWithNativeGoogle();
  if (nativeResult.error) {
    clearStashedSsoRedirectTo();
    clearStashedSsoOAuthMode();
    if (nativeResult.error === "access_denied") {
      return { error: "access_denied" };
    }
    if (nativeResult.error === "android_oauth_misconfigured") {
      return { error: "android_oauth_misconfigured" };
    }
    if (nativeResult.error === "google_account_reauth_failed") {
      return { error: "google_account_reauth_failed" };
    }
    if (
      nativeResult.error === "missing_web_client_id" ||
      nativeResult.error === "missing_ios_client_id"
    ) {
      return { error: "not_configured" };
    }
    return { error: nativeResult.error };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    clearStashedSsoRedirectTo();
    clearStashedSsoOAuthMode();
    return { error: "no_session" };
  }

  const complete = await completeGoogleSsoLogin(user);
  if (!complete.ok) {
    clearStashedSsoRedirectTo();
    clearStashedSsoOAuthMode();
    return { error: complete.error ?? "complete_failed" };
  }

  const redirectTo = readStashedSsoRedirectTo();
  clearStashedSsoRedirectTo();
  clearStashedSsoOAuthMode();

  await routeAfterLogin(options.navigate, redirectTo);
  return { error: null, completedInApp: true };
}

export async function startGoogleSignIn(options: StartGoogleSignInOptions): Promise<StartGoogleSignInResult> {
  stashSsoRedirectTo(options.redirectToParam ?? null);
  stashSsoOAuthMode(options.mode);

  if (isNativeCapacitorAuth()) {
    return startNativeGoogleSignIn(options);
  }

  return startWebGoogleOAuth(options);
}

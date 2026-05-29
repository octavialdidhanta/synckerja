import { Capacitor } from "@capacitor/core";
import {
  SocialLogin,
  type GoogleLoginOptions,
  type GoogleLoginResponseOnline,
  type SocialLoginError,
} from "@capgo/capacitor-social-login";
import { supabase } from "@/shared/lib/supabaseClient";
import { createGoogleSsoNoncePair } from "@/0-auth/lib/googleSsoNonce";
import {
  assertGoogleSsoNativeConfigured,
  resolveGoogleSsoClientConfig,
} from "@/0-auth/lib/googleSsoClientIds";

let initPromise: Promise<void> | null = null;

function decodeJwtPayload(idToken: string): Record<string, unknown> | null {
  try {
    const base64Url = idToken.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`)
        .join(""),
    );
    return JSON.parse(jsonPayload) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function ensureNativeGoogleSocialLoginInitialized(): Promise<void> {
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    const configError = await assertGoogleSsoNativeConfigured();
    if (configError) {
      throw new Error(configError);
    }

    const cfg = await resolveGoogleSsoClientConfig();
    const webClientId = cfg.webClientId!;
    const isIos = Capacitor.getPlatform() === "ios";

    await SocialLogin.initialize({
      google: {
        webClientId,
        ...(isIos && cfg.iosClientId ? { iOSClientId: cfg.iosClientId } : {}),
        mode: "online",
      },
    });
  })();

  return initPromise;
}

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === "object" && err !== null && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return "native_google_failed";
}

/** Includes nested cause / JSON — Capgo maps reauth failures to USER_CANCELLED. */
function extractFullErrorText(err: unknown): string {
  const parts: string[] = [];
  const visit = (value: unknown) => {
    if (value == null) return;
    if (value instanceof Error) {
      parts.push(value.message);
      if (value.cause) visit(value.cause);
      return;
    }
    if (typeof value === "object") {
      const o = value as Record<string, unknown>;
      if (typeof o.message === "string") parts.push(o.message);
      if (typeof o.errorMessage === "string") parts.push(o.errorMessage);
      if (typeof o.error === "string") parts.push(o.error);
      if ("cause" in o) visit(o.cause);
      try {
        parts.push(JSON.stringify(value));
      } catch {
        /* ignore circular */
      }
      return;
    }
    parts.push(String(value));
  };
  visit(err);
  return parts.join(" ");
}

export function isGoogleAccountReauthFailedError(err: unknown): boolean {
  return extractFullErrorText(err).toLowerCase().includes("account reauth failed");
}

function getSocialLoginErrorCode(err: unknown): string | undefined {
  if (typeof err === "object" && err !== null && "code" in err) {
    const code = (err as { code: unknown }).code;
    return code != null ? String(code) : undefined;
  }
  return undefined;
}

function isUserCancelledCode(err: unknown): boolean {
  return getSocialLoginErrorCode(err) === "USER_CANCELLED";
}

/**
 * Capgo rejects all GetCredentialCancellationException (incl. [16] reauth, SHA-1) as
 * USER_CANCELLED + "Google Sign-In cancelled by user" — the real cause stays in Logcat only.
 */
function isCapgoMaskedAndroidCredentialCancel(err: unknown): boolean {
  if (Capacitor.getPlatform() !== "android") {
    return false;
  }
  const code = getSocialLoginErrorCode(err);
  const message = extractErrorMessage(err);
  // Some Android credential errors are collapsed into USER_CANCELLED by the plugin.
  // Do NOT treat every cancel as a masked error; a real user cancel should be silent.
  return code === "USER_CANCELLED" || message === "Google Sign-In cancelled by user";
}

/**
 * Google often returns "activity is cancelled by the user" when SHA-1 / OAuth client
 * is misconfigured — not when the user actually cancelled (Capgo #147).
 */
export function isGoogleAndroidOAuthMisconfigurationMessage(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("activity is cancelled by the user") ||
    m.includes("activity is canceled by the user")
  );
}

/** Only true user dismissal — not reauth/SHA-1 misconfiguration masked as cancel. */
function isExplicitUserCancel(err: unknown): boolean {
  const full = extractFullErrorText(err);
  // Treat USER_CANCELLED as a user dismissal (Back / close picker) unless it matches the known
  // Android SHA-1 / OAuth misconfiguration pattern.
  if (isUserCancelledCode(err)) {
    return !isGoogleAndroidOAuthMisconfigurationMessage(full);
  }
  if (isGoogleAccountReauthFailedError(err)) {
    return false;
  }
  if (isGoogleAndroidOAuthMisconfigurationMessage(full)) {
    return false;
  }
  if (typeof err === "object" && err !== null && "code" in err) {
    if (String((err as SocialLoginError).code) === "USER_CANCELLED") {
      return extractErrorMessage(err) === "Google Sign-In cancelled by user";
    }
  }
  return extractErrorMessage(err) === "Google Sign-In cancelled by user";
}

function mapNativeGoogleLoginError(err: unknown): string {
  const full = extractFullErrorText(err);

  if (isExplicitUserCancel(err)) {
    return "access_denied";
  }

  // Capgo / Credential Manager often returns USER_CANCELLED when the user presses Back.
  // Only map to misconfiguration when the message matches the known SHA-1/OAuth pattern.
  if (isCapgoMaskedAndroidCredentialCancel(err)) {
    if (isGoogleAndroidOAuthMisconfigurationMessage(full)) {
      return "android_oauth_misconfigured";
    }
    return "access_denied";
  }

  if (isGoogleAccountReauthFailedError(err)) {
    return "google_account_reauth_failed";
  }

  if (isGoogleAndroidOAuthMisconfigurationMessage(full)) {
    return "android_oauth_misconfigured";
  }
  return extractErrorMessage(err);
}

/** Standard Credential Manager UI on Android and iOS (Capgo default). */
function buildNativeGoogleLoginOptions(nonceDigest?: string): GoogleLoginOptions {
  const options: GoogleLoginOptions = {
    filterByAuthorizedAccounts: false,
  };
  if (nonceDigest) {
    options.nonce = nonceDigest;
  }
  return options;
}

/**
 * Native Google account picker → Supabase `signInWithIdToken`.
 * Avoid custom `scopes` (see MainActivity + Capgo docs).
 */
const LOG = "[SynckerjaGoogleSSO]";

function logNativeGoogleDebug(label: string, detail?: unknown): void {
  if (detail !== undefined) {
    console.warn(LOG, label, detail);
  } else {
    console.warn(LOG, label);
  }
}

export async function signInWithNativeGoogle(): Promise<{ error: string | null }> {
  try {
    await ensureNativeGoogleSocialLoginInitialized();

    let response;
    try {
      logNativeGoogleDebug("SocialLogin.login start (no nonce)");
      response = await SocialLogin.login({
        provider: "google",
        options: buildNativeGoogleLoginOptions(),
      });
      logNativeGoogleDebug("SocialLogin.login ok (no nonce)");
    } catch (firstErr) {
      logNativeGoogleDebug("SocialLogin.login failed (no nonce)", {
        code: typeof firstErr === "object" && firstErr !== null && "code" in firstErr ? (firstErr as { code: unknown }).code : undefined,
        message: extractErrorMessage(firstErr),
      });
      const firstMapped = mapNativeGoogleLoginError(firstErr);
      if (firstMapped === "access_denied") {
        logNativeGoogleDebug("mapped error", firstMapped);
        return { error: firstMapped };
      }
      if (firstMapped === "google_account_reauth_failed" || firstMapped === "android_oauth_misconfigured") {
        logNativeGoogleDebug("mapped error (no retry)", firstMapped);
        return { error: firstMapped };
      }
      console.warn("Google login without nonce failed, retrying with nonce:", firstErr);
      const { rawNonce, nonceDigest } = await createGoogleSsoNoncePair();
      try {
        logNativeGoogleDebug("SocialLogin.login start (with nonce)");
        response = await SocialLogin.login({
          provider: "google",
          options: buildNativeGoogleLoginOptions(nonceDigest),
        });
        logNativeGoogleDebug("SocialLogin.login ok (with nonce)");
        const googleResult = await completeNativeGoogleSession(response, rawNonce);
        logNativeGoogleDebug("complete session", googleResult.error ?? "ok");
        return googleResult;
      } catch (secondErr) {
        logNativeGoogleDebug("SocialLogin.login failed (with nonce)", {
          code: typeof secondErr === "object" && secondErr !== null && "code" in secondErr ? (secondErr as { code: unknown }).code : undefined,
          message: extractErrorMessage(secondErr),
        });
        const mapped = mapNativeGoogleLoginError(secondErr);
        logNativeGoogleDebug("mapped error", mapped);
        return { error: mapped };
      }
    }

    const result = await completeNativeGoogleSession(response);
    logNativeGoogleDebug("complete session", result.error ?? "ok");
    return result;
  } catch (err) {
    logNativeGoogleDebug("signInWithNativeGoogle unexpected", err);
    const mapped = mapNativeGoogleLoginError(err);
    logNativeGoogleDebug("mapped error", mapped);
    return { error: mapped };
  }
}

async function completeNativeGoogleSession(
  response: Awaited<ReturnType<typeof SocialLogin.login>>,
  rawNonce?: string,
): Promise<{ error: string | null }> {
  if (response.result.responseType !== "online") {
    return { error: "offline_mode_unsupported" };
  }

  const googleResult = response.result as GoogleLoginResponseOnline;
  const idToken = googleResult.idToken;
  if (!idToken) {
    return { error: "missing_id_token" };
  }

  const decoded = decodeJwtPayload(idToken);
  const signInOptions: { provider: "google"; token: string; nonce?: string } = {
    provider: "google",
    token: idToken,
  };
  if (rawNonce && decoded?.nonce) {
    signInOptions.nonce = rawNonce;
  }

  const { error } = await supabase.auth.signInWithIdToken(signInOptions);
  if (error) {
    logNativeGoogleDebug("signInWithIdToken failed", error.message);
    return { error: error.message };
  }

  return { error: null };
}

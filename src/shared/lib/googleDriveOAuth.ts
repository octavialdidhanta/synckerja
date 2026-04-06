import { supabase } from "@/shared/lib/supabaseClient";

/** CSRF `state` for Google OAuth — stored in localStorage so a new tab/window can read it (sessionStorage is per-tab). */
export const GOOGLE_OAUTH_STATE_STORAGE_KEY = "google_oauth_state";

/** Other tabs listen for this key (storage event) to refresh Drive connection after OAuth completes in the popup. */
export const GOOGLE_OAUTH_REFRESH_HINT_KEY = "google_drive_oauth_refresh_hint";

/** `postMessage` type from the OAuth callback window to the opener (preview modal). */
export const GOOGLE_DRIVE_OAUTH_SUCCESS_MESSAGE_TYPE = "synckerja-google-drive-oauth-success";

const DRIVE_READONLY_SCOPE = "https://www.googleapis.com/auth/drive.readonly";

export function getGoogleOAuthRedirectUri(): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/auth/google/callback`;
}

export type StartGoogleDriveOAuthResult =
  | { ok: true }
  | { ok: false; reason: "missing_client_id" | "popup_blocked" };

function startGoogleDriveOAuthWithClientId(clientId: string): StartGoogleDriveOAuthResult {
  const state = crypto.randomUUID();
  try {
    localStorage.setItem(GOOGLE_OAUTH_STATE_STORAGE_KEY, state);
  } catch {
    return { ok: false, reason: "popup_blocked" };
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getGoogleOAuthRedirectUri(),
    response_type: "code",
    scope: DRIVE_READONLY_SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
    include_granted_scopes: "true",
  });

  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  const popup = window.open(
    url,
    "synckerja_google_oauth",
    "width=520,height=720,scrollbars=yes,resizable=yes",
  );

  if (!popup) {
    try {
      localStorage.removeItem(GOOGLE_OAUTH_STATE_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    return { ok: false, reason: "popup_blocked" };
  }

  try {
    popup.focus();
  } catch {
    /* ignore */
  }

  return { ok: true };
}

async function fetchGoogleOAuthClientIdFromEdge(): Promise<string | undefined> {
  const { data, error } = await supabase.functions.invoke<{
    clientId?: string;
    error?: string;
  }>("google-oauth-manage", { body: { action: "oauth_client_config" } });
  if (error || data?.error) return undefined;
  const id = typeof data?.clientId === "string" ? data.clientId.trim() : "";
  return id || undefined;
}

/**
 * Opens Google OAuth in a new window (e.g. from preview modal).
 * Uses `VITE_GOOGLE_CLIENT_ID` from the build only (sync). Prefer `startGoogleDriveOAuthAsync` in production
 * when the client id was not inlined at build time but `GOOGLE_CLIENT_ID` is set on Supabase Edge Functions.
 */
export function startGoogleDriveOAuth(): StartGoogleDriveOAuthResult {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();
  if (!clientId) return { ok: false, reason: "missing_client_id" };
  return startGoogleDriveOAuthWithClientId(clientId);
}

/**
 * Same as `startGoogleDriveOAuth`, but if `VITE_GOOGLE_CLIENT_ID` is empty (common when `.env` was not
 * available during CI build), loads the web client id from Edge Function `google-oauth-manage` (`GOOGLE_CLIENT_ID` secret).
 */
export async function startGoogleDriveOAuthAsync(): Promise<StartGoogleDriveOAuthResult> {
  let clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();
  if (!clientId) {
    clientId = (await fetchGoogleOAuthClientIdFromEdge()) ?? "";
  }
  if (!clientId) return { ok: false, reason: "missing_client_id" };
  return startGoogleDriveOAuthWithClientId(clientId);
}

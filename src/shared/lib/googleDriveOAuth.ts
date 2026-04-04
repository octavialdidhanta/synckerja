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

/**
 * Opens Google OAuth in a new window so the current page (e.g. preview modal) stays open.
 * Requires `VITE_GOOGLE_CLIENT_ID`. If the browser blocks the popup, state is cleared and `popup_blocked` is returned.
 */
export function startGoogleDriveOAuth(): StartGoogleDriveOAuthResult {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();
  if (!clientId) return { ok: false, reason: "missing_client_id" };

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

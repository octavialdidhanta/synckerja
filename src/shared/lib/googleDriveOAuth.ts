import { supabase } from "@/shared/lib/supabaseClient";

/** CSRF `state` for Google OAuth — stored in localStorage so a new tab/window can read it (sessionStorage is per-tab). */
export const GOOGLE_OAUTH_STATE_STORAGE_KEY = "google_oauth_state";
/** Must match `redirect_uri` sent to Google in the authorize step (token exchange). */
export const GOOGLE_OAUTH_REDIRECT_STORAGE_KEY = "google_oauth_redirect_uri";

/** Other tabs listen for this key (storage event) to refresh Drive connection after OAuth completes in the popup. */
export const GOOGLE_OAUTH_REFRESH_HINT_KEY = "google_drive_oauth_refresh_hint";

/** `postMessage` type from the OAuth callback window to the opener (preview modal). */
export const GOOGLE_DRIVE_OAUTH_SUCCESS_MESSAGE_TYPE = "synckerja-google-drive-oauth-success";

/** Per-file Drive access (Picker / app-opened files). See Google OAuth verification. */
export const GOOGLE_DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file";

type GoogleOAuthClientConfig = {
  clientId?: string;
  redirectUri?: string;
};

export function getGoogleOAuthRedirectUri(): string {
  const envOverride = import.meta.env.VITE_GOOGLE_OAUTH_REDIRECT_URI?.trim();
  if (envOverride) return envOverride;
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/auth/google/callback`;
}

export type StartGoogleDriveOAuthResult =
  | { ok: true }
  | { ok: false; reason: "missing_client_id" | "popup_blocked" };

async function fetchGoogleOAuthConfigFromEdge(): Promise<GoogleOAuthClientConfig | null> {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const { data, error } = await supabase.functions.invoke<{
    clientId?: string;
    redirectUri?: string;
    error?: string;
  }>("google-oauth-manage", { body: { action: "oauth_client_config", origin } });
  if (error || data?.error) return null;
  return {
    clientId: typeof data?.clientId === "string" ? data.clientId.trim() : "",
    redirectUri: typeof data?.redirectUri === "string" ? data.redirectUri.trim() : "",
  };
}

async function resolveGoogleOAuthStartParams(): Promise<{ clientId: string; redirectUri: string }> {
  const edge = await fetchGoogleOAuthConfigFromEdge();
  const clientId =
    import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() || edge?.clientId || "";
  const redirectUri =
    import.meta.env.VITE_GOOGLE_OAUTH_REDIRECT_URI?.trim() ||
    edge?.redirectUri ||
    getGoogleOAuthRedirectUri();
  return { clientId, redirectUri };
}

function startGoogleDriveOAuthWithParams(
  clientId: string,
  redirectUri: string,
): StartGoogleDriveOAuthResult {
  const state = crypto.randomUUID();
  try {
    localStorage.setItem(GOOGLE_OAUTH_STATE_STORAGE_KEY, state);
    localStorage.setItem(GOOGLE_OAUTH_REDIRECT_STORAGE_KEY, redirectUri);
  } catch {
    return { ok: false, reason: "popup_blocked" };
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_DRIVE_FILE_SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
    include_granted_scopes: "false",
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
      localStorage.removeItem(GOOGLE_OAUTH_REDIRECT_STORAGE_KEY);
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

/**
 * Opens Google OAuth in a new window (e.g. from preview modal).
 * Prefer `startGoogleDriveOAuthAsync` so client id + redirect_uri stay aligned with Edge secrets.
 */
export function startGoogleDriveOAuth(): StartGoogleDriveOAuthResult {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();
  if (!clientId) return { ok: false, reason: "missing_client_id" };
  return startGoogleDriveOAuthWithParams(clientId, getGoogleOAuthRedirectUri());
}

/**
 * Loads OAuth web client id + redirect URI from env or Edge (`GOOGLE_CLIENT_ID`, `APP_PUBLIC_URL`).
 */
export async function startGoogleDriveOAuthAsync(): Promise<StartGoogleDriveOAuthResult> {
  const { clientId, redirectUri } = await resolveGoogleOAuthStartParams();
  if (!clientId) return { ok: false, reason: "missing_client_id" };
  return startGoogleDriveOAuthWithParams(clientId, redirectUri);
}

/** Read redirect_uri from the Connect Google flow; falls back to current origin. */
export function getGoogleOAuthRedirectUriForCallback(): string {
  try {
    const stored = localStorage.getItem(GOOGLE_OAUTH_REDIRECT_STORAGE_KEY)?.trim();
    if (stored) {
      localStorage.removeItem(GOOGLE_OAUTH_REDIRECT_STORAGE_KEY);
      return stored;
    }
  } catch {
    /* ignore */
  }
  return getGoogleOAuthRedirectUri();
}

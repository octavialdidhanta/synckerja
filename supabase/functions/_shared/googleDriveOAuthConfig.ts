/** Redirect URI + allowlist for Google Drive OAuth (preview / social media dashboard). */

export function isLocalDevOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname;
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return false;
  }
}

export function googleDriveOAuthRedirectUri(requestOrigin?: string): string {
  const explicit = (Deno.env.get("GOOGLE_OAUTH_REDIRECT_URI") ?? "").trim();
  if (explicit) return explicit;

  const origin = (requestOrigin ?? "").trim().replace(/\/$/, "");
  if (origin && isLocalDevOrigin(origin)) {
    return `${origin}/auth/google/callback`;
  }

  const app = (Deno.env.get("APP_PUBLIC_URL") ?? "").trim().replace(/\/$/, "");
  if (app) return `${app}/auth/google/callback`;

  return "https://office.synckerja.com/auth/google/callback";
}

const DEFAULT_REDIRECT_ALLOWLIST = [
  "https://office.synckerja.com/auth/google/callback",
  "http://localhost:8080/auth/google/callback",
  "http://localhost:8081/auth/google/callback",
  "http://localhost:5173/auth/google/callback",
  "http://localhost:4173/auth/google/callback",
  "http://127.0.0.1:8080/auth/google/callback",
  "http://127.0.0.1:8081/auth/google/callback",
  "http://127.0.0.1:5173/auth/google/callback",
  "http://127.0.0.1:4173/auth/google/callback",
];

export function googleDriveOAuthRedirectAllowlist(): string[] {
  const raw = Deno.env.get("GOOGLE_OAUTH_REDIRECT_URI_ALLOWLIST");
  const fromEnv = raw
    ? raw.split(",").map((s) => s.trim()).filter(Boolean)
    : [];
  const canonical = googleDriveOAuthRedirectUri();
  return [...new Set([...DEFAULT_REDIRECT_ALLOWLIST, ...fromEnv, canonical])];
}

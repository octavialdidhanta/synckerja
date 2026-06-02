import { Capacitor } from "@capacitor/core";

/** Must match `appId` in capacitor.config.ts and Android/iOS URL scheme registration. */
export const NATIVE_SSO_APP_SCHEME = "id.synckerja.app";

export const NATIVE_SSO_CALLBACK_PATH = "/auth/sso/callback";

export function isNativeCapacitorAuth(): boolean {
  if (typeof Capacitor === "undefined") {
    return false;
  }
  const platform = Capacitor.getPlatform();
  return platform === "android" || platform === "ios";
}

/** Supabase `redirectTo` — web origin on browser; custom scheme on native so OAuth returns to the app. */
export function getSsoRedirectUrl(): string {
  if (isNativeCapacitorAuth()) {
    return `${NATIVE_SSO_APP_SCHEME}://${NATIVE_SSO_CALLBACK_PATH.replace(/^\//, "")}`;
  }
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}${NATIVE_SSO_CALLBACK_PATH}`;
}

export type ParsedNativeSsoCallback = {
  pathname: string;
  search: string;
  hash: string;
};

/** Parses `id.synckerja.app://auth/sso/callback?code=...` into in-app router path. */
export function parseNativeSsoCallbackUrl(raw: string): ParsedNativeSsoCallback | null {
  const trimmed = raw.trim();
  const prefix = `${NATIVE_SSO_APP_SCHEME}://`;
  if (!trimmed.toLowerCase().startsWith(prefix.toLowerCase())) {
    return null;
  }

  const rest = trimmed.slice(prefix.length);
  const hashIdx = rest.indexOf("#");
  const beforeHash = hashIdx >= 0 ? rest.slice(0, hashIdx) : rest;
  const hash = hashIdx >= 0 ? rest.slice(hashIdx) : "";

  const qIdx = beforeHash.indexOf("?");
  const pathPart = qIdx >= 0 ? beforeHash.slice(0, qIdx) : beforeHash;
  const search = qIdx >= 0 ? beforeHash.slice(qIdx) : "";

  const pathname = `/${pathPart.replace(/^\/+/, "")}`;
  if (pathname !== NATIVE_SSO_CALLBACK_PATH) {
    return null;
  }

  return { pathname, search, hash };
}

import { Capacitor } from "@capacitor/core";
import {
  getNativeSsoAppScheme,
  NATIVE_APP_ID_OFFICE,
  NATIVE_APP_ID_POS,
} from "@/shared/native/appSurface";

/** @deprecated Prefer {@link getNativeSsoAppScheme} — Office default for static imports. */
export const NATIVE_SSO_APP_SCHEME = NATIVE_APP_ID_OFFICE;

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
    const scheme = getNativeSsoAppScheme();
    return `${scheme}://${NATIVE_SSO_CALLBACK_PATH.replace(/^\//, "")}`;
  }
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}${NATIVE_SSO_CALLBACK_PATH}`;
}

export type ParsedNativeSsoCallback = {
  pathname: string;
  search: string;
  hash: string;
};

const NATIVE_SSO_SCHEMES = [NATIVE_APP_ID_OFFICE, NATIVE_APP_ID_POS] as const;

/** Parses `id.synckerja.app|pos://auth/sso/callback?code=...` into in-app router path. */
export function parseNativeSsoCallbackUrl(raw: string): ParsedNativeSsoCallback | null {
  const trimmed = raw.trim();
  let rest: string | null = null;
  for (const scheme of NATIVE_SSO_SCHEMES) {
    const prefix = `${scheme}://`;
    if (trimmed.toLowerCase().startsWith(prefix.toLowerCase())) {
      rest = trimmed.slice(prefix.length);
      break;
    }
  }
  if (rest == null) return null;

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

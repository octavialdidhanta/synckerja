const STORAGE_KEY = "offline_conversion_oauth_provider";

export type OfflineConversionOAuthProvider = "google" | "meta";

export function markOfflineConversionOAuthStart(provider: OfflineConversionOAuthProvider) {
  try {
    sessionStorage.setItem(STORAGE_KEY, provider);
  } catch {
    /* ignore quota / private mode */
  }
}

export function peekOfflineConversionOAuthProvider(): OfflineConversionOAuthProvider | null {
  try {
    const value = sessionStorage.getItem(STORAGE_KEY);
    if (value === "google" || value === "meta") return value;
  } catch {
    /* ignore */
  }
  return null;
}

export function clearOfflineConversionOAuthStart() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function isSharedOfflineConversionPath(pathname: string): boolean {
  return (
    pathname.startsWith("/omnichannel/settings/offline-conversion") ||
    pathname.startsWith("/omnichannel/settings/google-ads")
  );
}

export function resolveOfflineConversionOAuthProvider(
  searchParams: URLSearchParams,
): OfflineConversionOAuthProvider | null {
  const platform = searchParams.get("platform");
  if (platform === "meta" || platform === "google") return platform;
  return peekOfflineConversionOAuthProvider();
}

export function shouldConsumeOfflineConversionOAuthResult(
  searchParams: URLSearchParams,
  provider: OfflineConversionOAuthProvider,
  pathname: string,
): boolean {
  const hasResult =
    searchParams.get("connected") === "1" || Boolean(searchParams.get("oauth_error"));
  if (!hasResult) return false;

  // Shared Offline Conversion page owns the toast in OfflineConversionSettingsShell.
  if (isSharedOfflineConversionPath(pathname)) return false;

  const resolved = resolveOfflineConversionOAuthProvider(searchParams);
  if (resolved) return resolved === provider;
  return true;
}

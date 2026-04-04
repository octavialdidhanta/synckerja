import React, { useEffect } from 'react';

/**
 * OAuth callback page for Meta (Facebook) Login.
 * - Business Login: Meta redirects with fragment #access_token=...&long_lived_token=... (or #error=...).
 * - Standard OAuth: Meta redirects with ?code=...&state=... (or ?error=...).
 * Sends to opener via postMessage, then closes.
 */
function parseHashParams(hash: string): Record<string, string> {
  const out: Record<string, string> = {};
  const trimmed = hash.startsWith('#') ? hash.slice(1) : hash;
  trimmed.split('&').forEach((part) => {
    const i = part.indexOf('=');
    if (i === -1) return;
    const key = decodeURIComponent(part.slice(0, i).replace(/\+/g, ' '));
    const value = decodeURIComponent(part.slice(i + 1).replace(/\+/g, ' '));
    out[key] = value;
  });
  return out;
}

export function MetaOAuthCallbackPage() {
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const hashParams = parseHashParams(window.location.hash || '');

    // Business Login: token in fragment
    const hashToken = hashParams.long_lived_token || hashParams.access_token;
    const hashError = hashParams.error;
    if (hashToken || hashError != null) {
      const payload = hashError != null
        ? {
            type: 'meta-oauth' as const,
            error: hashError || 'unknown',
            error_reason: hashParams.error_reason,
            error_description: hashParams.error_description,
          }
        : {
            type: 'meta-oauth' as const,
            long_lived_token: hashParams.long_lived_token || hashParams.access_token || '',
            access_token: hashParams.access_token || '',
            state: hashParams.state ?? query.get('state') ?? '',
          };
      if (window.opener) {
        window.opener.postMessage(payload, window.location.origin);
        setTimeout(() => window.close(), 150);
      } else {
        // Redirect opened in main tab: send user back to Connect Instagram so session is preserved
        window.location.replace(`${window.location.origin}/operations/instagram-connect`);
      }
      return;
    }

    // Standard OAuth: code in query
    const code = query.get('code');
    const state = query.get('state');
    const error = query.get('error');
    const errorReason = query.get('error_reason') ?? undefined;
    const errorDescription = query.get('error_description') ?? undefined;
    // Exact redirect_uri Meta used (no query/hash) so token exchange matches
    const redirectUriUsed = `${window.location.origin}${window.location.pathname}`;

    const payload =
      error != null
        ? { type: 'meta-oauth' as const, error: error || 'unknown', error_reason: errorReason, error_description: errorDescription }
        : { type: 'meta-oauth' as const, code: code ?? '', state: state ?? '', redirect_uri: redirectUriUsed };

    if (window.opener) {
      window.opener.postMessage(payload, window.location.origin);
      setTimeout(() => window.close(), 150);
    } else {
      // Redirect opened in main tab: send user back to Connect Instagram so they stay in app
      window.location.replace(`${window.location.origin}/operations/instagram-connect`);
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <p className="text-sm text-gray-600">Closing window…</p>
      <p className="text-xs text-gray-500 mt-2">If this does not close, you will be redirected back to the app.</p>
    </div>
  );
}

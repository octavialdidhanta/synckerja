import React, { useEffect } from 'react';

/**
 * OAuth callback for Threads API (threads.net/oauth/authorize).
 * Redirects with ?code=...&state=... (or ?error=...).
 */
export function ThreadsOAuthCallbackPage() {
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const code = query.get('code');
    const state = query.get('state');
    const error = query.get('error');
    const errorReason = query.get('error_reason') ?? undefined;
    const errorDescription = query.get('error_description') ?? undefined;
    const redirectUriUsed = `${window.location.origin}${window.location.pathname}`;

    const payload =
      error != null
        ? {
            type: 'threads-oauth' as const,
            error: error || 'unknown',
            error_reason: errorReason,
            error_description: errorDescription,
          }
        : {
            type: 'threads-oauth' as const,
            code: code ?? '',
            state: state ?? '',
            redirect_uri: redirectUriUsed,
          };

    if (window.opener) {
      window.opener.postMessage(payload, window.location.origin);
      setTimeout(() => window.close(), 150);
    } else {
      window.location.replace(`${window.location.origin}/omnichannel/integrations/instagram`);
    }
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
      <p className="text-sm text-gray-600">Closing window…</p>
      <p className="mt-2 text-xs text-gray-500">
        If this does not close, you will be redirected back to the app.
      </p>
    </div>
  );
}

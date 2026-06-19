/** Threads API app (separate Meta app from Facebook/Instagram Login). */
export function getThreadsAppId(): string {
  return (import.meta.env.VITE_THREADS_APP_ID as string)?.trim() || '';
}

export function getThreadsOAuthRedirectUri(): string {
  const override = (import.meta.env.VITE_THREADS_OAUTH_REDIRECT_URI as string)?.trim();
  if (override) return override;
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}/auth/threads/callback`;
}

export function hasThreadsOAuthConfig(): boolean {
  return !!getThreadsAppId();
}

export function isThreadsRedirectHttps(): boolean {
  const uri = getThreadsOAuthRedirectUri();
  return uri.startsWith('https://');
}

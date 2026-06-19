/** Threads API app (separate Meta app from Facebook/Instagram Login). */
export function getThreadsAppId(): string {
  return (import.meta.env.VITE_THREADS_APP_ID as string)?.trim() || '';
}

export function hasThreadsOAuthConfig(): boolean {
  return !!getThreadsAppId();
}

/** Threads API credentials — separate Meta app from META_APP_ID (Facebook/Instagram). */
export function threadsAppId(): string {
  return Deno.env.get("THREADS_APP_ID")?.trim() ?? "";
}

export function threadsAppSecret(): string {
  return Deno.env.get("THREADS_APP_SECRET")?.trim() ?? "";
}

export function isThreadsAppConfigured(): boolean {
  return !!threadsAppId() && !!threadsAppSecret();
}

export function threadsAppConfigErrorMessage(): string {
  return "Threads is not configured. Set THREADS_APP_ID and THREADS_APP_SECRET in Edge Function secrets.";
}

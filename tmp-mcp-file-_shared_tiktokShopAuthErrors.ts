/** Detect TikTok Shop API responses when the seller access token is no longer valid. */
export function isTikTokShopExpiredCredentialsError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("expired credentials") ||
    (lower.includes("access_token") && lower.includes("expired")) ||
    (lower.includes("x-tts-access-token") && lower.includes("expired")) ||
    lower.includes("invalid access token")
  );
}

export function isTikTokShopScopeOrAuthError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    isTikTokShopExpiredCredentialsError(message) ||
    lower.includes("access denied") ||
    lower.includes("scope") ||
    lower.includes("permission") ||
    lower.includes("unauthorized")
  );
}

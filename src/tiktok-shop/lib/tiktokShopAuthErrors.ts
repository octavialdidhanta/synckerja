export function isTikTokShopExpiredCredentialsError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("expired credentials") ||
    (lower.includes("access_token") && lower.includes("expired")) ||
    (lower.includes("x-tts-access-token") && lower.includes("expired")) ||
    lower.includes("invalid access token")
  );
}

export function isTikTokShopReconnectError(code: string, message: string): boolean {
  return (
    code === "TIKTOK_SHOP_SCOPE_ERROR" ||
    code === "TIKTOK_SHOP_PRODUCT_SCOPE_ERROR" ||
    isTikTokShopExpiredCredentialsError(message)
  );
}

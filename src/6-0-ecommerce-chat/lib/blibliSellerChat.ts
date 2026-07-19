/** Pure helpers for Blibli Seller Chat iframe (no secrets). */

export const BLIBLI_SELLER_CENTER_ORIGIN_DEFAULT = 'https://seller.blibli.com';

/** Iframe session ~8h; re-mint slightly early to avoid hard expiry mid-chat. */
export const BLIBLI_CHAT_SESSION_REFRESH_MS = (7 * 60 + 45) * 60 * 1000;

export function buildBlibliChatIframeUrl(
  authToken: string,
  origin: string = BLIBLI_SELLER_CENTER_ORIGIN_DEFAULT,
): string {
  const base = origin.replace(/\/+$/, '');
  const token = encodeURIComponent(authToken.trim());
  return `${base}/conversations?authToken=${token}&mode=iframe`;
}

export function isBlibliIframeUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.searchParams.get('mode') === 'iframe' &&
      Boolean(u.searchParams.get('authToken'));
  } catch {
    return false;
  }
}

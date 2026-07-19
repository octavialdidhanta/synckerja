/** Canonical routes for Operations → E-Commerce Chat. */

export const ECOMMERCE_CHAT_BASE_PATH = '/operations/sales/ecommerce-chat';

export const ECOMMERCE_CHAT_PAGE_PATH = ECOMMERCE_CHAT_BASE_PATH;

export type EcommerceChatPlatform = 'all' | 'shopee' | 'tiktok' | 'blibli';

export const ECOMMERCE_CHAT_PLATFORMS: readonly Exclude<EcommerceChatPlatform, 'all'>[] = [
  'shopee',
  'tiktok',
  'blibli',
] as const;

export function ecommerceChatPlatformPath(platform: EcommerceChatPlatform): string {
  if (platform === 'all') return ECOMMERCE_CHAT_BASE_PATH;
  return `${ECOMMERCE_CHAT_BASE_PATH}/${platform}`;
}

/** Deep-link into TikTok CS inbox with shop + conversation selected. */
export function tiktokEcommerceChatConversationPath(args: {
  accountId: string;
  conversationId: string;
}): string {
  const params = new URLSearchParams({
    account: args.accountId,
    conversation: args.conversationId,
  });
  return `${ecommerceChatPlatformPath('tiktok')}?${params.toString()}`;
}

export function parseEcommerceChatPlatform(raw: string | undefined): EcommerceChatPlatform {
  const value = (raw ?? '').trim().toLowerCase();
  if (value === 'shopee' || value === 'tiktok' || value === 'blibli') return value;
  return 'all';
}

import type { EcommerceChatPlatform } from '../lib/ecommerceChatPaths';

export type EcommerceChatChannelMeta = {
  id: Exclude<EcommerceChatPlatform, 'all'>;
  /** i18n key under operations.ecommerceChat.platforms.* */
  labelKey: string;
  /** Short status copy key under operations.ecommerceChat.status.* */
  statusKey: string;
};

export const ECOMMERCE_CHAT_CHANNELS: EcommerceChatChannelMeta[] = [
  { id: 'shopee', labelKey: 'shopee', statusKey: 'notConnected' },
  { id: 'tiktok', labelKey: 'tiktok', statusKey: 'notConnected' },
  { id: 'blibli', labelKey: 'blibli', statusKey: 'notConnected' },
];

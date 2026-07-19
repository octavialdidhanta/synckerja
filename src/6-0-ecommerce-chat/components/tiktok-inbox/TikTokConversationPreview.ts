import type { TFunction } from 'i18next';
import type { TikTokConversationMessage } from './tiktokConversation.types';

export const TIKTOK_MESSAGE_TYPES = [
  'TEXT',
  'IMAGE',
  'VIDEO',
  'PRODUCT_CARD',
  'ORDER_CARD',
  'RETURN_REFUND_CARD',
  'COUPON_CARD',
  'LOGISTICS_CARD',
  'EMOTICONS',
  'ALLOCATED_SERVICE',
  'NOTIFICATION',
  'BUYER_ENTER_FROM_TRANSFER',
  'BUYER_ENTER_FROM_PRODUCT',
  'BUYER_ENTER_FROM_ORDER',
  'OTHER',
] as const;

const KNOWN_TYPES = new Set<string>(TIKTOK_MESSAGE_TYPES);

export function formatTikTokLatestMessagePreview(
  message: TikTokConversationMessage | undefined,
  t: TFunction,
): string {
  if (!message) return t('operations.ecommerceChat.tiktok.preview.empty');

  const type = String(message.type ?? 'OTHER').toUpperCase();
  if (type === 'TEXT') {
    const text = parseTextContent(message.content);
    return text || t('operations.ecommerceChat.tiktok.preview.empty');
  }

  const key = KNOWN_TYPES.has(type) ? type : 'OTHER';
  return t(`operations.ecommerceChat.tiktok.messageTypes.${key}`);
}

export function formatTikTokConversationTime(unixSeconds: number | undefined): string {
  if (unixSeconds == null || !Number.isFinite(unixSeconds)) return '';
  const date = new Date(unixSeconds * 1000);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) {
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function parseTextContent(raw: string | undefined): string {
  const value = String(raw ?? '').trim();
  if (!value) return '';
  try {
    const parsed = JSON.parse(value) as { content?: unknown };
    return typeof parsed.content === 'string' ? parsed.content.trim() : value;
  } catch {
    return value;
  }
}

export type ParsedImageContent = {
  url: string;
  width?: string;
  height?: string;
};

export function parseImageContent(raw: string | undefined): ParsedImageContent | null {
  const value = String(raw ?? '').trim();
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as { url?: unknown; width?: unknown; height?: unknown };
    const url = typeof parsed.url === 'string' ? parsed.url.trim() : '';
    if (!url) return null;
    return {
      url,
      width: parsed.width != null ? String(parsed.width) : undefined,
      height: parsed.height != null ? String(parsed.height) : undefined,
    };
  } catch {
    return null;
  }
}

export type ParsedVideoContent = {
  url?: string;
  cover?: string;
  width?: number;
  height?: number;
  duration?: string;
};

export function parseVideoContent(raw: string | undefined): ParsedVideoContent | null {
  const value = String(raw ?? '').trim();
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return {
      url: typeof parsed.url === 'string' ? parsed.url : undefined,
      cover: typeof parsed.cover === 'string' ? parsed.cover : undefined,
      width: parsed.width != null && Number.isFinite(Number(parsed.width))
        ? Number(parsed.width)
        : undefined,
      height: parsed.height != null && Number.isFinite(Number(parsed.height))
        ? Number(parsed.height)
        : undefined,
      duration: parsed.duration != null ? String(parsed.duration) : undefined,
    };
  } catch {
    return null;
  }
}

export function parseIdFromContent(
  raw: string | undefined,
  field: 'product_id' | 'order_id' | 'coupon_id' | 'sku_id' | 'package_id',
): string {
  const value = String(raw ?? '').trim();
  if (!value) return '';
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return parsed[field] != null ? String(parsed[field]).trim() : '';
  } catch {
    return '';
  }
}

export function messageTypeLabel(type: string | undefined, t: TFunction): string {
  const key = String(type ?? 'OTHER').toUpperCase();
  const known = KNOWN_TYPES.has(key) ? key : 'OTHER';
  return t(`operations.ecommerceChat.tiktok.messageTypes.${known}`);
}

/** API returns DESC pages; reverse each page and prepend older pages for ASC chat order. */
export function flattenMessagesAscending(
  pages: { messages: TikTokConversationMessage[] }[],
): TikTokConversationMessage[] {
  const map = new Map<string, TikTokConversationMessage>();
  // pages[0] = newest page; later pages = older. Build ASC: older first.
  for (let i = pages.length - 1; i >= 0; i--) {
    const chronological = [...(pages[i]?.messages ?? [])].reverse();
    for (const msg of chronological) {
      if (!msg.id) continue;
      if (msg.is_visible === false) continue;
      map.set(msg.id, msg);
    }
  }
  return Array.from(map.values());
}

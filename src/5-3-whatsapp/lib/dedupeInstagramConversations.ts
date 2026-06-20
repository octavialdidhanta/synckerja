import type { InstagramConversation } from '../types';

function customerDedupeKey(conv: InstagramConversation): string {
  const external = (conv as { customer_external_id?: string | null }).customer_external_id?.trim();
  if (external) return external.toLowerCase();

  const name = conv.customer_name?.trim() ?? '';
  if (name.startsWith('@')) return name.slice(1).toLowerCase();

  return (conv.customer_ig_id ?? '').trim().toLowerCase();
}

/** Hide duplicate IG threads (same inbox + same customer identity) after reconnect / ID drift. */
export function dedupeInstagramConversations(conversations: InstagramConversation[]): InstagramConversation[] {
  const byKey = new Map<string, InstagramConversation>();

  for (const conv of conversations) {
    const inboxId = (conv.instagram_business_account_id ?? '').trim();
    const customerKey = customerDedupeKey(conv);
    if (!inboxId || !customerKey) {
      byKey.set(conv.id, conv);
      continue;
    }

    const key = `${inboxId}|${customerKey}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, conv);
      continue;
    }

    const existingAt = existing.last_message_at ? new Date(existing.last_message_at).getTime() : 0;
    const convAt = conv.last_message_at ? new Date(conv.last_message_at).getTime() : 0;
    if (convAt >= existingAt) {
      byKey.delete(existing.id);
      byKey.set(key, conv);
    }
  }

  return Array.from(byKey.values());
}

import type { InstagramConversation } from '../types';

function normalizeUsername(name: string | null | undefined): string {
  return (name ?? '').trim().replace(/^@+/i, '').toLowerCase();
}

/** Match server instagramConversationCustomerDedupeKey (@username > external > ig id). */
function customerDedupeKey(conv: InstagramConversation): string {
  const username = normalizeUsername(conv.customer_name?.trim().startsWith('@') ? conv.customer_name : null);
  if (username) return username;

  const external = (conv as { customer_external_id?: string | null }).customer_external_id?.trim().toLowerCase();
  if (external) return external;

  const ig = conv.customer_ig_id?.trim().toLowerCase();
  if (ig) return ig;

  return '';
}

function customerIdentityTokens(conv: InstagramConversation): Set<string> {
  const tokens = new Set<string>();
  const ig = conv.customer_ig_id?.trim().toLowerCase();
  const ext = (conv as { customer_external_id?: string | null }).customer_external_id?.trim().toLowerCase();
  if (ig) tokens.add(ig);
  if (ext) tokens.add(ext);
  const username = normalizeUsername(conv.customer_name?.trim().startsWith('@') ? conv.customer_name : null);
  if (username) tokens.add(`@${username}`);
  return tokens;
}

function identitiesOverlap(a: InstagramConversation, b: InstagramConversation): boolean {
  const ta = customerIdentityTokens(a);
  const tb = customerIdentityTokens(b);
  for (const t of ta) {
    if (tb.has(t)) return true;
  }
  const aUser = normalizeUsername(a.customer_name?.trim().startsWith('@') ? a.customer_name : null);
  const bUser = normalizeUsername(b.customer_name?.trim().startsWith('@') ? b.customer_name : null);
  if (aUser && bUser && aUser === bUser) return true;
  return false;
}

function pickKeeper(a: InstagramConversation, b: InstagramConversation): InstagramConversation {
  const score = (c: InstagramConversation) => {
    let s = 0;
    if (c.customer_name?.trim()) s += 20;
    if ((c as { customer_external_id?: string | null }).customer_external_id?.trim()) s += 10;
    if (c.last_message_at) s += 1;
    return s;
  };
  const scoreDiff = score(b) - score(a);
  if (scoreDiff !== 0) return scoreDiff > 0 ? b : a;
  const at = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
  const bt = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
  return bt >= at ? b : a;
}

/** Hide duplicate IG threads (IGSID vs business account id drift) per inbox. */
export function dedupeInstagramConversations(conversations: InstagramConversation[]): InstagramConversation[] {
  const groups: InstagramConversation[][] = [];

  for (const conv of conversations) {
    const inboxId = (conv.instagram_business_account_id ?? '').trim();
    if (!inboxId) {
      groups.push([conv]);
      continue;
    }

    let placed = false;
    for (const group of groups) {
      const sample = group[0];
      if ((sample.instagram_business_account_id ?? '').trim() !== inboxId) continue;
      if (identitiesOverlap(conv, sample) || customerDedupeKey(conv) === customerDedupeKey(sample)) {
        group.push(conv);
        placed = true;
        break;
      }
    }
    if (!placed) groups.push([conv]);
  }

  const result: InstagramConversation[] = [];
  for (const group of groups) {
    if (group.length === 1) {
      result.push(group[0]);
      continue;
    }
    let keeper = group[0];
    for (let i = 1; i < group.length; i++) {
      keeper = pickKeeper(keeper, group[i]);
    }
    result.push(keeper);
  }

  return result.sort((a, b) => {
    const at = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
    const bt = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
    return bt - at;
  });
}

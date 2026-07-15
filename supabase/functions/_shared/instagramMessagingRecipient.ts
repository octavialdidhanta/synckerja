import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isLikelyInstagramBusinessAccountId } from "./instagramAccountDedupe.ts";
import { metaGraphVersion } from "./metaPlatformScopes.ts";

type ConversationParticipant = { id?: string; username?: string; name?: string };

function uniqueIds(ids: Array<string | null | undefined>): string[] {
  return [...new Set(ids.map((id) => (id ?? "").trim()).filter(Boolean))];
}

/**
 * Echo DMs from another connected IG professional account may store the sender as
 * instagram_business_account_id. Meta Send API requires the Instagram-scoped ID (IGSID)
 * from the Page conversation thread — resolve via Graph conversations when needed.
 */
export async function resolveInstagramDmRecipientId(
  supabase: SupabaseClient,
  orgId: string,
  inboxIgBusinessAccountId: string,
  storedCustomerId: string,
  pageId: string,
  pageToken: string,
  options?: { altCustomerIds?: string[] },
): Promise<string> {
  const primary = storedCustomerId.trim();
  const inboxId = inboxIgBusinessAccountId.trim();
  const page = pageId.trim();
  const token = pageToken.trim();
  if (!primary || !inboxId || !page || !token) return primary;

  const candidateIds = uniqueIds([primary, ...(options?.altCustomerIds ?? [])]);
  let linkedBusinessId: string | null = null;
  let targetUsername = "";

  for (const cid of candidateIds) {
    const { data: linkedAcc } = await supabase
      .from("organization_instagram_accounts")
      .select("instagram_business_account_id, instagram_username")
      .eq("organization_id", orgId)
      .eq("instagram_business_account_id", cid)
      .eq("is_active", true)
      .maybeSingle();

    if (linkedAcc) {
      linkedBusinessId = cid;
      targetUsername = (linkedAcc.instagram_username ?? "").trim().toLowerCase();
      break;
    }
  }

  if (!linkedBusinessId) {
    return primary;
  }

  for (const probeId of candidateIds) {
    const viaUserFilter = await lookupParticipantViaUserIdConversation(
      page,
      token,
      inboxId,
      probeId,
      targetUsername,
      linkedBusinessId,
    );
    if (viaUserFilter && viaUserFilter !== linkedBusinessId) {
      console.log("[instagramMessagingRecipient] resolved via user_id conversation filter", {
        businessId: linkedBusinessId,
        igsid: viaUserFilter,
        probeId,
      });
      return viaUserFilter;
    }
  }

  const resolvedFromScan = await lookupParticipantIgsidFromPageConversations(
    page,
    token,
    inboxId,
    targetUsername,
    linkedBusinessId,
  );
  if (resolvedFromScan && resolvedFromScan !== linkedBusinessId) {
    console.log("[instagramMessagingRecipient] resolved connected account to IGSID", {
      businessId: linkedBusinessId,
      igsid: resolvedFromScan,
      username: targetUsername,
    });
    return resolvedFromScan;
  }

  return primary;
}

/** Resolve with retries — Page conversations may lag a few seconds after first inbound webhook. */
export async function resolveInstagramDmRecipientIdWithRetry(
  supabase: SupabaseClient,
  orgId: string,
  inboxIgBusinessAccountId: string,
  storedCustomerId: string,
  pageId: string,
  pageToken: string,
  options?: { altCustomerIds?: string[]; attempts?: number; delayMs?: number },
): Promise<string> {
  const attempts = Math.max(1, options?.attempts ?? 3);
  const delayMs = options?.delayMs ?? 700;
  const candidateIds = uniqueIds([storedCustomerId, ...(options?.altCustomerIds ?? [])]);

  let linkedBusinessId: string | null = null;
  for (const cid of candidateIds) {
    const { data: linkedAcc } = await supabase
      .from("organization_instagram_accounts")
      .select("instagram_business_account_id")
      .eq("organization_id", orgId)
      .eq("instagram_business_account_id", cid)
      .eq("is_active", true)
      .maybeSingle();
    if (linkedAcc) {
      linkedBusinessId = cid;
      break;
    }
  }

  if (!linkedBusinessId) {
    return storedCustomerId.trim();
  }

  let last = storedCustomerId.trim();
  for (let i = 0; i < attempts; i++) {
    last = await resolveInstagramDmRecipientId(
      supabase,
      orgId,
      inboxIgBusinessAccountId,
      storedCustomerId,
      pageId,
      pageToken,
      options,
    );
    if (last !== linkedBusinessId && !isLikelyInstagramBusinessAccountId(last)) {
      return last;
    }
    if (i < attempts - 1) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return last;
}

async function lookupParticipantViaUserIdConversation(
  pageId: string,
  pageToken: string,
  inboxIgBusinessAccountId: string,
  userId: string,
  targetUsername: string,
  linkedBusinessId: string,
): Promise<string | null> {
  try {
    const url =
      `https://graph.facebook.com/${metaGraphVersion()}/${encodeURIComponent(pageId)}/conversations` +
      `?platform=instagram&user_id=${encodeURIComponent(userId)}&fields=participants&limit=10` +
      `&access_token=${encodeURIComponent(pageToken)}`;
    const res = await fetch(url);
    const data = await res.json().catch(() => ({})) as {
      data?: Array<{ participants?: { data?: ConversationParticipant[] } }>;
      error?: { message?: string };
    };
    if (!res.ok) {
      console.warn("[instagramMessagingRecipient] user_id conversation filter error", data.error?.message);
      return null;
    }

    for (const thread of data.data ?? []) {
      const resolved = pickMessagingParticipantFromThread(
        thread.participants?.data ?? [],
        inboxIgBusinessAccountId,
        targetUsername,
        linkedBusinessId,
      );
      if (resolved) return resolved;
    }
  } catch (e) {
    console.warn("[instagramMessagingRecipient] user_id conversation lookup failed", e);
  }
  return null;
}

function pickMessagingParticipantFromThread(
  participants: ConversationParticipant[],
  inboxIgBusinessAccountId: string,
  targetUsername: string,
  linkedBusinessId: string,
): string | null {
  const includesInbox = participants.some((p) => String(p.id ?? "").trim() === inboxIgBusinessAccountId);
  const includesLinked = participants.some((p) => String(p.id ?? "").trim() === linkedBusinessId);

  if (!includesInbox && !includesLinked) return null;

  for (const p of participants) {
    const pid = p.id != null ? String(p.id).trim() : "";
    const pun = (p.username ?? "").trim().toLowerCase();
    if (!pid || pid === inboxIgBusinessAccountId || pid === linkedBusinessId) continue;
    if (targetUsername && pun === targetUsername) return pid;
    if (!isLikelyInstagramBusinessAccountId(pid)) return pid;
  }
  return null;
}

async function lookupParticipantIgsidFromPageConversations(
  pageId: string,
  pageToken: string,
  inboxIgBusinessAccountId: string,
  targetUsername: string,
  linkedBusinessId: string,
): Promise<string | null> {
  try {
    let nextUrl: string | null =
      `https://graph.facebook.com/${metaGraphVersion()}/${encodeURIComponent(pageId)}/conversations` +
      `?platform=instagram&fields=participants&limit=50` +
      `&access_token=${encodeURIComponent(pageToken)}`;

    for (let page = 0; page < 5 && nextUrl; page++) {
      const res = await fetch(nextUrl);
      const data = await res.json().catch(() => ({})) as {
        data?: Array<{ participants?: { data?: ConversationParticipant[] } }>;
        paging?: { next?: string };
        error?: { message?: string };
      };
      if (!res.ok) {
        console.warn("[instagramMessagingRecipient] conversations API error", data.error?.message);
        break;
      }

      for (const thread of data.data ?? []) {
        const resolved = pickMessagingParticipantFromThread(
          thread.participants?.data ?? [],
          inboxIgBusinessAccountId,
          targetUsername,
          linkedBusinessId,
        );
        if (resolved) return resolved;
      }

      nextUrl = data.paging?.next ?? null;
    }
  } catch (e) {
    console.warn("[instagramMessagingRecipient] conversations lookup failed", e);
  }
  return null;
}

export { isLikelyInstagramBusinessAccountId };

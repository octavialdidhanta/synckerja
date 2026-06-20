import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const META_GRAPH_VERSION = "v21.0";

type ConversationParticipant = { id?: string; username?: string; name?: string };

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
): Promise<string> {
  const cid = storedCustomerId.trim();
  const inboxId = inboxIgBusinessAccountId.trim();
  const page = pageId.trim();
  const token = pageToken.trim();
  if (!cid || !inboxId || !page || !token) return cid;

  const { data: linkedAcc } = await supabase
    .from("organization_instagram_accounts")
    .select("instagram_business_account_id, instagram_username")
    .eq("organization_id", orgId)
    .eq("instagram_business_account_id", cid)
    .eq("is_active", true)
    .maybeSingle();

  if (!linkedAcc) return cid;

  const targetUsername = (linkedAcc.instagram_username ?? "").trim().toLowerCase();
  const resolvedFromApi = await lookupParticipantIgsidFromPageConversations(
    page,
    token,
    inboxId,
    targetUsername,
    cid,
  );
  if (resolvedFromApi && resolvedFromApi !== cid) {
    console.log("[instagramMessagingRecipient] resolved connected account to IGSID", {
      businessId: cid,
      igsid: resolvedFromApi,
      username: targetUsername,
    });
    return resolvedFromApi;
  }

  return cid;
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
      `https://graph.facebook.com/${META_GRAPH_VERSION}/${encodeURIComponent(pageId)}/conversations` +
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
        const participants = thread.participants?.data ?? [];
        const includesInbox = participants.some((p) => {
          const pid = String(p.id ?? "").trim();
          return pid === inboxIgBusinessAccountId;
        });

        for (const p of participants) {
          const pid = p.id != null ? String(p.id).trim() : "";
          const pun = (p.username ?? "").trim().toLowerCase();
          if (!pid || pid === inboxIgBusinessAccountId) continue;
          if (targetUsername && pun === targetUsername && pid !== linkedBusinessId) {
            return pid;
          }
        }

        if (!includesInbox) {
          for (const p of participants) {
            const pid = p.id != null ? String(p.id).trim() : "";
            const pun = (p.username ?? "").trim().toLowerCase();
            if (!pid || pid === linkedBusinessId) continue;
            if (targetUsername && pun === targetUsername) return pid;
          }
          continue;
        }

        for (const p of participants) {
          const pid = p.id != null ? String(p.id).trim() : "";
          const pun = (p.username ?? "").trim().toLowerCase();
          if (!pid || pid === inboxIgBusinessAccountId || pid === linkedBusinessId) continue;
          if (targetUsername && pun === targetUsername) return pid;
        }
      }

      nextUrl = data.paging?.next ?? null;
    }
  } catch (e) {
    console.warn("[instagramMessagingRecipient] conversations lookup failed", e);
  }
  return null;
}

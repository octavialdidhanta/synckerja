import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  fetchThreadReplies,
  fetchThreadsList,
  type ThreadsComment,
} from "./threadsContentApi.ts";
import {
  processThreadsLivechatWebhook,
  type ThreadsWebhookAccount,
  type ThreadsWebhookPayload,
} from "./threadsLivechatWebhook.ts";

const DEFAULT_LOOKBACK_DAYS = 60;
const DEFAULT_MAX_POSTS = 40;
const MAX_REPLIES_PER_SYNC = 40;

async function loadKnownInboundMessageIdsForOrg(
  admin: SupabaseClient,
  organizationId: string,
): Promise<Set<string>> {
  const { data: convRows, error: convErr } = await admin
    .from("threads_conversations")
    .select("id")
    .eq("organization_id", organizationId);
  if (convErr) throw new Error(convErr.message);

  const convIds = (convRows ?? [])
    .map((row) => String((row as { id?: unknown }).id ?? "").trim())
    .filter(Boolean);
  if (convIds.length === 0) return new Set();

  const { data: msgRows, error: msgErr } = await admin
    .from("threads_messages")
    .select("platform_message_id")
    .in("conversation_id", convIds)
    .not("platform_message_id", "is", null);
  if (msgErr) throw new Error(msgErr.message);

  const ids = new Set<string>();
  for (const row of msgRows ?? []) {
    const id = String((row as { platform_message_id?: unknown }).platform_message_id ?? "").trim();
    if (id) ids.add(id);
  }
  return ids;
}

function formatYmd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function commentToWebhookPayload(
  reply: ThreadsComment,
  postId: string,
  threadsUserId: string,
): ThreadsWebhookPayload {
  const username = reply.author_name.replace(/^@+/, "").trim();
  const tsSec = reply.published_at
    ? Math.floor(new Date(reply.published_at).getTime() / 1000)
    : Math.floor(Date.now() / 1000);
  const parentId = reply.parent_comment_id?.trim() || postId;

  return {
    target_id: threadsUserId,
    time: tsSec,
    values: {
      field: "replies",
      value: {
        id: reply.id,
        text: reply.text,
        username,
        timestamp: reply.published_at,
        is_reply_owned_by_me: reply.is_owner,
        root_post: { id: postId, owner_id: threadsUserId },
        replied_to: { id: parentId },
      },
    },
  };
}

export type SyncThreadsLivechatResult = {
  ingested: number;
  scanned_posts: number;
  scanned_replies: number;
  threads_user_id: string;
};

export async function syncThreadsLivechatInboundForAccount(
  admin: SupabaseClient,
  account: ThreadsWebhookAccount,
  accessToken: string,
  options?: { lookbackDays?: number; maxPosts?: number; knownInboundMessageIds?: Set<string> },
): Promise<SyncThreadsLivechatResult> {
  const lookbackDays = options?.lookbackDays ?? DEFAULT_LOOKBACK_DAYS;
  const maxPosts = options?.maxPosts ?? DEFAULT_MAX_POSTS;
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - lookbackDays);

  let posts = await fetchThreadsList(accessToken, maxPosts, { allTime: true });
  if (posts.length === 0) {
    posts = await fetchThreadsList(accessToken, maxPosts, {
      startYmd: formatYmd(start),
      endYmd: formatYmd(end),
    });
  }

  let ingested = 0;
  let scannedReplies = 0;
  let skippedOwner = 0;
  let skippedKnown = 0;
  let processed = 0;
  const ensuredLivechatStatusOrgs = new Set<string>();
  const knownInboundMessageIds = options?.knownInboundMessageIds ?? new Set<string>();
  const noopPush = async () => {};

  for (const post of posts) {
    const postId = String(post.id ?? "").trim();
    if (!postId) continue;

    const replies = await fetchThreadReplies(postId, accessToken);
    scannedReplies += replies.length;

    for (const reply of replies) {
      if (!reply.id?.trim()) continue;
      if (reply.is_owner) {
        skippedOwner += 1;
        continue;
      }
      const replyId = reply.id.trim();
      if (knownInboundMessageIds.has(replyId)) {
        skippedKnown += 1;
        continue;
      }
      if (processed >= MAX_REPLIES_PER_SYNC) {
        break;
      }
      processed += 1;

      const payload = commentToWebhookPayload(
        reply,
        postId,
        account.threads_user_id,
      );
      const ok = await processThreadsLivechatWebhook(
        admin,
        account,
        payload,
        noopPush,
        ensuredLivechatStatusOrgs,
        {
          knownInboundMessageIds,
          onInserted: () => {
            ingested += 1;
          },
        },
      );
      if (!ok) {
        /* keep scanning */
      }
    }
    if (processed >= MAX_REPLIES_PER_SYNC) break;
  }

  if (posts.length > 0) {
    console.log("[threads-livechat-sync]", {
      threads_user_id: account.threads_user_id,
      posts: posts.length,
      scanned_replies: scannedReplies,
      skipped_owner: skippedOwner,
      skipped_known: skippedKnown,
      ingested,
    });
  }

  return {
    ingested,
    scanned_posts: posts.length,
    scanned_replies: scannedReplies,
    threads_user_id: account.threads_user_id,
  };
}

export async function syncThreadsLivechatInboundForOrg(
  admin: SupabaseClient,
  organizationId: string,
  getAccessToken: (threadsUserId: string) => Promise<string | null>,
  accounts: ThreadsWebhookAccount[],
  options?: { lookbackDays?: number; maxPosts?: number },
): Promise<{
  ingested: number;
  scanned_posts: number;
  scanned_replies: number;
  accounts_synced: number;
}> {
  let ingested = 0;
  let scannedPosts = 0;
  let scannedReplies = 0;
  let accountsSynced = 0;

  const knownInboundMessageIds = await loadKnownInboundMessageIdsForOrg(admin, organizationId);

  const seenThreadsUserIds = new Set<string>();
  for (const account of accounts) {
    const threadsUserId = String(account.threads_user_id ?? "").trim();
    if (!threadsUserId || seenThreadsUserIds.has(threadsUserId)) continue;
    seenThreadsUserIds.add(threadsUserId);

    const accessToken = await getAccessToken(threadsUserId);
    if (!accessToken) continue;

    const result = await syncThreadsLivechatInboundForAccount(
      admin,
      account,
      accessToken,
      { ...options, knownInboundMessageIds },
    );
    ingested += result.ingested;
    scannedPosts += result.scanned_posts;
    scannedReplies += result.scanned_replies;
    accountsSynced += 1;
  }

  return {
    ingested,
    scanned_posts: scannedPosts,
    scanned_replies: scannedReplies,
    accounts_synced: accountsSynced,
  };
}

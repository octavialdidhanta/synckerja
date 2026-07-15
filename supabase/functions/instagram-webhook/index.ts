import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  processFacebookMessengerEvents,
  resolveFacebookPageForWebhookEntry,
} from "../_shared/facebookMessengerWebhook.ts";
import { resolveInstagramDmRecipientIdWithRetry } from "../_shared/instagramMessagingRecipient.ts";
import {
  instagramConversationCustomerDedupeKey,
  instagramCustomerIdentitiesOverlap,
  mergeInstagramConversationDuplicates,
  normalizeInstagramUsername,
} from "../_shared/instagramAccountDedupe.ts";
import { syncMetaManageCommentsInboundComments } from "../_shared/metaManageCommentsInboxState.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const META_GRAPH_VERSION = "v21.0";
const INSTAGRAM_MEDIA_BUCKET = "whatsapp-media";
const META_SESSION_MS = 24 * 60 * 60 * 1000;
const LAZY_VIDEO_BYTES = 10 * 1024 * 1024;

function extensionFromMediaType(mediaType: string, mime?: string): string {
  const map: Record<string, string> = {
    image: "jpg",
    video: "mp4",
    audio: "mp3",
    file: "bin",
  };
  const t = mediaType.trim().toLowerCase();
  if (mime) {
    const m = mime.toLowerCase();
    if (m.includes("jpeg") || m.includes("jpg")) return "jpg";
    if (m.includes("png")) return "png";
    if (m.includes("gif")) return "gif";
    if (m.includes("webp")) return "webp";
    if (m.includes("mp4")) return "mp4";
    if (m.includes("mpeg")) return "mp3";
  }
  return map[t] ?? "bin";
}

function getInstagramAttachmentInfo(
  msg: Record<string, unknown>,
): { type: string; url: string } | null {
  const attachments = msg.attachments as Array<{ type?: string; payload?: { url?: string } }> | undefined;
  if (!Array.isArray(attachments) || attachments.length === 0) return null;
  const first = attachments[0];
  const url = typeof first?.payload?.url === "string" ? first.payload.url.trim() : "";
  const type = typeof first?.type === "string" ? first.type.trim().toLowerCase() : "file";
  if (!url) return null;
  return { type, url };
}

async function downloadInstagramAttachmentToStorage(
  downloadUrl: string,
  accessToken: string,
  supabase: ReturnType<typeof createClient>,
  conversationId: string,
  platformMessageId: string,
  mediaType: string,
): Promise<string | null> {
  try {
    const fileRes = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!fileRes.ok) return null;

    const contentLength = Number(fileRes.headers.get("content-length") ?? 0);
    const isVideo = mediaType === "video";
    if (isVideo && contentLength > LAZY_VIDEO_BYTES) return null;

    const blob = await fileRes.blob();
    if (isVideo && blob.size > LAZY_VIDEO_BYTES) return null;

    const ext = extensionFromMediaType(mediaType, blob.type);
    const safeId = platformMessageId.replace(/\W/g, "_");
    const path = `ig/inbound/${conversationId}/${safeId}.${ext}`;

    const { error: uploadErr } = await supabase.storage.from(INSTAGRAM_MEDIA_BUCKET).upload(path, blob, {
      contentType: blob.type || undefined,
      upsert: true,
    });
    if (uploadErr) {
      console.warn("[instagram-webhook] storage upload failed", uploadErr.message);
      return null;
    }
    const { data: urlData } = supabase.storage.from(INSTAGRAM_MEDIA_BUCKET).getPublicUrl(path);
    return urlData.publicUrl;
  } catch (e) {
    console.warn("[instagram-webhook] download attachment error", e);
    return null;
  }
}

async function extendInstagramMetaSession(
  supabase: ReturnType<typeof createClient>,
  conversationId: string,
  inboundTimestampIso: string,
): Promise<void> {
  const inboundMs = new Date(inboundTimestampIso).getTime();
  if (Number.isNaN(inboundMs)) return;
  const expiresAt = new Date(inboundMs + META_SESSION_MS).toISOString();

  const { data: row } = await supabase
    .from("instagram_conversations")
    .select("meta_session_expires_at")
    .eq("id", conversationId)
    .maybeSingle();

  const prevMs = row?.meta_session_expires_at
    ? new Date(String(row.meta_session_expires_at)).getTime()
    : 0;
  const nextMs = new Date(expiresAt).getTime();
  const maxMs = Math.max(prevMs, nextMs);

  await supabase
    .from("instagram_conversations")
    .update({
      meta_session_expires_at: new Date(maxMs).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversationId);
}

async function handleInstagramReadReceipt(
  supabase: ReturnType<typeof createClient>,
  convId: string,
  read: { watermark?: unknown; mid?: unknown },
): Promise<void> {
  const now = new Date().toISOString();

  if (read.mid != null) {
    const mid = String(read.mid).trim();
    if (mid) {
      await supabase
        .from("instagram_messages")
        .update({ status: "read", status_updated_at: now, read_at: now })
        .eq("conversation_id", convId)
        .eq("platform_message_id", mid)
        .eq("direction", "outbound");
    }
  }

  if (read.watermark != null) {
    const wmMs = Number(read.watermark);
    if (Number.isFinite(wmMs) && wmMs > 0) {
      const wmIso = new Date(wmMs).toISOString();
      await supabase
        .from("instagram_messages")
        .update({ status: "read", status_updated_at: now, read_at: now })
        .eq("conversation_id", convId)
        .eq("direction", "outbound")
        .lte("created_at", wmIso);
    }
  }

  const { data: conv } = await supabase
    .from("instagram_conversations")
    .select("last_message_direction")
    .eq("id", convId)
    .maybeSingle();
  if (conv?.last_message_direction === "outbound") {
    await supabase
      .from("instagram_conversations")
      .update({ last_message_status: "read", updated_at: now })
      .eq("id", convId);
  }
}

function getMessageBody(evt: Record<string, unknown>): { body: string; messageType: string } {
  const msg = evt.message as Record<string, unknown> | undefined;
  if (!msg) return { body: "", messageType: "text" };
  if (msg.is_unsupported) return { body: "[Unsupported]", messageType: "unsupported" };
  if (msg.is_deleted) return { body: "[Deleted]", messageType: "text" };
  const text = typeof msg.text === "string" ? msg.text : (msg.text as { text?: string } | undefined)?.text;
  if (text != null && String(text).trim() !== "") return { body: String(text).trim(), messageType: "text" };
  const attachments = msg.attachments as Array<{ type?: string }> | undefined;
  if (Array.isArray(attachments) && attachments.length > 0) {
    const t = attachments[0]?.type ?? "file";
    return { body: `[${t}]`, messageType: t };
  }
  const quickReply = msg.quick_reply as { payload?: string } | undefined;
  if (quickReply?.payload) return { body: String(quickReply.payload), messageType: "quick_reply" };
  return { body: "[message]", messageType: "text" };
}

/** Resolve display name for Instagram-scoped sender id via Graph API (requires page token + instagram_manage_messages). */
async function fetchInstagramSenderDisplayName(
  senderIgId: string,
  pageAccessToken: string,
): Promise<string | null> {
  const token = pageAccessToken.trim();
  const igId = senderIgId.trim();
  if (!token || !igId) return null;

  const url =
    `https://graph.facebook.com/${META_GRAPH_VERSION}/${encodeURIComponent(igId)}` +
    `?fields=${encodeURIComponent("name,username,profile_pic,profile_picture_url")}` +
    `&access_token=${encodeURIComponent(token)}`;

  try {
    const res = await fetch(url, { method: "GET" });
    const data = await res.json().catch(() => ({})) as {
      name?: string;
      username?: string;
      error?: { message?: string };
    };
    if (!res.ok || data.error) {
      console.warn("[instagram-webhook] sender profile fetch failed", igId, data.error?.message ?? res.status);
      return null;
    }
    const username = typeof data.username === "string" ? data.username.trim().replace(/^@/, "") : "";
    const name = typeof data.name === "string" ? data.name.trim() : "";
    if (username) return `@${username}`;
    if (name) return name;
    return null;
  } catch (e) {
    console.warn("[instagram-webhook] sender profile fetch error", igId, e);
    return null;
  }
}

/** Create lead for new Instagram conversation (ticket_id IG-xxx). */
async function ensureLeadForNewInstagramConversation(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  convId: string,
  clientName: string,
  title: string,
  customerIgId: string,
  createdByDisplayName: string
): Promise<void> {
  const ticketId = "IG-" + String(convId).replace(/-/g, "").slice(0, 8).toUpperCase();
  const { data: existing } = await supabase.from("leads").select("id").eq("ticket_id", ticketId).maybeSingle();
  if (existing) return;

  const { data: unreadStatus } = await supabase
    .from("lead_statuses")
    .select("id")
    .or(`organization_id.eq.${orgId},organization_id.is.null`)
    .eq("name", "Unread")
    .maybeSingle();
  const { data: openStatus } = await supabase
    .from("lead_statuses")
    .select("id")
    .or(`organization_id.eq.${orgId},organization_id.is.null`)
    .eq("name", "Open")
    .maybeSingle();
  const statusId = openStatus?.id ?? unreadStatus?.id ?? null;
  if (!statusId) {
    console.warn("ensureLeadForNewInstagramConversation: no Open/Unread status, skip lead insert");
    return;
  }

  const safeClient = (clientName && String(clientName).trim()) || "Instagram";
  const safeTitle = (title && String(title).trim().slice(0, 100)) || "Instagram";

  const { error } = await supabase.from("leads").insert({
    ticket_id: ticketId,
    client: safeClient,
    title: safeTitle,
    category: "",
    created_by: "00000000-0000-0000-0000-000000000000",
    created_by_name: createdByDisplayName,
    assignee: "",
    status_id: statusId,
    organization_id: orgId,
    source: "Instagram",
    services: null,
    followup: 0,
    phone_number: null,
  });
  if (error) console.error("ensureLeadForNewInstagramConversation: insert error", error);
}

/** Inline: deploy bundle — avoid separate module import. */
type LivechatPushTable =
  | "whatsapp_messages"
  | "instagram_messages"
  | "facebook_messages"
  | "email_messages";

type InstagramWebhookAccount = {
  organization_id: string;
  page_access_token: string | null;
  instagram_username: string | null;
  instagram_name: string | null;
  instagram_business_account_id: string;
  facebook_page_id: string;
  threads_user_id: string | null;
  threads_username: string | null;
  has_threads: boolean | null;
};

type MessagingEvt = {
  message?: {
    is_echo?: boolean;
    is_deleted?: boolean;
    is_unsupported?: boolean;
    mid?: string;
    text?: unknown;
    attachments?: unknown[];
    reply_to?: { mid?: string };
    quick_reply?: { payload?: string };
  };
  postback?: { title?: string; payload?: string };
  read?: { watermark?: unknown; mid?: unknown };
  sender?: { id?: unknown };
  recipient?: { id?: unknown };
  timestamp?: unknown;
};

const SUPPORTED_INSTAGRAM_WEBHOOK_OBJECTS = new Set(["instagram", "page"]);

const IG_ACCOUNT_SELECT =
  "organization_id, page_access_token, instagram_username, instagram_name, instagram_business_account_id, facebook_page_id, threads_user_id, threads_username, has_threads";

async function lookupInstagramAccountByField(
  supabase: ReturnType<typeof createClient>,
  field: "instagram_business_account_id" | "facebook_page_id",
  value: string,
): Promise<InstagramWebhookAccount | null> {
  const { data, error } = await supabase
    .from("organization_instagram_accounts")
    .select(IG_ACCOUNT_SELECT)
    .eq(field, value)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error(`[instagram-webhook] account lookup by ${field} error:`, error.message);
  }
  return data ? (data as InstagramWebhookAccount) : null;
}

/** Prefer recipient.id (inbox owner) when org has multiple IG accounts sharing one Threads profile. */
async function resolveInstagramAccountForMessaging(
  supabase: ReturnType<typeof createClient>,
  entryId: string | null,
  recipientId: string | null,
  senderId: string | null = null,
): Promise<InstagramWebhookAccount | null> {
  const recipient = recipientId?.trim() ?? "";
  const entry = entryId?.trim() ?? "";
  const sender = senderId?.trim() ?? "";

  if (recipient) {
    const byRecipient = await lookupInstagramAccountByField(
      supabase,
      "instagram_business_account_id",
      recipient,
    );
    if (byRecipient) {
      console.log("[instagram-webhook] matched account via recipient.id:", recipient);
      return byRecipient;
    }
  }

  if (sender) {
    const bySender = await lookupInstagramAccountByField(
      supabase,
      "instagram_business_account_id",
      sender,
    );
    if (bySender) {
      console.log("[instagram-webhook] matched account via sender.id (business):", sender);
      return bySender;
    }
  }

  if (entry) {
    const byIg = await lookupInstagramAccountByField(
      supabase,
      "instagram_business_account_id",
      entry,
    );
    if (byIg) return byIg;

    const byPage = await lookupInstagramAccountByField(supabase, "facebook_page_id", entry);
    if (byPage) {
      console.log("[instagram-webhook] matched account via facebook_page_id:", entry);
      return byPage;
    }

    const { data: byThreadsList, error: byThreadsErr } = await supabase
      .from("organization_instagram_accounts")
      .select(IG_ACCOUNT_SELECT)
      .eq("threads_user_id", entry)
      .eq("is_active", true)
      .eq("has_threads", true);
    if (byThreadsErr) {
      console.error("[instagram-webhook] account lookup by threads_user_id error:", byThreadsErr.message);
    }
    const threadsMatches = (byThreadsList ?? []) as InstagramWebhookAccount[];
    if (threadsMatches.length === 1) {
      console.log("[instagram-webhook] matched account via threads_user_id:", entry);
      return threadsMatches[0];
    }
    if (threadsMatches.length > 1) {
      if (recipient) {
        const disambiguated = threadsMatches.find(
          (row) => String(row.instagram_business_account_id).trim() === recipient,
        );
        if (disambiguated) {
          console.log("[instagram-webhook] disambiguated shared threads_user_id via recipient:", recipient);
          return disambiguated;
        }
      }
      if (sender) {
        const bySenderBiz = threadsMatches.find(
          (row) => String(row.instagram_business_account_id).trim() === sender,
        );
        if (bySenderBiz) {
          console.log("[instagram-webhook] disambiguated shared threads_user_id via sender.id:", sender);
          return bySenderBiz;
        }
      }
      console.warn(
        "[instagram-webhook] ambiguous threads_user_id entry — multiple IG accounts; need recipient/sender.id",
        {
          entryId: entry,
          recipientId: recipient || null,
          senderId: sender || null,
          accounts: threadsMatches.map((row) => row.instagram_username ?? row.instagram_business_account_id),
        },
      );
      return null;
    }
  }

  const { data: singleAccount } = await supabase
    .from("organization_instagram_accounts")
    .select(IG_ACCOUNT_SELECT)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (singleAccount) {
    console.log("[instagram-webhook] using single active account fallback");
    return singleAccount as InstagramWebhookAccount;
  }
  return null;
}

/** Echo DMs to another connected IG account often use the contact IGSID as recipient.id, not business account id. */
async function resolveEchoBridgeInboxAccount(
  supabase: ReturnType<typeof createClient>,
  senderAccount: InstagramWebhookAccount,
  recipientId: string,
): Promise<InstagramWebhookAccount | null> {
  const rid = recipientId.trim();
  if (!rid) return null;

  const byBiz = await lookupInstagramAccountByField(
    supabase,
    "instagram_business_account_id",
    rid,
  );
  if (byBiz && byBiz.organization_id === senderAccount.organization_id) {
    return byBiz;
  }

  const senderBizId = String(senderAccount.instagram_business_account_id).trim();
  const { data: crossConv } = await supabase
    .from("instagram_conversations")
    .select("customer_name")
    .eq("organization_id", senderAccount.organization_id)
    .eq("instagram_business_account_id", senderBizId)
    .eq("customer_ig_id", rid)
    .maybeSingle();

  if (!crossConv) return null;

  const customerName = (crossConv as { customer_name?: string | null }).customer_name?.trim() ?? "";
  const { data: siblings } = await supabase
    .from("organization_instagram_accounts")
    .select(IG_ACCOUNT_SELECT)
    .eq("organization_id", senderAccount.organization_id)
    .eq("is_active", true);

  for (const row of siblings ?? []) {
    const sibling = row as InstagramWebhookAccount;
    const siblingBizId = String(sibling.instagram_business_account_id).trim();
    if (siblingBizId === senderBizId) continue;
    const uname = sibling.instagram_username?.trim();
    if (uname && customerName.toLowerCase() === `@${uname.toLowerCase()}`) {
      console.log("[instagram-webhook] echo bridge inbox via cross-conversation IGSID", {
        recipientIgsid: rid,
        inbox: uname,
      });
      return sibling;
    }
  }

  const fallback = (siblings ?? []).find((row) => {
    const sibling = row as InstagramWebhookAccount;
    return String(sibling.instagram_business_account_id).trim() !== senderBizId;
  }) as InstagramWebhookAccount | undefined;

  if (fallback && (siblings ?? []).length === 2) {
    console.log("[instagram-webhook] echo bridge inbox via sibling fallback", {
      recipientIgsid: rid,
      inbox: fallback.instagram_username,
    });
    return fallback;
  }

  return null;
}

type ExistingInstagramConvRow = {
  id: string;
  first_inbound_at: string | null;
  customer_name: string | null;
  customer_ig_id: string;
};

async function findExistingInstagramConversation(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  inboxBusinessAccountId: string,
  customerMessagingId: string,
  senderId: string,
  customerName: string | null,
): Promise<ExistingInstagramConvRow | null> {
  const tryIds = [...new Set([customerMessagingId.trim(), senderId.trim()].filter(Boolean))];
  const matches = new Map<string, ExistingInstagramConvRow & { customer_external_id?: string | null; last_message_at?: string | null }>();
  const probe = {
    customer_ig_id: customerMessagingId.trim() || senderId.trim(),
    customer_external_id: senderId.trim() || null,
    customer_name: customerName,
  };

  if (tryIds.length > 0) {
    const orParts = tryIds.flatMap((id) => [
      `customer_ig_id.eq.${id}`,
      `customer_external_id.eq.${id}`,
    ]);
    const { data: directRows } = await supabase
      .from("instagram_conversations")
      .select("id, first_inbound_at, customer_name, customer_ig_id, customer_external_id, last_message_at")
      .eq("organization_id", orgId)
      .eq("instagram_business_account_id", inboxBusinessAccountId)
      .or(orParts.join(","))
      .order("last_message_at", { ascending: false })
      .limit(20);

    for (const row of directRows ?? []) {
      const r = row as ExistingInstagramConvRow & {
        customer_external_id?: string | null;
        last_message_at?: string | null;
      };
      matches.set(r.id, r);
    }
  }

  const dedupeKey = instagramConversationCustomerDedupeKey(
    customerMessagingId,
    senderId,
    customerName,
  );
  const usernameKey = normalizeInstagramUsername(
    customerName?.trim().startsWith("@") ? customerName : null,
  );

  const { data: candidates } = await supabase
    .from("instagram_conversations")
    .select("id, first_inbound_at, customer_name, customer_ig_id, customer_external_id, last_message_at")
    .eq("organization_id", orgId)
    .eq("instagram_business_account_id", inboxBusinessAccountId)
    .order("last_message_at", { ascending: false })
    .limit(80);

  for (const row of candidates ?? []) {
    const r = row as ExistingInstagramConvRow & {
      customer_external_id?: string | null;
      last_message_at?: string | null;
    };

    if (dedupeKey) {
      const rowKey = instagramConversationCustomerDedupeKey(
        r.customer_ig_id,
        r.customer_external_id ?? null,
        r.customer_name,
      );
      if (rowKey === dedupeKey) {
        matches.set(r.id, r);
        continue;
      }
    }

    if (instagramCustomerIdentitiesOverlap(probe, r)) {
      matches.set(r.id, r);
      continue;
    }

    if (usernameKey) {
      const rowUsername = normalizeInstagramUsername(
        r.customer_name?.trim().startsWith("@") ? r.customer_name : null,
      );
      if (rowUsername && rowUsername === usernameKey) {
        matches.set(r.id, r);
      }
    }
  }

  const rows = [...matches.values()];
  if (rows.length === 0) return null;
  if (rows.length === 1) return rows[0];

  console.warn("[instagram-webhook] merging duplicate IG conversations", {
    orgId,
    inboxBusinessAccountId,
    ids: rows.map((r) => r.id),
    tryIds,
    dedupeKey,
  });
  return mergeInstagramConversationDuplicates(supabase, rows);
}

/** Resolve messaging id + display name before conversation lookup (all webhook paths). */
async function resolveInstagramCustomerIdentity(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  inboxBusinessAccountId: string,
  senderId: string,
  facebookPageId: string | null | undefined,
  accessToken: string | null,
): Promise<{ customerMessagingId: string; customerName: string | null }> {
  let customerMessagingId = senderId.trim();
  if (accessToken && facebookPageId) {
    customerMessagingId = await resolveInstagramDmRecipientIdWithRetry(
      supabase,
      orgId,
      inboxBusinessAccountId,
      senderId,
      String(facebookPageId).trim(),
      accessToken,
      { altCustomerIds: [senderId], attempts: 3, delayMs: 500 },
    );
  }

  let customerName: string | null = null;
  const linkedSender = await lookupConnectedIgAccountInOrg(supabase, orgId, senderId);
  if (linkedSender?.customer_name) {
    customerName = linkedSender.customer_name;
  } else if (accessToken) {
    customerName = await fetchInstagramSenderDisplayName(senderId, accessToken);
  }

  return { customerMessagingId, customerName };
}

/** IDs that represent our inbox (Page / IG business account), not the customer. */
function collectOwnedInboxIds(
  account: InstagramWebhookAccount,
  effectiveInboxId: string,
  entryId: string | null,
): Set<string> {
  const ids = new Set<string>();
  for (const id of [
    effectiveInboxId,
    account.instagram_business_account_id,
    account.facebook_page_id,
    entryId,
  ]) {
    const trimmed = String(id ?? "").trim();
    if (trimmed) ids.add(trimmed);
  }
  return ids;
}

function isOwnedInboxParticipant(participantId: string | null, ownedIds: Set<string>): boolean {
  const p = (participantId ?? "").trim();
  return p.length > 0 && ownedIds.has(p);
}

/** True when webhook event is our API/Page outbound (not a customer DM). Matches Messenger is_echo skip. */
function isInstagramOutboundWebhookEvent(
  message: MessagingEvtLoop["message"] | undefined,
  senderId: string | null,
  ownedInboxIds: Set<string>,
): boolean {
  if (!message || message.is_deleted) return false;
  if (message.is_echo === true) return true;
  // Customer DMs have the customer as sender; our sends echo with Page/IG inbox id as sender.
  return isOwnedInboxParticipant(senderId, ownedInboxIds);
}

async function findConversationWithRecentOutboundBody(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  inboxBusinessAccountId: string,
  bodyText: string,
  withinMs = 5 * 60 * 1000,
): Promise<ExistingInstagramConvRow | null> {
  const trimmedBody = bodyText.trim();
  if (!trimmedBody) return null;
  const since = new Date(Date.now() - withinMs).toISOString();

  const { data: recentOutbound } = await supabase
    .from("instagram_messages")
    .select("conversation_id, body, created_at")
    .eq("direction", "outbound")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(15);

  for (const row of recentOutbound ?? []) {
    const msg = row as { conversation_id?: string; body?: string | null };
    if ((msg.body ?? "").trim() !== trimmedBody || !msg.conversation_id) continue;

    const { data: conv } = await supabase
      .from("instagram_conversations")
      .select("id, first_inbound_at, customer_name, customer_ig_id, customer_external_id, last_message_at")
      .eq("id", msg.conversation_id)
      .eq("organization_id", orgId)
      .eq("instagram_business_account_id", inboxBusinessAccountId)
      .maybeSingle();

    if (conv?.id) {
      console.warn("[instagram-webhook] matched recent outbound body — avoid duplicate inbound thread", {
        conversation_id: conv.id,
        body: trimmedBody.slice(0, 80),
      });
      return conv as ExistingInstagramConvRow;
    }
  }
  return null;
}

async function skipIfOutboundInstagramMessageAlreadyStored(
  supabase: ReturnType<typeof createClient>,
  mid: string | null,
  meta: Record<string, unknown>,
): Promise<boolean> {
  if (!mid) return false;
  const { data: existingMsg } = await supabase
    .from("instagram_messages")
    .select("id, direction")
    .eq("platform_message_id", mid)
    .maybeSingle();
  if (existingMsg?.id) {
    console.log("[instagram-webhook] skip duplicate platform_message_id", { ...meta, mid, direction: existingMsg.direction });
    return true;
  }
  return false;
}

async function lookupConnectedIgAccountInOrg(
  supabase: ReturnType<typeof createClient>,
  organizationId: string,
  igScopedId: string,
): Promise<{ customer_ig_id: string; customer_name: string | null } | null> {
  const sid = igScopedId.trim();
  if (!sid) return null;
  const { data: rows } = await supabase
    .from("organization_instagram_accounts")
    .select("instagram_business_account_id, instagram_username, instagram_name")
    .eq("organization_id", organizationId)
    .eq("is_active", true);
  for (const row of rows ?? []) {
    const r = row as {
      instagram_business_account_id: string;
      instagram_username: string | null;
      instagram_name: string | null;
    };
    if (String(r.instagram_business_account_id).trim() === sid) {
      const uname = r.instagram_username?.trim();
      return {
        customer_ig_id: sid,
        customer_name: uname ? `@${uname}` : (r.instagram_name?.trim() || null),
      };
    }
  }
  return null;
}

function extractMessagingFromEntry(entry: Record<string, unknown>): MessagingEvt[] {
  const events: MessagingEvt[] = [];
  const messaging = entry.messaging;
  if (Array.isArray(messaging) && messaging.length > 0) {
    events.push(...(messaging as MessagingEvt[]));
  }

  const changes = entry.changes;
  if (!Array.isArray(changes)) return events;

  for (const ch of changes) {
    const change = ch as Record<string, unknown>;
    const field = typeof change.field === "string" ? change.field : "";
    const val = change.value as Record<string, unknown> | undefined;
    if (!val) continue;

    if (field === "messages" || field === "messaging") {
      if (Array.isArray(val.messaging)) {
        events.push(...(val.messaging as MessagingEvt[]));
        continue;
      }
      const nested = val.messaging_event as MessagingEvt | undefined;
      if (nested?.sender?.id != null && nested.message) {
        events.push(nested);
        continue;
      }
      if (val.sender && val.message) {
        events.push(val as MessagingEvt);
      }
    }
  }

  return events;
}

type InstagramCommentWebhookEvent = {
  commentId: string;
  mediaId: string;
  authorIgScopedId: string | null;
  parentCommentId: string | null;
  verb: string | null;
};

function extractInstagramCommentChangesFromEntry(
  entry: Record<string, unknown>,
): InstagramCommentWebhookEvent[] {
  const events: InstagramCommentWebhookEvent[] = [];
  const changes = entry.changes;
  if (!Array.isArray(changes)) return events;

  for (const ch of changes) {
    const change = ch as Record<string, unknown>;
    const field = typeof change.field === "string" ? change.field : "";
    if (field !== "comments") continue;

    const val = change.value as Record<string, unknown> | undefined;
    if (!val) continue;

    const commentId = typeof val.id === "string" ? val.id.trim() : String(val.id ?? "").trim();
    const media = val.media as Record<string, unknown> | undefined;
    const mediaId = typeof media?.id === "string" ? media.id.trim() : String(media?.id ?? "").trim();
    const from = val.from as Record<string, unknown> | undefined;
    const authorRaw = from?.id != null ? String(from.id).trim() : "";
    const authorIgScopedId = authorRaw || null;
    const parentRaw = val.parent_id != null ? String(val.parent_id).trim() : "";
    const parentCommentId = parentRaw || null;
    const verb = typeof val.verb === "string" ? val.verb.trim().toLowerCase() : null;

    if (!commentId || !mediaId) continue;

    events.push({ commentId, mediaId, authorIgScopedId, parentCommentId, verb });
  }

  return events;
}

async function processInstagramCommentWebhookEvents(
  supabase: ReturnType<typeof createClient>,
  webhookObject: string,
  entryId: string | null,
  events: InstagramCommentWebhookEvent[],
): Promise<number> {
  if (events.length === 0) return 0;

  if (webhookObject === "page") {
    console.log("[instagram-webhook] ignored_page_comments_v1", { count: events.length, entryId });
    return 0;
  }
  if (webhookObject !== "instagram") return 0;

  const account = await resolveInstagramAccountForMessaging(supabase, entryId, null, null);
  if (!account) {
    console.error(
      "[instagram-webhook] comment webhook: account not found for entry:",
      entryId ?? "(missing)",
    );
    return 0;
  }

  const businessIgId = String(account.instagram_business_account_id).trim();
  const orgId = account.organization_id;
  let processed = 0;

  for (const evt of events) {
    if (evt.verb === "remove") {
      let deleteQuery = supabase
        .from("meta_manage_comments_inbound_comments")
        .delete()
        .eq("organization_id", orgId)
        .eq("platform", "instagram")
        .eq("account_id", businessIgId)
        .eq("comment_id", evt.commentId);
      if (evt.mediaId) {
        deleteQuery = deleteQuery.eq("media_id", evt.mediaId);
      }
      const { error } = await deleteQuery;
      if (error) {
        console.warn("[instagram-webhook] comment remove delete error", evt.commentId, error.message);
      } else {
        processed += 1;
      }
      continue;
    }

    if (evt.authorIgScopedId && evt.authorIgScopedId === businessIgId) {
      console.log("[instagram-webhook] skip self-comment", evt.commentId);
      continue;
    }

    try {
      await syncMetaManageCommentsInboundComments(
        supabase,
        orgId,
        "instagram",
        businessIgId,
        evt.mediaId,
        [evt.commentId],
      );
      console.log("[instagram-webhook] comments webhook received", {
        orgId,
        mediaId: evt.mediaId,
        commentId: evt.commentId,
        authorIgScopedId: evt.authorIgScopedId,
        parentCommentId: evt.parentCommentId,
      });
      processed += 1;
    } catch (e) {
      console.error("[instagram-webhook] syncMetaManageCommentsInboundComments error", e);
    }
  }

  return processed;
}

function livechatPushUsesDatabaseWebhookOnly(): boolean {
  return Deno.env.get("LIVECHAT_USE_DATABASE_WEBHOOK_FOR_PUSH") === "true";
}

async function notifyLivechatInboundPush(
  table: LivechatPushTable,
  record: Record<string, unknown>,
): Promise<void> {
  if (livechatPushUsesDatabaseWebhookOnly()) return;

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    console.warn("notifyLivechatInboundPush: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return;
  }

  const url = `${supabaseUrl.replace(/\/$/, "")}/functions/v1/livechat-send-push`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
      },
      body: JSON.stringify({
        type: "INSERT",
        table,
        schema: "public",
        record,
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      console.error("notifyLivechatInboundPush: livechat-send-push HTTP error", res.status, t.slice(0, 800));
    }
  } catch (e) {
    console.error("notifyLivechatInboundPush: fetch failed", e);
  }
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  console.log("[instagram-webhook] ENTRY", req.method, url.pathname);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    if (req.method === "GET") {
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");

      if (mode !== "subscribe" || !challenge) {
        return new Response("instagram-webhook ok", { status: 200, headers: { ...corsHeaders, "Content-Type": "text/plain" } });
      }

      let verified = false;
      if (token) {
        const { data: igAccount } = await supabase
          .from("organization_instagram_accounts")
          .select("id")
          .eq("verify_token", token)
          .eq("is_active", true)
          .maybeSingle();
        if (igAccount) verified = true;
        if (!verified) {
          const { data: metaByVerify } = await supabase
            .from("organization_meta_config")
            .select("id")
            .eq("verify_token", token)
            .eq("is_active", true)
            .maybeSingle();
          if (metaByVerify) verified = true;
        }
        if (!verified) {
          const { data: metaByIgToken } = await supabase
            .from("organization_meta_config")
            .select("id")
            .eq("instagram_verify_token", token)
            .eq("is_active", true)
            .maybeSingle();
          if (metaByIgToken) verified = true;
        }
        if (!verified) {
          const { data: fbPage } = await supabase
            .from("organization_facebook_pages")
            .select("id")
            .eq("verify_token", token)
            .eq("is_active", true)
            .maybeSingle();
          if (fbPage) verified = true;
        }
      }

      if (!verified) {
        console.error("[instagram-webhook] GET: verify_token not found");
        return new Response("Forbidden", { status: 403, headers: corsHeaders });
      }
      console.log("[instagram-webhook] GET: verification success");
      const challengeStr = challenge != null ? String(challenge) : "";
      return new Response(challengeStr, { status: 200, headers: { ...corsHeaders, "Content-Type": "text/plain" } });
    }

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch((e) => {
      console.error("[instagram-webhook] POST body parse error", e);
      return {};
    });
    const bodyObject = body?.object ?? "(missing)";
    const entryCount = Array.isArray(body?.entry) ? body.entry.length : 0;
    console.log("[instagram-webhook] POST received — object:", bodyObject, "entries:", entryCount);
    const webhookObject = String(body?.object ?? "").trim();
    if (!SUPPORTED_INSTAGRAM_WEBHOOK_OBJECTS.has(webhookObject)) {
      console.log(
        "[instagram-webhook] POST: unsupported object, ignoring. Payload object:",
        bodyObject,
        "(expected instagram or page)",
      );
      return new Response(JSON.stringify({ success: true, ignored: true, reason: "unsupported_object" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const entries = body?.entry ?? [];
    if (entries.length > 0) {
      const first = entries[0] as Record<string, unknown>;
      const keys = first ? Object.keys(first) : [];
      const hasChanges = Array.isArray(first?.changes) && (first.changes as unknown[]).length > 0;
      const hasMessaging = Array.isArray(first?.messaging) && (first.messaging as unknown[]).length > 0;
      console.log("[instagram-webhook] first entry keys:", keys.join(", "), "id:", first?.id, "messaging?:", hasMessaging ? (first.messaging as unknown[]).length : "none", "changes?:", hasChanges ? (first.changes as unknown[]).length : "none");
      if (hasChanges && !hasMessaging) {
        const firstChanges = (first?.changes as Array<Record<string, unknown>>) ?? [];
        const changeFields = firstChanges
          .map((c) => (typeof c.field === "string" ? c.field : ""))
          .filter(Boolean);
        if (changeFields.includes("comments")) {
          console.log("[instagram-webhook] Payload has comments changes — comment ingest path.");
        } else {
          console.log(
            "[instagram-webhook] Payload has changes but no messaging/DM events. fields:",
            changeFields.join(", ") || "(none)",
          );
        }
      }
    }
    const ensuredLivechatStatusOrgs = new Set<string>();
    let processedCount = 0;
    let commentProcessedCount = 0;
    for (const entry of entries) {
      const entryRecord = entry as Record<string, unknown>;
      const entryId = entry?.id != null && entry?.id !== "" ? String(entry.id).trim() : null;

      const commentEvents = extractInstagramCommentChangesFromEntry(entryRecord);
      if (commentEvents.length > 0) {
        commentProcessedCount += await processInstagramCommentWebhookEvents(
          supabase,
          webhookObject,
          entryId,
          commentEvents,
        );
      }

      const messaging = extractMessagingFromEntry(entryRecord);
      if (messaging.length === 0) continue;

      console.log(
        "[instagram-webhook] entry id:",
        entryId ?? "(missing)",
        "object:",
        webhookObject,
        "messaging events:",
        messaging.length,
      );

      if (webhookObject === "page") {
        const fbPage = await resolveFacebookPageForWebhookEntry(supabase, entryId, messaging);
        if (!fbPage) {
          const recipientHint = messaging[0]?.recipient?.id != null ? String(messaging[0].recipient.id) : "(none)";
          console.error(
            "[instagram-webhook] Facebook Page not found for entry id:",
            entryId ?? "(missing)",
            "recipient:",
            recipientHint,
            "— connect Page di /omnichannel/integrations/facebook. Meta Test pakai ID dummy; kirim pesan nyata ke Page Octa Vialdi (937482819452507).",
          );
          continue;
        }
        console.log("[instagram-webhook] Facebook Page found — page id:", fbPage.facebook_page_id, "org:", fbPage.organization_id);
        const fbProcessed = await processFacebookMessengerEvents(
          supabase,
          fbPage,
          messaging,
          async (record) => notifyLivechatInboundPush("facebook_messages", record),
          ensuredLivechatStatusOrgs,
        );
        processedCount += fbProcessed;
        continue;
      }

      type MessagingEvtLoop = MessagingEvt;
      for (const evt of messaging) {
        const e = evt as MessagingEvtLoop;

        const recipientId = e.recipient?.id != null ? String(e.recipient.id).trim() : null;
        const senderId = e.sender?.id != null ? String(e.sender.id) : null;
        let account = await resolveInstagramAccountForMessaging(supabase, entryId, recipientId, senderId);
        if (!account) {
          console.error(
            "[instagram-webhook] config not found for entry/recipient/sender:",
            { entryId, recipientId, senderId },
            "— pastikan akun Instagram di-connect di halaman Connect Instagram.",
          );
          continue;
        }

        let effectiveId = String(account.instagram_business_account_id).trim();
        let orgId = account.organization_id;
        if (!ensuredLivechatStatusOrgs.has(orgId)) {
          const { error: ensureStatusErr } = await supabase.rpc("ensure_livechat_lead_statuses_for_org", {
            p_organization_id: orgId,
          });
          if (ensureStatusErr) {
            console.warn("[instagram-webhook] ensure_livechat_lead_statuses_for_org:", ensureStatusErr.message);
          } else {
            ensuredLivechatStatusOrgs.add(orgId);
          }
        }
        let accessToken = (account.page_access_token ?? "").trim() || null;
        const ts = e.timestamp != null ? new Date(Number(e.timestamp)).toISOString() : new Date().toISOString();

        // Read / seen receipts (message_reads + messaging_seen subscriptions)
        if ((e.read || e.seen) && !e.message && !e.postback) {
          const customerIgId = senderId;
          if (!customerIgId) continue;
          const readPayload = (e.read ?? e.seen) as { watermark?: unknown; mid?: unknown };
          const { customerMessagingId, customerName } = await resolveInstagramCustomerIdentity(
            supabase,
            orgId,
            effectiveId,
            customerIgId,
            account.facebook_page_id,
            accessToken,
          );
          const convForRead = await findExistingInstagramConversation(
            supabase,
            orgId,
            effectiveId,
            customerMessagingId,
            customerIgId,
            customerName,
          );
          if (convForRead?.id) {
            await handleInstagramReadReceipt(supabase, convForRead.id, readPayload);
            processedCount += 1;
          }
          continue;
        }

        // Postback events
        if (e.postback && !e.message) {
          const postback = e.postback;
          if (!senderId) continue;
          const payload = typeof postback.payload === "string" ? postback.payload.trim() : "";
          const title = typeof postback.title === "string" ? postback.title.trim() : "";
          const bodyText = payload || title || "[Postback]";
          const mid = `postback_${senderId}_${String(e.timestamp ?? Date.now())}`;

          const { customerMessagingId, customerName } = await resolveInstagramCustomerIdentity(
            supabase,
            orgId,
            effectiveId,
            senderId,
            account.facebook_page_id,
            accessToken,
          );
          const existingConvPb = await findExistingInstagramConversation(
            supabase,
            orgId,
            effectiveId,
            customerMessagingId,
            senderId,
            customerName,
          );

          let convPbId = existingConvPb?.id ?? null;
          if (!convPbId) {
            const newConvId = crypto.randomUUID();
            const ticketId = "IG-" + newConvId.replace(/-/g, "").slice(0, 8).toUpperCase();
            const orgOrGlobalPb = `organization_id.eq.${orgId},organization_id.is.null`;
            const { data: openSt } = await supabase.from("lead_statuses").select("id").or(orgOrGlobalPb).eq("name", "Open").maybeSingle();
            const { data: unreadSt } = openSt?.id
              ? { data: null }
              : await supabase.from("lead_statuses").select("id").or(orgOrGlobalPb).eq("name", "Unread").maybeSingle();
            const { data: insertedPb, error: insertPbErr } = await supabase
              .from("instagram_conversations")
              .insert({
                id: newConvId,
                organization_id: orgId,
                instagram_business_account_id: effectiveId,
                customer_ig_id: customerMessagingId,
                customer_external_id: senderId,
                ...(customerName ? { customer_name: customerName } : {}),
                ticket_id: ticketId,
                lead_status_id: openSt?.id ?? unreadSt?.id ?? null,
                last_message_at: ts,
                last_message_body: bodyText.slice(0, 200),
                last_message_direction: "inbound",
                last_inbound_at: ts,
                first_inbound_at: ts,
                updated_at: ts,
              })
              .select("id")
              .single();
            if (insertPbErr) {
              const retried = await findExistingInstagramConversation(
                supabase,
                orgId,
                effectiveId,
                customerMessagingId,
                senderId,
                customerName,
              );
              convPbId = retried?.id ?? null;
            } else {
              convPbId = insertedPb?.id ?? null;
            }
          }

          if (convPbId) {
            await extendInstagramMetaSession(supabase, convPbId, ts);
            await supabase
              .from("instagram_conversations")
              .update({
                last_message_at: ts,
                last_message_body: bodyText.slice(0, 200),
                last_message_direction: "inbound",
                last_inbound_at: ts,
                updated_at: ts,
              })
              .eq("id", convPbId);
            const pbPayload = {
              conversation_id: convPbId,
              direction: "inbound",
              platform_message_id: mid,
              body: bodyText,
              message_type: "postback",
              raw_metadata: evt,
              created_at: ts,
            };
            await supabase.from("instagram_messages").insert(pbPayload);
            await notifyLivechatInboundPush("instagram_messages", pbPayload);
            processedCount += 1;
          }
          continue;
        }

        if (e.message?.is_echo) {
          const echoRecipientInbox = recipientId
            ? await resolveEchoBridgeInboxAccount(supabase, account, recipientId)
            : null;
          if (!echoRecipientInbox) {
            console.log("[instagram-webhook] skip: is_echo (outbound to external customer)", {
              senderId,
              recipientId,
              inbox: account.instagram_username,
            });
            continue;
          }
          console.log("[instagram-webhook] bridge is_echo to connected inbox", {
            from: account.instagram_username,
            to: echoRecipientInbox.instagram_username,
            recipientId,
            senderId,
          });
          account = echoRecipientInbox;
          effectiveId = String(echoRecipientInbox.instagram_business_account_id).trim();
          orgId = echoRecipientInbox.organization_id;
          accessToken = (echoRecipientInbox.page_access_token ?? "").trim() || null;
          if (!ensuredLivechatStatusOrgs.has(orgId)) {
            const { error: ensureStatusErr } = await supabase.rpc("ensure_livechat_lead_statuses_for_org", {
              p_organization_id: orgId,
            });
            if (ensureStatusErr) {
              console.warn("[instagram-webhook] ensure_livechat_lead_statuses_for_org:", ensureStatusErr.message);
            } else {
              ensuredLivechatStatusOrgs.add(orgId);
            }
          }
        }

        const mid = e.message?.mid != null ? String(e.message.mid) : null;

        const ownedInboxIds = collectOwnedInboxIds(account, effectiveId, entryId);
        if (
          e.message &&
          !e.message.is_deleted &&
          isInstagramOutboundWebhookEvent(e.message, senderId, ownedInboxIds)
        ) {
          if (await skipIfOutboundInstagramMessageAlreadyStored(supabase, mid, {
            reason: "outbound_or_echo",
            senderId,
            recipientId,
            is_echo: e.message.is_echo === true,
            owned_inbox_ids: [...ownedInboxIds],
          })) {
            processedCount += 1;
          } else {
            console.log("[instagram-webhook] skip outbound/echo (sender is inbox/page)", {
              senderId,
              recipientId,
              mid,
              is_echo: e.message.is_echo === true,
            });
          }
          continue;
        }

        // Deleted message: update existing row
        if (e.message?.is_deleted && mid && senderId) {
          const { customerMessagingId, customerName } = await resolveInstagramCustomerIdentity(
            supabase,
            orgId,
            effectiveId,
            senderId,
            account.facebook_page_id,
            accessToken,
          );
          const convDel = await findExistingInstagramConversation(
            supabase,
            orgId,
            effectiveId,
            customerMessagingId,
            senderId,
            customerName,
          );
          if (convDel?.id) {
            await supabase
              .from("instagram_messages")
              .update({ body: "[Deleted]", message_type: "text" })
              .eq("conversation_id", convDel.id)
              .eq("platform_message_id", mid);
            processedCount += 1;
          }
          continue;
        }

        if (!senderId) {
          console.log("[instagram-webhook] skip: no senderId");
          continue;
        }

        const { body: bodyText, messageType } = getMessageBody(evt as Record<string, unknown>);
        const lastBody = bodyText.slice(0, 200);

        // Reject misrouted webhooks where Meta sends our Page id as sender (would become "Instagram Contact").
        if (isOwnedInboxParticipant(senderId, ownedInboxIds)) {
          console.log("[instagram-webhook] skip: sender is owned inbox/page id on message path", { senderId, mid });
          continue;
        }

        if (recipientId && recipientId !== effectiveId) {
          console.warn("[instagram-webhook] recipientId differs from resolved inbox account", {
            recipientId,
            effectiveId,
            inbox: account.instagram_username,
          });
        }

        const { customerMessagingId, customerName: resolvedCustomerName } = await resolveInstagramCustomerIdentity(
          supabase,
          orgId,
          effectiveId,
          senderId!,
          account.facebook_page_id,
          accessToken,
        );
        let customerName = resolvedCustomerName;

        let existingConvResolved = await findExistingInstagramConversation(
          supabase,
          orgId,
          effectiveId,
          customerMessagingId,
          senderId!,
          customerName,
        );

        const outboundEchoConv = await findConversationWithRecentOutboundBody(
          supabase,
          orgId,
          effectiveId,
          bodyText,
        );
        if (outboundEchoConv && !existingConvResolved) {
          if (await skipIfOutboundInstagramMessageAlreadyStored(supabase, mid, {
            reason: "body_matches_recent_outbound_no_customer_conv",
            conversation_id: outboundEchoConv.id,
          })) {
            processedCount += 1;
          } else {
            console.log("[instagram-webhook] skip misrouted echo (matches recent outbound, no customer thread)", {
              conversation_id: outboundEchoConv.id,
              body: bodyText.slice(0, 80),
              senderId,
              mid,
            });
          }
          continue;
        }

        const existingName = existingConvResolved?.customer_name?.trim() ?? "";
        if (!customerName && existingName) {
          customerName = existingName;
        }

        const convPayload = {
          organization_id: orgId,
          instagram_business_account_id: effectiveId,
          customer_ig_id: customerMessagingId,
          customer_external_id: senderId,
          ...(customerName ? { customer_name: customerName } : {}),
          last_message_at: ts,
          last_message_body: lastBody,
          last_message_direction: "inbound",
          last_message_status: null as string | null,
          first_inbound_at: null as string | null,
          last_inbound_at: ts,
          updated_at: ts,
        };

        let conv: { id: string; first_inbound_at: string | null } | null = null;
        if (existingConvResolved) {
          const { data: updated } = await supabase
            .from("instagram_conversations")
            .update({
              last_message_at: ts,
              last_message_body: lastBody,
              last_message_direction: "inbound",
              last_inbound_at: ts,
              updated_at: ts,
              customer_ig_id: customerMessagingId,
              customer_external_id: senderId,
              ...(customerName && !existingName ? { customer_name: customerName } : {}),
            })
            .eq("id", existingConvResolved.id)
            .select("id, first_inbound_at")
            .single();
          conv = updated;
        } else {
          const newConvId = crypto.randomUUID();
          const ticketId = "IG-" + newConvId.replace(/-/g, "").slice(0, 8).toUpperCase();
          const orgOrGlobalNew = `organization_id.eq.${orgId},organization_id.is.null`;
          const { data: openStatus } = await supabase
            .from("lead_statuses")
            .select("id")
            .or(orgOrGlobalNew)
            .eq("name", "Open")
            .maybeSingle();
          const { data: unreadStatus } = openStatus?.id
            ? { data: null }
            : await supabase
                .from("lead_statuses")
                .select("id")
                .or(orgOrGlobalNew)
                .eq("name", "Unread")
                .maybeSingle();
          const leadStatusId = openStatus?.id ?? unreadStatus?.id ?? null;
          if (!leadStatusId) {
            console.warn(
              "[instagram-webhook] new conv: no Open/Unread lead_status (org or global); conversation may insert with null lead_status_id",
              { organization_id: orgId },
            );
          }

          const { data: inserted, error: insertErr } = await supabase
            .from("instagram_conversations")
            .insert({
              id: newConvId,
              ...convPayload,
              ticket_id: ticketId,
              lead_status_id: leadStatusId,
              first_inbound_at: ts,
            })
            .select("id, first_inbound_at")
            .single();
          if (insertErr) {
            console.warn("[instagram-webhook] conversation insert error, retry lookup", insertErr);
            const retried = await findExistingInstagramConversation(
              supabase,
              orgId,
              effectiveId,
              customerMessagingId,
              senderId!,
              customerName,
            );
            if (retried) {
              const { data: updatedAfterRace } = await supabase
                .from("instagram_conversations")
                .update({
                  last_message_at: ts,
                  last_message_body: lastBody,
                  last_message_direction: "inbound",
                  last_inbound_at: ts,
                  updated_at: ts,
                  customer_ig_id: customerMessagingId,
                  customer_external_id: senderId,
                  ...(customerName && !existingName ? { customer_name: customerName } : {}),
                })
                .eq("id", retried.id)
                .select("id, first_inbound_at")
                .single();
              conv = updatedAfterRace;
            } else {
              continue;
            }
          } else {
            conv = inserted;
            const createdByDisplayName = account.instagram_username?.trim()
              ? `@${account.instagram_username.trim()}`
              : (account.instagram_name?.trim() || "Instagram");
            await ensureLeadForNewInstagramConversation(
              supabase,
              orgId,
              conv!.id,
              customerName || "Instagram contact",
              lastBody || "Instagram",
              senderId,
              createdByDisplayName
            );
            const { error: newCycleErr } = await supabase.from("instagram_conversation_cycles").insert({
              conversation_id: conv!.id,
              cycle_started_at: ts,
            });
            if (newCycleErr) console.error("[instagram-webhook] new conversation cycle insert error", newCycleErr);
          }
        }

        if (!conv || !mid) {
          console.log("[instagram-webhook] skip save: no conv or mid", { conv: !!conv, mid: !!mid });
          continue;
        }

        if (await skipIfOutboundInstagramMessageAlreadyStored(supabase, mid, {
          reason: "duplicate_before_inbound_insert",
          conversation_id: conv.id,
        })) {
          processedCount += 1;
          continue;
        }

        await extendInstagramMetaSession(supabase, conv.id, ts);

        let mediaUrl: string | null = null;
        const msgRecord = (evt as Record<string, unknown>).message as Record<string, unknown> | undefined;
        const attachmentInfo = msgRecord ? getInstagramAttachmentInfo(msgRecord) : null;
        if (attachmentInfo && accessToken) {
          const eagerTypes = new Set(["image", "video"]);
          if (eagerTypes.has(attachmentInfo.type)) {
            mediaUrl = await downloadInstagramAttachmentToStorage(
              attachmentInfo.url,
              accessToken,
              supabase,
              conv.id,
              mid,
              attachmentInfo.type,
            );
          }
        }

        const insertPayload: Record<string, unknown> = {
          conversation_id: conv.id,
          direction: "inbound",
          platform_message_id: mid,
          body: bodyText,
          message_type: messageType,
          raw_metadata: evt,
          created_at: ts,
        };
        if (mediaUrl) insertPayload.media_url = mediaUrl;

        // Inbound reply context: extract reply_to.mid so UI can show reply preview
        const msgObj = (evt as Record<string, unknown>).message as { reply_to?: { mid?: string } } | undefined;
        const replyToMid = msgObj?.reply_to?.mid != null ? String(msgObj.reply_to.mid).trim() : null;
        if (replyToMid) {
          insertPayload.reply_to_platform_message_id = replyToMid;
          const { data: repliedToRow } = await supabase
            .from("instagram_messages")
            .select("body, message_type")
            .eq("conversation_id", conv.id)
            .eq("platform_message_id", replyToMid)
            .maybeSingle();
          if (repliedToRow) {
            const repliedBody = repliedToRow.body;
            const repliedType = (repliedToRow.message_type ?? "text") as string;
            insertPayload.reply_to_body =
              repliedBody != null && repliedBody !== ""
                ? String(repliedBody).slice(0, 500)
                : ["image", "video", "file"].includes((repliedType || "").toLowerCase())
                  ? `[${repliedType}]`
                  : "[Pesan]";
            insertPayload.reply_to_message_type = repliedType;
          } else {
            insertPayload.reply_to_body = "[Pesan]";
          }
        }

        const { error: msgErr } = await supabase.from("instagram_messages").insert(insertPayload);
        if (msgErr) {
          console.error("[instagram-webhook] instagram_messages insert error", msgErr);
          continue;
        }
        await notifyLivechatInboundPush("instagram_messages", insertPayload);

        if (!existingConvResolved?.first_inbound_at && conv.first_inbound_at) {
          await supabase
            .from("instagram_conversations")
            .update({ first_inbound_at: ts, updated_at: ts })
            .eq("id", conv.id);
        }

        // Resolve-cycle: when existing conversation receives inbound, re-open to Open (Unread) if status is Closed/Resolve or null (same logic as whatsapp-webhook)
        if (existingConvResolved) {
          const { data: convRow } = await supabase
            .from("instagram_conversations")
            .select("lead_status_id")
            .eq("id", conv.id)
            .single();
          const statusId = convRow?.lead_status_id ?? null;
          let leadStatusName: string | null = null;
          if (statusId) {
            const { data: statusRow } = await supabase
              .from("lead_statuses")
              .select("name")
              .eq("id", statusId)
              .maybeSingle();
            leadStatusName = (statusRow?.name as string) ?? null;
          }
          // Prefer "Open", fallback "Unread". Include global statuses (organization_id IS NULL) for all tenants.
          const orgOrGlobal = `organization_id.eq.${orgId},organization_id.is.null`;
          const { data: openStatus } = await supabase
            .from("lead_statuses")
            .select("id")
            .or(orgOrGlobal)
            .eq("name", "Open")
            .maybeSingle();
          const { data: unreadStatus } = openStatus?.id
            ? { data: null }
            : await supabase.from("lead_statuses").select("id").or(orgOrGlobal).eq("name", "Unread").maybeSingle();
          const openStatusId = openStatus?.id ?? unreadStatus?.id ?? null;
          const statusNameLower = leadStatusName?.trim().toLowerCase() ?? "";
          const isResolved = statusNameLower === "closed" || statusNameLower === "resolve";
          const isExpired = statusNameLower === "expired";
          const isNewOrReopen = openStatusId && (statusId == null || isResolved || isExpired);
          if (isNewOrReopen) {
            const { data: convBefore } = await supabase
              .from("instagram_conversations")
              .select("organization_id, ticket_id")
              .eq("id", conv.id)
              .maybeSingle();
            const { error: updateErr } = await supabase
              .from("instagram_conversations")
              .update({ lead_status_id: openStatusId, last_inbound_at: ts, updated_at: ts })
              .eq("id", conv.id);
            if (updateErr) {
              console.error("[instagram-webhook] Reopen to Open (Unread) update error:", updateErr);
            } else {
              console.log("[instagram-webhook] Reopened conversation to Open (Unread):", conv.id, { openStatusId, hadStatus: statusId });
            }
            if (convBefore?.organization_id && openStatusId) {
              const ticketId =
                (convBefore.ticket_id as string) ?? `IG-${conv.id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
              const { error: leadErr } = await supabase
                .from("leads")
                .update({ status_id: openStatusId, updated_at: ts })
                .eq("organization_id", convBefore.organization_id)
                .eq("ticket_id", ticketId);
              if (leadErr) console.error("[instagram-webhook] Reopen: sync leads.status_id to Open failed:", leadErr);
            }
            const { error: cycleErr } = await supabase.from("instagram_conversation_cycles").insert({
              conversation_id: conv.id,
              cycle_started_at: ts,
            });
            if (cycleErr) console.error("[instagram-webhook] New cycle insert error:", cycleErr);
          }
        }

        console.log("[instagram-webhook] message saved", { convId: conv.id, mid });
        processedCount += 1;
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: processedCount, commentProcessedCount }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("[instagram-webhook] error", err);
    return new Response(JSON.stringify({ error: "Webhook failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

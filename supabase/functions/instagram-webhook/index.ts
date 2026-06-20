import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  processFacebookMessengerEvents,
  resolveFacebookPageByEntryId,
} from "../_shared/facebookMessengerWebhook.ts";

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
        .update({ status: "read", status_updated_at: now })
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
        .update({ status: "read", status_updated_at: now })
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
    `?fields=${encodeURIComponent("name,username")}` +
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
  const statusId = unreadStatus?.id ?? null;
  if (!statusId) {
    console.warn("ensureLeadForNewInstagramConversation: no Unread status, skip lead insert");
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
type LivechatPushTable = "whatsapp_messages" | "instagram_messages" | "facebook_messages" | "email_messages";

type InstagramWebhookAccount = {
  organization_id: string;
  page_access_token: string | null;
  instagram_username: string | null;
  instagram_name: string | null;
  instagram_business_account_id: string;
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

async function resolveInstagramAccountByEntryId(
  supabase: ReturnType<typeof createClient>,
  entryId: string | null,
): Promise<InstagramWebhookAccount | null> {
  const select =
    "organization_id, page_access_token, instagram_username, instagram_name, instagram_business_account_id, facebook_page_id";
  const trimmed = entryId?.trim() ?? "";

  if (trimmed) {
    const { data: byIg, error: byIgErr } = await supabase
      .from("organization_instagram_accounts")
      .select(select)
      .eq("instagram_business_account_id", trimmed)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    if (byIgErr) {
      console.error("[instagram-webhook] account lookup by ig id error:", byIgErr.message);
    }
    if (byIg) return byIg as InstagramWebhookAccount;

    const { data: byPage, error: byPageErr } = await supabase
      .from("organization_instagram_accounts")
      .select(select)
      .eq("facebook_page_id", trimmed)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    if (byPageErr) {
      console.error("[instagram-webhook] account lookup by page id error:", byPageErr.message);
    }
    if (byPage) {
      console.log("[instagram-webhook] matched account via facebook_page_id:", trimmed);
      return byPage as InstagramWebhookAccount;
    }
  }

  const { data: singleAccount } = await supabase
    .from("organization_instagram_accounts")
    .select(select)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (singleAccount) {
    console.log("[instagram-webhook] using single active account fallback");
    return singleAccount as InstagramWebhookAccount;
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
        console.log("[instagram-webhook] Payload punya 'changes' bukan 'messaging' — ini bukan event DM. Untuk tes: kirim pesan nyata dari app Instagram ke akun bisnis (@octa.vialdi), jangan pakai tombol Test di Meta.");
      }
    }
    const ensuredLivechatStatusOrgs = new Set<string>();
    let processedCount = 0;
    for (const entry of entries) {
      const entryRecord = entry as Record<string, unknown>;
      const entryId = entry?.id != null && entry?.id !== "" ? String(entry.id).trim() : null;
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
        const fbPage = await resolveFacebookPageByEntryId(supabase, entryId);
        if (!fbPage) {
          console.error(
            "[instagram-webhook] Facebook Page not found for entry id:",
            entryId,
            "— connect Page di /omnichannel/integrations/facebook.",
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

      const account = await resolveInstagramAccountByEntryId(supabase, entryId);
      if (!account) {
        console.error(
          "[instagram-webhook] config not found for entry id:",
          entryId,
          "— pastikan akun Instagram di-connect di halaman Connect Instagram.",
        );
        continue;
      }

      const effectiveId = String(account.instagram_business_account_id).trim();
      console.log("[instagram-webhook] account found — ig id:", effectiveId, "org:", account.organization_id);
      const orgId = account.organization_id;
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
      const accessToken = (account.page_access_token ?? "").trim() || null;
      const displayName =
        (account.instagram_username ? "@" + account.instagram_username.trim() : null) ||
        (account.instagram_name ?? "").trim() ||
        "Instagram";

      type MessagingEvtLoop = MessagingEvt;
      for (const evt of messaging) {
        const e = evt as MessagingEvtLoop;
        const senderId = e.sender?.id != null ? String(e.sender.id) : null;
        const ts = e.timestamp != null ? new Date(Number(e.timestamp)).toISOString() : new Date().toISOString();

        // Read receipts (message_reads subscription)
        if (e.read && !e.message && !e.postback) {
          const customerIgId = senderId;
          if (!customerIgId) continue;
          const { data: convForRead } = await supabase
            .from("instagram_conversations")
            .select("id")
            .eq("organization_id", orgId)
            .eq("instagram_business_account_id", effectiveId)
            .eq("customer_ig_id", customerIgId)
            .maybeSingle();
          if (convForRead?.id) {
            await handleInstagramReadReceipt(supabase, convForRead.id, e.read);
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

          const { data: existingConvPb } = await supabase
            .from("instagram_conversations")
            .select("id")
            .eq("organization_id", orgId)
            .eq("instagram_business_account_id", effectiveId)
            .eq("customer_ig_id", senderId)
            .maybeSingle();

          let convPbId = existingConvPb?.id ?? null;
          if (!convPbId) {
            const newConvId = crypto.randomUUID();
            const ticketId = "IG-" + newConvId.replace(/-/g, "").slice(0, 8).toUpperCase();
            const orgOrGlobalPb = `organization_id.eq.${orgId},organization_id.is.null`;
            const { data: openSt } = await supabase.from("lead_statuses").select("id").or(orgOrGlobalPb).eq("name", "Open").maybeSingle();
            const { data: unreadSt } = openSt?.id
              ? { data: null }
              : await supabase.from("lead_statuses").select("id").or(orgOrGlobalPb).eq("name", "Unread").maybeSingle();
            const { data: insertedPb } = await supabase
              .from("instagram_conversations")
              .insert({
                id: newConvId,
                organization_id: orgId,
                instagram_business_account_id: effectiveId,
                customer_ig_id: senderId,
                customer_external_id: senderId,
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
            convPbId = insertedPb?.id ?? null;
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
          console.log("[instagram-webhook] skip: is_echo");
          continue;
        }

        const mid = e.message?.mid != null ? String(e.message.mid) : null;

        // Deleted message: update existing row
        if (e.message?.is_deleted && mid && senderId) {
          const { data: convDel } = await supabase
            .from("instagram_conversations")
            .select("id")
            .eq("organization_id", orgId)
            .eq("instagram_business_account_id", effectiveId)
            .eq("customer_ig_id", senderId)
            .maybeSingle();
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
        const recipientId = e.recipient?.id != null ? String(e.recipient.id) : null;
        if (recipientId && recipientId !== effectiveId) {
          console.log("[instagram-webhook] recipientId differs from entry id (continuing anyway)", { recipientId, effectiveId });
        }

        const { body: bodyText, messageType } = getMessageBody(evt as Record<string, unknown>);
        const lastBody = bodyText.slice(0, 200);

        const { data: existingConv } = await supabase
          .from("instagram_conversations")
          .select("id, first_inbound_at, customer_name")
          .eq("organization_id", orgId)
          .eq("instagram_business_account_id", effectiveId)
          .eq("customer_ig_id", senderId)
          .maybeSingle();

        const existingName = (existingConv as { customer_name?: string | null } | null)?.customer_name?.trim() ?? "";
        let customerName = existingName || null;
        if (!customerName && accessToken) {
          customerName = await fetchInstagramSenderDisplayName(senderId, accessToken);
        }

        const convPayload = {
          organization_id: orgId,
          instagram_business_account_id: effectiveId,
          customer_ig_id: senderId,
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
        if (existingConv) {
          const { data: updated } = await supabase
            .from("instagram_conversations")
            .update({
              last_message_at: ts,
              last_message_body: lastBody,
              last_message_direction: "inbound",
              last_inbound_at: ts,
              updated_at: ts,
              ...(customerName && !existingName ? { customer_name: customerName } : {}),
            })
            .eq("id", existingConv.id)
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
            console.error("[instagram-webhook] conversation insert error", insertErr);
            continue;
          }
          conv = inserted;
          await ensureLeadForNewInstagramConversation(
            supabase,
            orgId,
            conv!.id,
            customerName || "Instagram contact",
            lastBody || "Instagram",
            senderId,
            displayName
          );
          const { error: newCycleErr } = await supabase.from("instagram_conversation_cycles").insert({
            conversation_id: conv!.id,
            cycle_started_at: ts,
          });
          if (newCycleErr) console.error("[instagram-webhook] new conversation cycle insert error", newCycleErr);
        }

        if (!conv || !mid) {
          console.log("[instagram-webhook] skip save: no conv or mid", { conv: !!conv, mid: !!mid });
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

        if (!existingConv?.first_inbound_at && conv.first_inbound_at) {
          await supabase
            .from("instagram_conversations")
            .update({ first_inbound_at: ts, updated_at: ts })
            .eq("id", conv.id);
        }

        // Resolve-cycle: when existing conversation receives inbound, re-open to Open (Unread) if status is Closed/Resolve or null (same logic as whatsapp-webhook)
        if (existingConv) {
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

    return new Response(JSON.stringify({ success: true, processed: processedCount }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[instagram-webhook] error", err);
    return new Response(JSON.stringify({ error: "Webhook failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { LEAD_MAGNET_PAYLOAD_PREFIX } from "./leadMagnet/types.ts";
import { resolveLeadMagnetPostbackDisplayBody } from "./leadMagnet/leadMagnetLivechatDisplay.ts";
import {
  resolveLeadMagnetFacebookPostbackPayload,
  resolveLeadMagnetFacebookTextPayload,
  runLeadMagnetFacebookPostbackIfResolved,
} from "./leadMagnet/facebookLeadMagnetInbound.ts";

const META_GRAPH_VERSION = "v21.0";
const MEDIA_BUCKET = "whatsapp-media";
const META_SESSION_MS = 24 * 60 * 60 * 1000;
const LAZY_VIDEO_BYTES = 10 * 1024 * 1024;

export type FacebookWebhookPage = {
  organization_id: string;
  facebook_page_id: string;
  page_name: string | null;
  page_access_token: string | null;
};

export type MessagingEvt = {
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

function extensionFromMediaType(mediaType: string, mime?: string): string {
  const map: Record<string, string> = { image: "jpg", video: "mp4", audio: "mp3", file: "bin" };
  const t = mediaType.trim().toLowerCase();
  if (mime) {
    const m = mime.toLowerCase();
    if (m.includes("jpeg") || m.includes("jpg")) return "jpg";
    if (m.includes("png")) return "png";
    if (m.includes("mp4")) return "mp4";
  }
  return map[t] ?? "bin";
}

function getAttachmentInfo(msg: Record<string, unknown>): { type: string; url: string } | null {
  const attachments = msg.attachments as Array<{ type?: string; payload?: { url?: string } }> | undefined;
  if (!Array.isArray(attachments) || attachments.length === 0) return null;
  const first = attachments[0];
  const url = typeof first?.payload?.url === "string" ? first.payload.url.trim() : "";
  const type = typeof first?.type === "string" ? first.type.trim().toLowerCase() : "file";
  if (!url) return null;
  return { type, url };
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

async function downloadAttachmentToStorage(
  downloadUrl: string,
  accessToken: string,
  supabase: SupabaseClient,
  conversationId: string,
  platformMessageId: string,
  mediaType: string,
): Promise<string | null> {
  try {
    const fileRes = await fetch(downloadUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!fileRes.ok) return null;
    const contentLength = Number(fileRes.headers.get("content-length") ?? 0);
    const isVideo = mediaType === "video";
    if (isVideo && contentLength > LAZY_VIDEO_BYTES) return null;
    const blob = await fileRes.blob();
    if (isVideo && blob.size > LAZY_VIDEO_BYTES) return null;
    const ext = extensionFromMediaType(mediaType, blob.type);
    const safeId = platformMessageId.replace(/\W/g, "_");
    const path = `fb/inbound/${conversationId}/${safeId}.${ext}`;
    const { error: uploadErr } = await supabase.storage.from(MEDIA_BUCKET).upload(path, blob, {
      contentType: blob.type || undefined,
      upsert: true,
    });
    if (uploadErr) return null;
    const { data: urlData } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
    return urlData.publicUrl;
  } catch {
    return null;
  }
}

async function extendFacebookMetaSession(
  supabase: SupabaseClient,
  conversationId: string,
  inboundTimestampIso: string,
): Promise<void> {
  const inboundMs = new Date(inboundTimestampIso).getTime();
  if (Number.isNaN(inboundMs)) return;
  const expiresAt = new Date(inboundMs + META_SESSION_MS).toISOString();
  const { data: row } = await supabase
    .from("facebook_conversations")
    .select("meta_session_expires_at")
    .eq("id", conversationId)
    .maybeSingle();
  const prevMs = row?.meta_session_expires_at ? new Date(String(row.meta_session_expires_at)).getTime() : 0;
  const nextMs = new Date(expiresAt).getTime();
  await supabase
    .from("facebook_conversations")
    .update({ meta_session_expires_at: new Date(Math.max(prevMs, nextMs)).toISOString(), updated_at: new Date().toISOString() })
    .eq("id", conversationId);
}

async function fetchMessengerSenderDisplayName(psid: string, pageAccessToken: string): Promise<string | null> {
  const token = pageAccessToken.trim();
  const id = psid.trim();
  if (!token || !id) return null;
  const url =
    `https://graph.facebook.com/${META_GRAPH_VERSION}/${encodeURIComponent(id)}` +
    `?fields=${encodeURIComponent("first_name,last_name,name")}` +
    `&access_token=${encodeURIComponent(token)}`;
  try {
    const res = await fetch(url);
    const data = await res.json().catch(() => ({})) as { name?: string; first_name?: string; last_name?: string };
    if (!res.ok) return null;
    const name = typeof data.name === "string" ? data.name.trim() : "";
    if (name) return name;
    const first = typeof data.first_name === "string" ? data.first_name.trim() : "";
    const last = typeof data.last_name === "string" ? data.last_name.trim() : "";
    const combined = [first, last].filter(Boolean).join(" ").trim();
    return combined || null;
  } catch {
    return null;
  }
}

async function ensureLeadForNewFacebookConversation(
  supabase: SupabaseClient,
  orgId: string,
  convId: string,
  clientName: string,
  title: string,
  pageDisplayName: string,
): Promise<void> {
  const ticketId = "FB-" + String(convId).replace(/-/g, "").slice(0, 8).toUpperCase();
  const { data: existing } = await supabase.from("leads").select("id").eq("ticket_id", ticketId).maybeSingle();
  if (existing) return;
  const { data: unreadStatus } = await supabase
    .from("lead_statuses")
    .select("id")
    .or(`organization_id.eq.${orgId},organization_id.is.null`)
    .eq("name", "Unread")
    .maybeSingle();
  const statusId = unreadStatus?.id ?? null;
  if (!statusId) return;
  await supabase.from("leads").insert({
    ticket_id: ticketId,
    client: (clientName && String(clientName).trim()) || "Messenger",
    title: (title && String(title).trim().slice(0, 100)) || "Messenger",
    category: "",
    created_by: "00000000-0000-0000-0000-000000000000",
    created_by_name: pageDisplayName,
    assignee: "",
    status_id: statusId,
    organization_id: orgId,
    source: "Facebook Messenger",
    services: null,
    followup: 0,
    phone_number: null,
  });
}

export async function resolveFacebookPageByEntryId(
  supabase: SupabaseClient,
  entryId: string | null,
): Promise<FacebookWebhookPage | null> {
  const trimmed = entryId?.trim() ?? "";
  if (!trimmed) return null;

  const { data: page } = await supabase
    .from("organization_facebook_pages")
    .select("organization_id, facebook_page_id, page_name, page_access_token")
    .eq("facebook_page_id", trimmed)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (page) return page as FacebookWebhookPage;

  // Page connected via Instagram OAuth only — mirror row may exist on IG table first.
  const { data: igRow } = await supabase
    .from("organization_instagram_accounts")
    .select("organization_id, facebook_page_id, page_access_token, instagram_name")
    .eq("facebook_page_id", trimmed)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (!igRow?.facebook_page_id) return null;

  const { data: fbByIgOrg } = await supabase
    .from("organization_facebook_pages")
    .select("organization_id, facebook_page_id, page_name, page_access_token")
    .eq("facebook_page_id", trimmed)
    .eq("organization_id", igRow.organization_id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (fbByIgOrg) return fbByIgOrg as FacebookWebhookPage;

  const token = (igRow.page_access_token as string | null)?.trim() ?? "";
  if (!token) return null;

  return {
    organization_id: igRow.organization_id as string,
    facebook_page_id: String(igRow.facebook_page_id).trim(),
    page_name: (igRow.instagram_name as string | null) ?? null,
    page_access_token: token,
  };
}

/** Resolve Page from webhook entry id and/or messaging recipient (Page PSID). */
export async function resolveFacebookPageForWebhookEntry(
  supabase: SupabaseClient,
  entryId: string | null,
  messaging: MessagingEvt[],
): Promise<FacebookWebhookPage | null> {
  const candidates = new Set<string>();
  const entryTrimmed = entryId?.trim() ?? "";
  if (entryTrimmed) candidates.add(entryTrimmed);
  for (const evt of messaging) {
    const recipientId = evt.recipient?.id != null ? String(evt.recipient.id).trim() : "";
    if (recipientId) candidates.add(recipientId);
  }
  for (const id of candidates) {
    const page = await resolveFacebookPageByEntryId(supabase, id);
    if (page) return page;
  }
  return null;
}

async function handleFacebookReadReceipt(
  supabase: SupabaseClient,
  convId: string,
  read: { watermark?: unknown; mid?: unknown },
): Promise<void> {
  const now = new Date().toISOString();

  if (read.mid != null) {
    const mid = String(read.mid).trim();
    if (mid) {
      await supabase
        .from("facebook_messages")
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
        .from("facebook_messages")
        .update({ status: "read", status_updated_at: now, read_at: now })
        .eq("conversation_id", convId)
        .eq("direction", "outbound")
        .lte("created_at", wmIso);
    }
  }

  const { data: conv } = await supabase
    .from("facebook_conversations")
    .select("last_message_direction")
    .eq("id", convId)
    .maybeSingle();
  if (conv?.last_message_direction === "outbound") {
    await supabase
      .from("facebook_conversations")
      .update({ last_message_status: "read", updated_at: now })
      .eq("id", convId);
  }
}

export async function processFacebookMessengerEvents(
  supabase: SupabaseClient,
  page: FacebookWebhookPage,
  messaging: MessagingEvt[],
  notifyPush: (record: Record<string, unknown>) => Promise<void>,
  ensuredLivechatStatusOrgs: Set<string>,
): Promise<number> {
  let processedCount = 0;
  const orgId = page.organization_id;
  const pageId = String(page.facebook_page_id).trim();
  const accessToken = (page.page_access_token ?? "").trim() || null;
  const displayName = (page.page_name ?? "").trim() || pageId;

  if (!ensuredLivechatStatusOrgs.has(orgId)) {
    const { error } = await supabase.rpc("ensure_livechat_lead_statuses_for_org", { p_organization_id: orgId });
    if (!error) ensuredLivechatStatusOrgs.add(orgId);
  }

  for (const evt of messaging) {
    const senderId = evt.sender?.id != null ? String(evt.sender.id) : null;
    const ts = evt.timestamp != null ? new Date(Number(evt.timestamp)).toISOString() : new Date().toISOString();

    if (evt.message?.is_echo) continue;

    if (evt.postback) {
      if (!senderId) continue;
      const rawPayload = typeof evt.postback.payload === "string" ? evt.postback.payload.trim() : "";
      const title = typeof evt.postback.title === "string" ? evt.postback.title.trim() : "";
      const resolvedPayload = await resolveLeadMagnetFacebookPostbackPayload(supabase, {
        organizationId: orgId,
        participantScopedId: senderId,
        payload: rawPayload,
        title,
      }) ?? "";
      const bodyText = resolveLeadMagnetPostbackDisplayBody({
        payload: rawPayload || resolvedPayload,
        title,
      });
      const mid = `postback_${senderId}_${String(evt.timestamp ?? Date.now())}`;

      if (resolvedPayload && accessToken) {
        console.log("[facebook-messenger] lead-magnet postback", {
          senderId,
          rawPayload: rawPayload.slice(0, 80),
          resolvedPayload: resolvedPayload.slice(0, 80),
        });
        await runLeadMagnetFacebookPostbackIfResolved(supabase, {
          organizationId: orgId,
          accountId: pageId,
          pageId,
          participantScopedId: senderId,
          payload: resolvedPayload,
          accessToken,
        });
      }

      try {
        const convId = await upsertFacebookConversationInbound(
          supabase, orgId, pageId, senderId, bodyText, ts, accessToken, displayName,
        );
        if (convId) {
          const pbPayload = {
            conversation_id: convId,
            direction: "inbound",
            platform_message_id: mid,
            body: bodyText,
            message_type: "postback",
            raw_metadata: evt,
            created_at: ts,
          };
          await supabase.from("facebook_messages").insert(pbPayload);
          await notifyPush(pbPayload);
        }
      } catch (err) {
        console.error("[facebook-messenger] postback inbox sync error", err);
      }

      processedCount += 1;
      continue;
    }

    // Read / seen receipts (message_reads + messaging_seen subscriptions)
    if ((evt.read || evt.seen) && !evt.message && !evt.postback) {
      const customerPsid = senderId;
      if (!customerPsid) continue;
      const readPayload = (evt.read ?? evt.seen) as { watermark?: unknown; mid?: unknown };
      const { data: convForRead } = await supabase
        .from("facebook_conversations")
        .select("id")
        .eq("organization_id", orgId)
        .eq("facebook_page_id", pageId)
        .eq("customer_psid", customerPsid)
        .maybeSingle();
      if (convForRead?.id) {
        await handleFacebookReadReceipt(supabase, convForRead.id, readPayload);
        processedCount += 1;
      }
      continue;
    }

    const mid = evt.message?.mid != null ? String(evt.message.mid) : null;
    if (!senderId || !mid) continue;

    const { body: bodyText, messageType } = getMessageBody(evt as Record<string, unknown>);
    const msgRecord = (evt as Record<string, unknown>).message as Record<string, unknown> | undefined;
    const quickReplyPayload = typeof (msgRecord?.quick_reply as { payload?: string } | undefined)?.payload === "string"
      ? String((msgRecord?.quick_reply as { payload: string }).payload).trim()
      : "";

    if (accessToken) {
      let leadMagnetPayload = quickReplyPayload.startsWith(LEAD_MAGNET_PAYLOAD_PREFIX)
        ? quickReplyPayload
        : await resolveLeadMagnetFacebookTextPayload(supabase, {
          organizationId: orgId,
          participantScopedId: senderId,
          text: bodyText,
        });

      if (!leadMagnetPayload && quickReplyPayload) {
        leadMagnetPayload = await resolveLeadMagnetFacebookPostbackPayload(supabase, {
          organizationId: orgId,
          participantScopedId: senderId,
          payload: quickReplyPayload,
          title: bodyText,
        });
      }

      if (leadMagnetPayload) {
        console.log("[facebook-messenger] lead-magnet inbound message action", {
          senderId,
          bodyText: bodyText.slice(0, 80),
          leadMagnetPayload: leadMagnetPayload.slice(0, 80),
        });
        await runLeadMagnetFacebookPostbackIfResolved(supabase, {
          organizationId: orgId,
          accountId: pageId,
          pageId,
          participantScopedId: senderId,
          payload: leadMagnetPayload,
          accessToken,
        });
      }
    }

    const lastBody = bodyText.slice(0, 200);

    const { data: existingConv } = await supabase
      .from("facebook_conversations")
      .select("id, first_inbound_at, customer_name")
      .eq("organization_id", orgId)
      .eq("facebook_page_id", pageId)
      .eq("customer_psid", senderId)
      .maybeSingle();

    const existingName = (existingConv as { customer_name?: string | null } | null)?.customer_name?.trim() ?? "";
    let customerName = existingName || null;
    if (!customerName && accessToken) {
      customerName = await fetchMessengerSenderDisplayName(senderId, accessToken);
    }

    let conv: { id: string; first_inbound_at: string | null } | null = null;
    if (existingConv?.id) {
      const { data: updated } = await supabase
        .from("facebook_conversations")
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
      const ticketId = "FB-" + newConvId.replace(/-/g, "").slice(0, 8).toUpperCase();
      const orgOrGlobal = `organization_id.eq.${orgId},organization_id.is.null`;
      const { data: openStatus } = await supabase.from("lead_statuses").select("id").or(orgOrGlobal).eq("name", "Open").maybeSingle();
      const { data: unreadStatus } = openStatus?.id
        ? { data: null }
        : await supabase.from("lead_statuses").select("id").or(orgOrGlobal).eq("name", "Unread").maybeSingle();
      const leadStatusId = openStatus?.id ?? unreadStatus?.id ?? null;
      const { data: inserted, error: insertErr } = await supabase
        .from("facebook_conversations")
        .insert({
          id: newConvId,
          organization_id: orgId,
          facebook_page_id: pageId,
          customer_psid: senderId,
          customer_external_id: senderId,
          ticket_id: ticketId,
          lead_status_id: leadStatusId,
          last_message_at: ts,
          last_message_body: lastBody,
          last_message_direction: "inbound",
          last_inbound_at: ts,
          first_inbound_at: ts,
          updated_at: ts,
          ...(customerName ? { customer_name: customerName } : {}),
        })
        .select("id, first_inbound_at")
        .single();
      if (insertErr) continue;
      conv = inserted;
      await ensureLeadForNewFacebookConversation(
        supabase, orgId, conv!.id, customerName || "Messenger contact", lastBody || "Messenger", displayName,
      );
      await supabase.from("facebook_conversation_cycles").insert({ conversation_id: conv!.id, cycle_started_at: ts });
    }

    if (!conv) continue;
    await extendFacebookMetaSession(supabase, conv.id, ts);

    let mediaUrl: string | null = null;
    const attachmentInfo = msgRecord ? getAttachmentInfo(msgRecord) : null;
    if (attachmentInfo && accessToken && ["image", "video"].includes(attachmentInfo.type)) {
      mediaUrl = await downloadAttachmentToStorage(
        attachmentInfo.url, accessToken, supabase, conv.id, mid, attachmentInfo.type,
      );
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

    const { error: msgErr } = await supabase.from("facebook_messages").insert(insertPayload);
    if (msgErr) continue;
    await notifyPush(insertPayload);

    if (existingConv) {
      await reopenFacebookConversationIfNeeded(supabase, orgId, conv.id, ts);
    }

    processedCount += 1;
  }

  return processedCount;
}

async function upsertFacebookConversationInbound(
  supabase: SupabaseClient,
  orgId: string,
  pageId: string,
  senderId: string,
  bodyText: string,
  ts: string,
  accessToken: string | null,
  pageDisplayName: string,
): Promise<string | null> {
  const { data: existing } = await supabase
    .from("facebook_conversations")
    .select("id")
    .eq("organization_id", orgId)
    .eq("facebook_page_id", pageId)
    .eq("customer_psid", senderId)
    .maybeSingle();
  if (existing?.id) {
    await extendFacebookMetaSession(supabase, existing.id, ts);
    await supabase
      .from("facebook_conversations")
      .update({
        last_message_at: ts,
        last_message_body: bodyText.slice(0, 200),
        last_message_direction: "inbound",
        last_inbound_at: ts,
        updated_at: ts,
      })
      .eq("id", existing.id);
    return existing.id;
  }
  const newConvId = crypto.randomUUID();
  const ticketId = "FB-" + newConvId.replace(/-/g, "").slice(0, 8).toUpperCase();
  const orgOrGlobal = `organization_id.eq.${orgId},organization_id.is.null`;
  const { data: openSt } = await supabase.from("lead_statuses").select("id").or(orgOrGlobal).eq("name", "Open").maybeSingle();
  const { data: unreadSt } = openSt?.id
    ? { data: null }
    : await supabase.from("lead_statuses").select("id").or(orgOrGlobal).eq("name", "Unread").maybeSingle();
  let customerName: string | null = null;
  if (accessToken) customerName = await fetchMessengerSenderDisplayName(senderId, accessToken);
  const { data: inserted } = await supabase
    .from("facebook_conversations")
    .insert({
      id: newConvId,
      organization_id: orgId,
      facebook_page_id: pageId,
      customer_psid: senderId,
      customer_external_id: senderId,
      ticket_id: ticketId,
      lead_status_id: openSt?.id ?? unreadSt?.id ?? null,
      last_message_at: ts,
      last_message_body: bodyText.slice(0, 200),
      last_message_direction: "inbound",
      last_inbound_at: ts,
      first_inbound_at: ts,
      updated_at: ts,
      ...(customerName ? { customer_name: customerName } : {}),
    })
    .select("id")
    .single();
  if (!inserted?.id) return null;
  await ensureLeadForNewFacebookConversation(
    supabase, orgId, inserted.id, customerName || "Messenger contact", bodyText, pageDisplayName,
  );
  await supabase.from("facebook_conversation_cycles").insert({ conversation_id: inserted.id, cycle_started_at: ts });
  return inserted.id;
}

async function reopenFacebookConversationIfNeeded(
  supabase: SupabaseClient,
  orgId: string,
  convId: string,
  ts: string,
): Promise<void> {
  const { data: convRow } = await supabase
    .from("facebook_conversations")
    .select("lead_status_id, organization_id, ticket_id")
    .eq("id", convId)
    .single();
  const statusId = convRow?.lead_status_id ?? null;
  let leadStatusName: string | null = null;
  if (statusId) {
    const { data: statusRow } = await supabase.from("lead_statuses").select("name").eq("id", statusId).maybeSingle();
    leadStatusName = (statusRow?.name as string) ?? null;
  }
  const orgOrGlobal = `organization_id.eq.${orgId},organization_id.is.null`;
  const { data: openStatus } = await supabase.from("lead_statuses").select("id").or(orgOrGlobal).eq("name", "Open").maybeSingle();
  const { data: unreadStatus } = openStatus?.id
    ? { data: null }
    : await supabase.from("lead_statuses").select("id").or(orgOrGlobal).eq("name", "Unread").maybeSingle();
  const openStatusId = openStatus?.id ?? unreadStatus?.id ?? null;
  const statusNameLower = leadStatusName?.trim().toLowerCase() ?? "";
  const isResolved = statusNameLower === "closed" || statusNameLower === "resolve";
  const isExpired = statusNameLower === "expired";
  if (!openStatusId || !(statusId == null || isResolved || isExpired)) return;
  await supabase
    .from("facebook_conversations")
    .update({ lead_status_id: openStatusId, last_inbound_at: ts, updated_at: ts })
    .eq("id", convId);
  if (convRow?.organization_id) {
    const ticketId =
      (convRow.ticket_id as string) ?? `FB-${convId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
    await supabase
      .from("leads")
      .update({ status_id: openStatusId, updated_at: ts })
      .eq("organization_id", convRow.organization_id)
      .eq("ticket_id", ticketId);
  }
  await supabase.from("facebook_conversation_cycles").insert({ conversation_id: convId, cycle_started_at: ts });
}

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const META_SESSION_MS = 24 * 60 * 60 * 1000;

export type ThreadsWebhookAccount = {
  organization_id: string;
  threads_user_id: string;
  threads_username: string | null;
  instagram_username: string | null;
  instagram_name: string | null;
};

export type ThreadsWebhookPayload = {
  app_id?: unknown;
  topic?: unknown;
  target_id?: unknown;
  time?: unknown;
  subscription_id?: unknown;
  values?: {
    field?: unknown;
    value?: Record<string, unknown>;
  };
};

function normalizeUsername(raw: unknown): string {
  const s = raw != null ? String(raw).trim().replace(/^@/, "") : "";
  return s;
}

function customerKeyFromValue(value: Record<string, unknown>): string {
  const owner = value.owner as { owner_id?: unknown } | undefined;
  if (owner?.owner_id != null && String(owner.owner_id).trim()) {
    return String(owner.owner_id).trim();
  }
  const username = normalizeUsername(value.username);
  if (username) return `u:${username.toLowerCase()}`;
  const id = value.id != null ? String(value.id).trim() : "";
  return id ? `m:${id}` : "unknown";
}

function customerDisplayName(value: Record<string, unknown>): string | null {
  const username = normalizeUsername(value.username);
  if (username) return `@${username}`;
  return null;
}

function parseTimestamp(payload: ThreadsWebhookPayload, value: Record<string, unknown>): string {
  const ts = value.timestamp;
  if (typeof ts === "string" && ts.trim()) {
    const d = new Date(ts);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  const t = payload.time;
  if (t != null) {
    const n = Number(t);
    if (Number.isFinite(n) && n > 0) {
      const ms = n > 1e12 ? n : n * 1000;
      return new Date(ms).toISOString();
    }
  }
  return new Date().toISOString();
}

function rootMediaIdFromValue(
  field: string,
  targetId: string,
  value: Record<string, unknown>,
): string {
  const rootPost = value.root_post as { id?: unknown } | undefined;
  if (rootPost?.id != null && String(rootPost.id).trim()) {
    return String(rootPost.id).trim();
  }
  if (targetId) return targetId;
  const repliedTo = value.replied_to as { id?: unknown } | undefined;
  if (repliedTo?.id != null && String(repliedTo.id).trim()) {
    return String(repliedTo.id).trim();
  }
  return "";
}

function messageBodyFromValue(value: Record<string, unknown>): { body: string; messageType: string } {
  const text = typeof value.text === "string" ? value.text.trim() : "";
  const mediaType = typeof value.media_type === "string" ? value.media_type.trim().toLowerCase() : "text";
  if (text) return { body: text, messageType: mediaType || "text" };
  if (mediaType && mediaType !== "text") return { body: `[${mediaType}]`, messageType: mediaType };
  return { body: "[Threads message]", messageType: "text" };
}

function isOwnInbound(value: Record<string, unknown>, account: ThreadsWebhookAccount): boolean {
  if (value.is_reply_owned_by_me === true) return true;
  const rootPost = value.root_post as { owner_id?: unknown; username?: unknown } | undefined;
  const ownerId = rootPost?.owner_id != null ? String(rootPost.owner_id).trim() : "";
  if (ownerId && ownerId === account.threads_user_id) {
    const username = normalizeUsername(value.username);
    const ours = normalizeUsername(account.threads_username);
    if (username && ours && username.toLowerCase() === ours.toLowerCase()) return true;
  }
  return false;
}

async function extendThreadsMetaSession(
  supabase: SupabaseClient,
  conversationId: string,
  inboundTimestampIso: string,
): Promise<void> {
  const inboundMs = new Date(inboundTimestampIso).getTime();
  if (Number.isNaN(inboundMs)) return;
  const expiresAt = new Date(inboundMs + META_SESSION_MS).toISOString();
  const { data: row } = await supabase
    .from("threads_conversations")
    .select("meta_session_expires_at")
    .eq("id", conversationId)
    .maybeSingle();
  const prevMs = row?.meta_session_expires_at ? new Date(String(row.meta_session_expires_at)).getTime() : 0;
  const nextMs = new Date(expiresAt).getTime();
  await supabase
    .from("threads_conversations")
    .update({
      meta_session_expires_at: new Date(Math.max(prevMs, nextMs)).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversationId);
}

async function ensureLeadForNewThreadsConversation(
  supabase: SupabaseClient,
  orgId: string,
  convId: string,
  clientName: string,
  title: string,
  createdByDisplayName: string,
): Promise<void> {
  const ticketId = "TH-" + String(convId).replace(/-/g, "").slice(0, 8).toUpperCase();
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
    client: (clientName && String(clientName).trim()) || "Threads",
    title: (title && String(title).trim().slice(0, 100)) || "Threads",
    category: "",
    created_by: "00000000-0000-0000-0000-000000000000",
    created_by_name: createdByDisplayName,
    assignee: "",
    status_id: statusId,
    organization_id: orgId,
    source: "Threads",
    services: null,
    followup: 0,
    phone_number: null,
  });
}

async function reopenThreadsConversationIfNeeded(
  supabase: SupabaseClient,
  orgId: string,
  convId: string,
  ts: string,
): Promise<void> {
  const { data: convRow } = await supabase
    .from("threads_conversations")
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
    .from("threads_conversations")
    .update({ lead_status_id: openStatusId, last_inbound_at: ts, updated_at: ts })
    .eq("id", convId);

  if (convRow?.organization_id) {
    const ticketId =
      (convRow.ticket_id as string) ?? `TH-${convId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
    await supabase
      .from("leads")
      .update({ status_id: openStatusId, updated_at: ts })
      .eq("organization_id", convRow.organization_id)
      .eq("ticket_id", ticketId);
  }
  await supabase.from("threads_conversation_cycles").insert({ conversation_id: convId, cycle_started_at: ts });
}

export async function resolveThreadsAccountForWebhook(
  supabase: SupabaseClient,
  payload: ThreadsWebhookPayload,
): Promise<ThreadsWebhookAccount | null> {
  const value = payload.values?.value ?? {};
  const targetId = payload.target_id != null ? String(payload.target_id).trim() : "";
  const field = payload.values?.field != null ? String(payload.values.field).trim().toLowerCase() : "";

  const candidateIds = new Set<string>();
  if (targetId) candidateIds.add(targetId);

  const rootPost = value.root_post as { owner_id?: unknown } | undefined;
  if (rootPost?.owner_id != null && String(rootPost.owner_id).trim()) {
    candidateIds.add(String(rootPost.owner_id).trim());
  }

  if (field === "mentions" && targetId) {
    candidateIds.add(targetId);
  }

  for (const id of candidateIds) {
    const { data: row } = await supabase
      .from("organization_instagram_accounts")
      .select("organization_id, threads_user_id, threads_username, instagram_username, instagram_name")
      .eq("threads_user_id", id)
      .eq("is_active", true)
      .eq("has_threads", true)
      .limit(1)
      .maybeSingle();
    if (row?.threads_user_id) {
      return row as ThreadsWebhookAccount;
    }
  }

  return null;
}

export async function processThreadsLivechatWebhook(
  supabase: SupabaseClient,
  account: ThreadsWebhookAccount,
  payload: ThreadsWebhookPayload,
  notifyPush: (record: Record<string, unknown>) => Promise<void>,
  ensuredLivechatStatusOrgs: Set<string>,
): Promise<boolean> {
  const field = payload.values?.field != null ? String(payload.values.field).trim().toLowerCase() : "";
  if (field !== "replies" && field !== "mentions") {
    return false;
  }

  const value = payload.values?.value;
  if (!value || typeof value !== "object") return false;

  const platformMessageId = value.id != null ? String(value.id).trim() : "";
  if (!platformMessageId) return false;

  if (isOwnInbound(value, account)) return false;

  const orgId = account.organization_id;
  const threadsUserId = String(account.threads_user_id).trim();
  const targetId = payload.target_id != null ? String(payload.target_id).trim() : "";
  const customerKey = customerKeyFromValue(value);
  const customerName = customerDisplayName(value);
  const rootMediaId = rootMediaIdFromValue(field, targetId, value);
  if (!rootMediaId) {
    console.error("[threads-webhook] missing root_media_id for message", platformMessageId);
    return false;
  }
  const ts = parseTimestamp(payload, value);
  const { body: bodyText, messageType } = messageBodyFromValue(value);
  const lastBody = bodyText.slice(0, 200);
  const displayName =
    (account.threads_username ? `@${account.threads_username.trim()}` : null) ||
    (account.instagram_username ? `@${account.instagram_username.trim()}` : null) ||
    (account.instagram_name ?? "").trim() ||
    threadsUserId;

  if (!ensuredLivechatStatusOrgs.has(orgId)) {
    const { error } = await supabase.rpc("ensure_livechat_lead_statuses_for_org", { p_organization_id: orgId });
    if (!error) ensuredLivechatStatusOrgs.add(orgId);
  }

  const { data: existingConv } = await supabase
    .from("threads_conversations")
    .select("id, first_inbound_at, customer_name")
    .eq("organization_id", orgId)
    .eq("threads_user_id", threadsUserId)
    .eq("customer_threads_id", customerKey)
    .eq("root_media_id", rootMediaId)
    .maybeSingle();

  const existingName = (existingConv as { customer_name?: string | null } | null)?.customer_name?.trim() ?? "";

  let conv: { id: string; first_inbound_at: string | null } | null = null;
  if (existingConv?.id) {
    const { data: updated } = await supabase
      .from("threads_conversations")
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
    const ticketId = "TH-" + newConvId.replace(/-/g, "").slice(0, 8).toUpperCase();
    const orgOrGlobal = `organization_id.eq.${orgId},organization_id.is.null`;
    const { data: openStatus } = await supabase.from("lead_statuses").select("id").or(orgOrGlobal).eq("name", "Open").maybeSingle();
    const { data: unreadStatus } = openStatus?.id
      ? { data: null }
      : await supabase.from("lead_statuses").select("id").or(orgOrGlobal).eq("name", "Unread").maybeSingle();
    const leadStatusId = openStatus?.id ?? unreadStatus?.id ?? null;

    const { data: inserted, error: insertErr } = await supabase
      .from("threads_conversations")
      .insert({
        id: newConvId,
        organization_id: orgId,
        threads_user_id: threadsUserId,
        customer_threads_id: customerKey,
        customer_external_id: customerKey,
        customer_name: customerName,
        root_media_id: rootMediaId,
        ticket_id: ticketId,
        lead_status_id: leadStatusId,
        last_message_at: ts,
        last_message_body: lastBody,
        last_message_direction: "inbound",
        last_inbound_at: ts,
        first_inbound_at: ts,
        updated_at: ts,
      })
      .select("id, first_inbound_at")
      .single();
    if (insertErr) {
      console.error("[threads-webhook] conversation insert error", insertErr.message);
      return false;
    }
    conv = inserted;
    await ensureLeadForNewThreadsConversation(
      supabase,
      orgId,
      conv!.id,
      customerName || "Threads contact",
      lastBody || "Threads",
      displayName,
    );
    await supabase.from("threads_conversation_cycles").insert({ conversation_id: conv!.id, cycle_started_at: ts });
  }

  if (!conv) return false;

  await extendThreadsMetaSession(supabase, conv.id, ts);

  const repliedTo = value.replied_to as { id?: unknown } | undefined;
  const replyToMid = repliedTo?.id != null ? String(repliedTo.id).trim() : null;

  const insertPayload: Record<string, unknown> = {
    conversation_id: conv.id,
    direction: "inbound",
    platform_message_id: platformMessageId,
    body: bodyText,
    message_type: messageType,
    raw_metadata: payload,
    created_at: ts,
  };

  const mediaUrl = typeof value.media_url === "string" ? value.media_url.trim() : "";
  if (mediaUrl) insertPayload.media_url = mediaUrl;

  if (replyToMid) {
    insertPayload.reply_to_platform_message_id = replyToMid;
    const { data: repliedToRow } = await supabase
      .from("threads_messages")
      .select("body, message_type")
      .eq("conversation_id", conv.id)
      .eq("platform_message_id", replyToMid)
      .maybeSingle();
    if (repliedToRow) {
      insertPayload.reply_to_body = repliedToRow.body ?? "[Pesan]";
      insertPayload.reply_to_message_type = repliedToRow.message_type ?? "text";
    } else {
      insertPayload.reply_to_body = "[Pesan]";
    }
  }

  const { error: msgErr } = await supabase.from("threads_messages").insert(insertPayload);
  if (msgErr) {
    if (msgErr.code === "23505") return false;
    console.error("[threads-webhook] threads_messages insert error", msgErr.message);
    return false;
  }

  await notifyPush(insertPayload);

  if (existingConv) {
    await reopenThreadsConversationIfNeeded(supabase, orgId, conv.id, ts);
  }

  return true;
}

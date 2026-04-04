import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/** Declare Deno global for IDE when edge-runtime.d.ts is not resolved */
declare const Deno: {
  serve: (handler: (req: Request) => Promise<Response> | Response) => void;
  env: { get(key: string): string | undefined };
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const META_GRAPH_BASE = "https://graph.facebook.com/v18.0";
/** Same bucket as outbound sends (ChatThread) – satu bucket untuk kirim & terima media */
const WHATSAPP_MEDIA_BUCKET = "whatsapp-media";

/** Frasa + kata satuan yang mengindikasikan permintaan kontak. On/off via env WHATSAPP_BLOCK_CONTACT_REQUESTS. */
const CONTACT_REQUEST_PHRASES: readonly string[] = [
  "nomor", "wa", "whatsapp", "hp", "telepon", "telpon", "tlp", "tlpn", "telephone", "email", "kontak", "contact",
  "nomor hp", "nomor telepon", "nomor wa", "nomor whatsapp", "no hp", "no telepon", "no wa", "no whatsapp",
  "number wa", "whatsapp number", "hp kamu", "telepon kamu", "wa kamu", "kirim nomor", "beri nomor", "bagi nomor",
  "share nomor", "kontak kamu", "kontak anda", "nomor kontak", "no kontak", "bisa wa", "bisa chat wa", "chat wa dong",
  "wa saja", "hubungi wa", "whatsapp saja", "dm wa", "invite wa", "add wa", "nomor untuk dihubungi",
  "nomor yang bisa dihubungi", "no yang bisa dihubungi",
  "email kamu", "email anda", "alamat email", "e-mail", "kirim email", "beri email", "bagi email", "share email",
  "kontak email", "email untuk konfirmasi", "email untuk dihubungi", "dm email", "send email", "your email", "email address",
  "cara menghubungi", "cara hubungi", "bagaimana menghubungi", "how to contact", "contact you", "hubungi kamu",
  "nomor atau email", "no atau email", "line kamu", "id line", "telegram", "ig kamu", "instagram kamu", "sosmed", "media sosial",
  "minta nomor wa", "minta nomor", "berapa nomor", "apa nomor", "bisa minta nomor", "boleh minta nomor", "bisa minta kontak", "boleh minta kontak",
  "bisa minta email", "boleh minta email", "bisa kasih nomor", "boleh kasih nomor", "bisa share nomor", "boleh share nomor",
  "what's your number", "what's your email", "whatsapp number", "phone number", "contact number",
  "can i get your number", "can i get your email", "give me your number", "give me your email",
  "send me your number", "send me your email", "share your number", "share your email",
  "drop your number", "drop your email", "dm your number", "dm your email",
];

function messageContainsContactRequest(text: string | null | undefined): boolean {
  if (text == null || text === "") return false;
  const normalized = text.toLowerCase().trim().replace(/\s+/g, " ");
  if (normalized.length === 0) return false;
  return CONTACT_REQUEST_PHRASES.some((phrase) => normalized.includes(phrase));
}

function getMediaIdAndType(msg: Record<string, unknown>): { id: string; type: string; mime?: string; filename?: string } | null {
  const img = msg.image as { id?: string; mime_type?: string } | undefined;
  if (img?.id) return { id: img.id, type: "image", mime: img.mime_type };
  const vid = msg.video as { id?: string; mime_type?: string } | undefined;
  if (vid?.id) return { id: vid.id, type: "video", mime: vid.mime_type };
  const doc = msg.document as { id?: string; mime_type?: string; filename?: string } | undefined;
  if (doc?.id) return { id: doc.id, type: "document", mime: doc.mime_type, filename: doc.filename };
  const aud = msg.audio as { id?: string; mime_type?: string } | undefined;
  if (aud?.id) return { id: aud.id, type: "audio", mime: aud.mime_type };
  return null;
}

/** Caption dari pesan masuk (penerima kirim gambar/video/dokumen + caption). Meta bisa kirim di objek media atau top-level. */
function getInboundMediaCaption(msg: Record<string, unknown>): string | null {
  const trimCaption = (raw: unknown): string | null => {
    if (raw == null) return null;
    const s = String(raw).trim();
    return s !== "" ? s : null;
  };
  // Top-level caption (beberapa versi payload)
  const top = trimCaption(msg.caption);
  if (top) return top;
  // Di dalam objek media: image.caption, video.caption, document.caption
  for (const key of ["image", "video", "document"] as const) {
    const obj = msg[key];
    if (obj && typeof obj === "object" && obj !== null && "caption" in obj) {
      const c = trimCaption((obj as { caption?: unknown }).caption);
      if (c) return c;
    }
  }
  return null;
}

function extensionFromMimeOrFilename(mime?: string, filename?: string): string {
  if (filename && filename.includes(".")) return filename.replace(/^.*\./, "").toLowerCase().slice(0, 8);
  const map: Record<string, string> = {
    "image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png", "image/gif": "gif", "image/webp": "webp",
    "video/mp4": "mp4", "video/3gpp": "3gp",
    "application/pdf": "pdf",
    "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/amr": "amr",
  };
  if (mime) return map[mime.toLowerCase()] ?? mime.split("/")[1]?.slice(0, 8) ?? "bin";
  return "bin";
}

async function resolveInboundMediaUrl(
  mediaId: string,
  accessToken: string,
  supabase: ReturnType<typeof createClient>,
  conversationId: string,
  waMessageId: string,
  type: string,
  mime?: string,
  filename?: string
): Promise<string | null> {
  try {
    const metaRes = await fetch(`${META_GRAPH_BASE}/${mediaId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!metaRes.ok) return null;
    const metaJson = await metaRes.json().catch(() => ({}));
    const downloadUrl = metaJson.url;
    if (!downloadUrl || typeof downloadUrl !== "string") return null;

    const fileRes = await fetch(downloadUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!fileRes.ok) return null;
    const blob = await fileRes.blob();
    const ext = extensionFromMimeOrFilename(mime, filename);
    const safeId = waMessageId.replace(/\W/g, "_");
    const path = `inbound/${conversationId}/${safeId}.${ext}`;

    const { error: uploadErr } = await supabase.storage.from(WHATSAPP_MEDIA_BUCKET).upload(path, blob, {
      contentType: blob.type || undefined,
      upsert: true,
    });
    if (uploadErr) {
      console.error("Webhook storage upload error:", uploadErr);
      return null;
    }
    const { data: urlData } = supabase.storage.from(WHATSAPP_MEDIA_BUCKET).getPublicUrl(path);
    return urlData.publicUrl;
  } catch (e) {
    console.error("resolveInboundMediaUrl error:", e);
    return null;
  }
}

/** Insert a lead row when a new WhatsApp conversation is created. Link by ticket_id (WA-xxx). */
async function ensureLeadForNewConversation(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  convId: string,
  channel: "whatsapp",
  client: string,
  title: string,
  customerWaId: string | null | undefined,
  createdByDisplayName: string
): Promise<void> {
  const ticketId = "WA-" + String(convId).replace(/-/g, "").slice(0, 8).toUpperCase();
  const { data: existing } = await supabase.from("leads").select("id").eq("ticket_id", ticketId).maybeSingle();
  if (existing) return;

  const { data: unreadStatus } = await supabase
    .from("lead_statuses")
    .select("id")
    .eq("name", "Unread")
    .limit(1)
    .maybeSingle();
  const statusId = unreadStatus?.id ?? null;
  if (!statusId) {
    console.warn("ensureLeadForNewConversation: no Unread status in lead_statuses, skip lead insert");
    return;
  }

  const source = "WhatsApp";
  const safeClient = (client && String(client).trim()) || source;
  const safeTitle = (title && String(title).trim().slice(0, 100)) || source;
  const phoneNumber = source === "WhatsApp" && customerWaId ? String(customerWaId).trim() || null : null;

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
    source,
    services: null,
    followup: 0,
    phone_number: phoneNumber,
  });
  if (error) {
    console.error("ensureLeadForNewConversation: insert error", error);
    return;
  }
  console.log("ensureLeadForNewConversation: lead created", { ticket_id: ticketId, source });
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const ts = new Date().toISOString();
  console.log("[whatsapp-webhook] ENTRY", ts, req.method, url.pathname, req.method === "GET" ? "query=" + url.searchParams.toString().slice(0, 80) : "body=...");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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

      if (mode !== "subscribe" || !token || !challenge) {
        console.log("[whatsapp-webhook] GET: not Meta verify (mode=" + mode + "), returning 200 for ping");
        return new Response("whatsapp-webhook ok\n" + new Date().toISOString(), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "text/plain" },
        });
      }

      console.log("Webhook GET: verification (hub.mode=subscribe), checking verify_token...");
      let verified = false;

      const { data: account, error } = await supabase
        .from("organization_whatsapp_accounts")
        .select("id")
        .eq("verify_token", token)
        .eq("is_active", true)
        .maybeSingle();

      if (error) {
        console.error("Webhook GET: DB error on organization_whatsapp_accounts", error);
        return new Response("Forbidden", { status: 403, headers: corsHeaders });
      }
      if (account) {
        verified = true;
      }

      if (!verified) {
        const { data: metaRow, error: metaError } = await supabase
          .from("organization_meta_config")
          .select("id")
          .eq("verify_token", token)
          .eq("is_active", true)
          .maybeSingle();
        if (metaError) {
          console.error("Webhook GET: DB error on organization_meta_config", metaError);
          return new Response("Forbidden", { status: 403, headers: corsHeaders });
        }
        if (metaRow) verified = true;
      }

      if (!verified) {
        console.error("Webhook GET: Verify token not found in organization_whatsapp_accounts or organization_meta_config (no matching config)");
        return new Response("Forbidden", { status: 403, headers: corsHeaders });
      }

      console.log("Webhook GET: verification success, returning challenge");
      return new Response(challenge, {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    if (req.method === "POST") {
      const body = await req.json().catch((e) => {
        console.error("[whatsapp-webhook] POST body parse failed", e);
        return {};
      });
      const objectType = body?.object ?? "(none)";
      const entryCount = (body?.entry ?? []).length;
      console.log("[whatsapp-webhook] POST received object=", objectType, "entryCount=", entryCount);
      const firstEntry = body?.entry?.[0];
      const firstChange = firstEntry?.changes?.[0];
      const firstValue = firstChange?.value ?? {};
      const firstPhoneId = firstValue?.metadata?.phone_number_id ?? firstValue?.phone_number_id;
      if (firstPhoneId != null) {
        console.log("[whatsapp-webhook] POST first phone_number_id from payload:", String(firstPhoneId));
      }

      if (body.object === "whatsapp_business_account") {
        const entries = body.entry ?? [];
        for (const entry of entries) {
          // Meta sends WhatsApp Business Account ID (WABA ID) in entry.id – validate so we only process for the correct WABA
          const rawWabaId = entry.id != null ? String(entry.id).trim() || null : null;
          const whatsappBusinessAccountId = rawWabaId && rawWabaId.length > 0 ? rawWabaId : null;

          const changes = entry.changes ?? [];
          for (const change of changes) {
            if (change.field === "messages") {
              const value = change.value ?? {};
              const rawPhoneNumberId = value.metadata?.phone_number_id ?? value.phone_number_id;
              const phoneNumberId = rawPhoneNumberId != null ? String(rawPhoneNumberId).trim() || null : null;
              const contacts = value.contacts ?? [];
              const messages = value.messages ?? [];
              const statuses = value.statuses ?? [];

              if (whatsappBusinessAccountId) {
                console.log("[whatsapp-webhook] POST entry whatsapp_business_account_id=", whatsappBusinessAccountId, "phone_number_id=", phoneNumberId ?? "(none)");
              }

              // Handle status updates (delivered, read)
              for (const st of statuses) {
                const waMessageId = st.id;
                const status = st.status; // sent | delivered | read
                const statusTimestamp = st.timestamp ? new Date(Number(st.timestamp) * 1000).toISOString() : new Date().toISOString();
                if (!waMessageId || !status) continue;
                await supabase
                  .from("whatsapp_messages")
                  .update({ status, status_updated_at: statusTimestamp })
                  .eq("wa_message_id", waMessageId);
              }

              if (!phoneNumberId || messages.length === 0) {
                if (phoneNumberId && messages.length === 0 && (value.statuses ?? []).length === 0) {
                  console.log("Webhook: phone_number_id=", phoneNumberId, "has no messages and no statuses in this payload, skipping");
                }
                continue;
              }

              // Resolve orgs by phone_number_id from organization_whatsapp_accounts only (no fallback to organization_meta_config).
              type OrgAccount = { organization_id: string; meta_access_token: string; created_by_display_name: string };
              let accountsList: OrgAccount[] = [];

              const { data: accountRows, error: accountError } = await supabase
                .from("organization_whatsapp_accounts")
                .select("organization_id, meta_access_token, whatsapp_business_account_id, whatsapp_business_name, display_phone_number, phone_number_id")
                .eq("phone_number_id", phoneNumberId)
                .eq("is_active", true);

              if (!accountError && accountRows?.length) {
                let rows = accountRows as Array<{
                  organization_id: string;
                  meta_access_token: string | null;
                  whatsapp_business_account_id: string | null;
                  whatsapp_business_name: string | null;
                  display_phone_number: string | null;
                  phone_number_id: string | null;
                }>;
                if (whatsappBusinessAccountId) {
                  const wabaMatched = rows.filter((r) => (r.whatsapp_business_account_id ?? "").trim() === whatsappBusinessAccountId);
                  const wabaNull = rows.filter((r) => !(r.whatsapp_business_account_id ?? "").trim());
                  rows = wabaMatched.length > 0 ? wabaMatched : wabaNull;
                }
                accountsList = rows
                  .map((r) => {
                    const name = (r.whatsapp_business_name ?? "").trim() || (r.display_phone_number ?? "").trim() || (r.phone_number_id ?? "").trim() || "WhatsApp";
                    return {
                      organization_id: r.organization_id,
                      meta_access_token: (r.meta_access_token ?? "").trim(),
                      created_by_display_name: name,
                    };
                  })
                  .filter((a) => a.meta_access_token && a.organization_id);
              }

              if (accountsList.length === 0) {
                console.error(
                  "Config not found for phone_number_id:",
                  phoneNumberId,
                  whatsappBusinessAccountId ? "whatsapp_business_account_id:" + whatsappBusinessAccountId : "",
                  accountError ?? null
                );
                continue;
              }

              // Dedupe by organization_id (keep first)
              const seenOrgIds = new Set<string>();
              accountsList = accountsList.filter((a) => {
                if (seenOrgIds.has(a.organization_id)) return false;
                seenOrgIds.add(a.organization_id);
                return true;
              });

              console.log(
                "Webhook: resolved accounts for phone_number_id=",
                phoneNumberId,
                whatsappBusinessAccountId ? "waba_id=" + whatsappBusinessAccountId : "",
                "org_count=",
                accountsList.length,
                "messages_count=",
                messages.length
              );

              const contactMap: Record<string, string> = {};
              for (const c of contacts) {
                if (c.wa_id && c.profile?.name) contactMap[c.wa_id] = c.profile.name;
              }
              const sortedMessages = [...messages].sort(
                (a, b) => (Number(a.timestamp ?? 0) - Number(b.timestamp ?? 0))
              );
              const blockContactRequests = Deno.env.get("WHATSAPP_BLOCK_CONTACT_REQUESTS") !== "false";

              for (const account of accountsList) {
                const orgId = account.organization_id;
                const accessToken = account.meta_access_token;
                if (!accessToken) {
                  console.error("No token for org/phone_number_id:", orgId, phoneNumberId);
                  continue;
                }

                // Backfill display_phone_number on organization_whatsapp_accounts from webhook metadata
              const rawDisplayNumber = value.metadata?.display_phone_number;
              if (rawDisplayNumber != null) {
                let displayNumber = typeof rawDisplayNumber === "number" ? String(rawDisplayNumber) : (typeof rawDisplayNumber === "string" ? rawDisplayNumber.trim() : "");
                if (displayNumber && /^\d+$/.test(displayNumber)) displayNumber = `+${displayNumber}`;
                if (displayNumber) {
                  await supabase
                    .from("organization_whatsapp_accounts")
                    .update({ display_phone_number: displayNumber, updated_at: new Date().toISOString() })
                    .eq("organization_id", orgId)
                    .eq("phone_number_id", phoneNumberId);
                }
              }

              for (const msg of sortedMessages) {
                if (msg.type === "unsupported") {
                  continue;
                }
                const customerWaId = String(msg.from ?? "");
                const mediaCaption = getInboundMediaCaption(msg as Record<string, unknown>);
                const bodyText =
                  msg.text?.body ?? mediaCaption ?? (msg.type === "text" ? "" : `[${msg.type}]`);
                if (blockContactRequests && messageContainsContactRequest(bodyText)) {
                  continue;
                }
                const msgId = msg.id;
                const timestamp = msg.timestamp ? new Date(Number(msg.timestamp) * 1000).toISOString() : new Date().toISOString();
                const customerName = contactMap[customerWaId] ?? null;

                const lastBody = typeof bodyText === "string" ? bodyText.slice(0, 200) : "";
                const convPayload: Record<string, unknown> = {
                  organization_id: orgId,
                  customer_wa_id: customerWaId,
                  customer_external_id: customerWaId,
                  channel: "whatsapp",
                  phone_number_id: phoneNumberId,
                  last_message_at: timestamp,
                  last_message_body: lastBody,
                  last_inbound_at: timestamp,
                  updated_at: timestamp,
                };
                if (customerName) convPayload.customer_name = customerName;

                // One conversation per (org, channel, customer, phone_number_id) – list and messages separated by account (Synckerja, Vialdi Wedding, etc.).
                const { data: existingConv } = await supabase
                  .from("whatsapp_conversations")
                  .select("id")
                  .eq("organization_id", orgId)
                  .eq("customer_wa_id", customerWaId)
                  .eq("channel", "whatsapp")
                  .eq("phone_number_id", phoneNumberId)
                  .maybeSingle();

                let conv: { id: string } | null = null;
                if (existingConv) {
                  const { data: updated } = await supabase
                    .from("whatsapp_conversations")
                    .update({
                      last_message_at: timestamp,
                      last_message_body: lastBody,
                      last_inbound_at: timestamp,
                      customer_name: customerName ?? undefined,
                      updated_at: timestamp,
                    })
                    .eq("id", existingConv.id)
                    .select("id")
                    .single();
                  conv = updated;
                } else {
                  const { data: inserted, error: insertErr } = await supabase
                    .from("whatsapp_conversations")
                    .insert(convPayload)
                    .select("id")
                    .single();
                  if (insertErr) {
                    console.error("Conversation insert error", insertErr);
                    continue;
                  }
                  conv = inserted;
                  await ensureLeadForNewConversation(
                    supabase,
                    orgId,
                    conv!.id,
                    "whatsapp",
                    customerName ?? customerWaId ?? "WhatsApp",
                    lastBody ?? "WhatsApp",
                    customerWaId,
                    account.created_by_display_name
                  );
                }

                if (!conv) {
                  continue;
                }

                let mediaUrl: string | null = null;
                const mediaInfo = getMediaIdAndType(msg as Record<string, unknown>);
                if (mediaInfo && accessToken) {
                  mediaUrl = await resolveInboundMediaUrl(
                    mediaInfo.id,
                    accessToken,
                    supabase,
                    conv.id,
                    msgId,
                    mediaInfo.type,
                    mediaInfo.mime,
                    mediaInfo.filename
                  );
                  if (!mediaUrl) {
                    console.warn("Inbound media resolution failed (Meta or storage). Message will show [image] + Tampilkan gambar.", { msgId, type: mediaInfo.type });
                  }
                }

                const insertPayload: Record<string, unknown> = {
                  conversation_id: conv.id,
                  direction: "inbound",
                  wa_message_id: msgId,
                  platform_message_id: msgId,
                  channel: "whatsapp",
                  body: bodyText,
                  message_type: msg.type ?? "text",
                  raw_metadata: msg,
                  created_at: timestamp,
                };
                if (mediaUrl) insertPayload.media_url = mediaUrl;

                // Inbound reply context: extract context.reply_to so UI can show reply preview
                const msgRaw = msg as Record<string, unknown>;
                const context = msgRaw?.context as { reply_to?: { id?: string }; id?: string } | undefined;
                const replyToId = context?.reply_to?.id ?? context?.id;
                if (replyToId && typeof replyToId === "string") {
                  const replyToWaMessageId = replyToId.trim();
                  if (replyToWaMessageId) {
                    insertPayload.reply_to_wa_message_id = replyToWaMessageId;
                    const { data: repliedToRow } = await supabase
                      .from("whatsapp_messages")
                      .select("body, message_type, direction")
                      .eq("conversation_id", conv.id)
                      .eq("wa_message_id", replyToWaMessageId)
                      .maybeSingle();
                    if (repliedToRow) {
                      const repliedBody = repliedToRow.body;
                      const repliedType = (repliedToRow.message_type ?? "text") as string;
                      insertPayload.reply_to_body =
                        repliedBody != null && repliedBody !== ""
                          ? String(repliedBody).slice(0, 500)
                          : ["image", "video", "document", "audio"].includes(repliedType.toLowerCase())
                            ? `[${repliedType}]`
                            : "[Pesan]";
                      insertPayload.reply_to_message_type = repliedType;
                      insertPayload.reply_to_sender =
                        repliedToRow.direction === "outbound" ? "You" : (customerName ?? customerWaId ?? "Contact");
                    } else {
                      insertPayload.reply_to_body = "[Pesan]";
                    }
                  }
                }

                await supabase.from("whatsapp_messages").insert(insertPayload);
                // Sync last_message from actual latest message so preview is always correct
                await supabase.rpc("sync_conversation_last_message", { p_conversation_id: conv.id });

                // Resolve-cycle tracking: first_inbound_at, re-open to Unread (Open), new cycle when Closed or new conv
                const { data: convRow } = await supabase
                  .from("whatsapp_conversations")
                  .select("lead_status_id, first_inbound_at")
                  .eq("id", conv.id)
                  .single();
                const statusId = convRow?.lead_status_id ?? null;
                const firstInboundAt = convRow?.first_inbound_at ?? null;
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

                if (firstInboundAt == null) {
                  await supabase
                    .from("whatsapp_conversations")
                    .update({ first_inbound_at: timestamp, last_inbound_at: timestamp, updated_at: timestamp })
                    .eq("id", conv.id);
                }

                const statusNameLower = leadStatusName?.trim().toLowerCase() ?? "";
                const isResolved = statusNameLower === "closed" || statusNameLower === "resolve";
                const isNewOrReopen = openStatusId && (statusId == null || isResolved);
                console.log("Resolve-cycle:", {
                  conversation_id: conv.id,
                  leadStatusName,
                  isResolved,
                  openStatusId: openStatusId ?? "MISSING",
                  isNewOrReopen,
                });
                if (isNewOrReopen) {
                  const { data: convBefore } = await supabase
                    .from("whatsapp_conversations")
                    .select("organization_id, ticket_id")
                    .eq("id", conv.id)
                    .maybeSingle();
                  const { error: updateErr } = await supabase
                    .from("whatsapp_conversations")
                    .update({ lead_status_id: openStatusId, last_inbound_at: timestamp, updated_at: timestamp })
                    .eq("id", conv.id);
                  if (updateErr) {
                    console.error("Reopen to Open (Unread) update error:", updateErr);
                  } else {
                    console.log("Reopened conversation to Open (Unread):", conv.id, { openStatusId, hadStatus: statusId });
                  }
                  if (convBefore?.organization_id && openStatusId) {
                    const ticketId = (convBefore.ticket_id as string) ?? `WA-${conv.id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
                    const { error: leadErr } = await supabase
                      .from("leads")
                      .update({ status_id: openStatusId, updated_at: timestamp })
                      .eq("organization_id", convBefore.organization_id)
                      .eq("ticket_id", ticketId);
                    if (leadErr) console.error("Reopen: sync leads.status_id to Open failed:", leadErr);
                  }
                  const { error: cycleErr } = await supabase.from("whatsapp_conversation_cycles").insert({
                    conversation_id: conv.id,
                    cycle_started_at: timestamp,
                  });
                  if (cycleErr) console.error("New cycle insert error:", cycleErr);
                } else if (isResolved && !openStatusId) {
                  console.warn("Cannot reopen: lead_statuses has no row with name 'Open' or 'Unread' (org or global). Add Open or Unread status in DB.");
                }
              }
              }
            }
          }
        }
      }


      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  } catch (err) {
    console.error("WhatsApp webhook error:", err);
    return new Response(
      JSON.stringify({ error: "Webhook failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

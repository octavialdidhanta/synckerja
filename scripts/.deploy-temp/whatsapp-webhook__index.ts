import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  ensureWaLeadWebsiteAttribution,
  findMergeableFloatingStubLeadId,
} from "../_shared/omnichannelPublicApi/mergeWaInboundAttribution.ts";
import { resolveWebIdForInboundWhatsApp } from "../_shared/omnichannelPublicApi/resolveWebIdFromWhatsAppAccount.ts";
import { syncOmnichannelWhatsAppDelivery } from "../_shared/omnichannelPublicApi/syncOmnichannelWhatsAppDelivery.ts";
import { extractInboundWhatsAppBody } from "../_shared/omnichannelFlow/sendMessageRuntime.ts";

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

async function invokeAutomationFlowRuntime(payload: {
  organizationId: string;
  conversationId: string;
  messageId: string;
  messageBody: string;
  phoneNumberId: string | null;
  customerWaId: string;
  customerName: string | null;
  isResumeFromWait?: boolean;
  replyId?: string | null;
}): Promise<void> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) return;
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/flow-runtime`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        organization_id: payload.organizationId,
        conversation_id: payload.conversationId,
        message_id: payload.messageId,
        message_body: payload.messageBody,
        phone_number_id: payload.phoneNumberId,
        customer_wa_id: payload.customerWaId,
        customer_name: payload.customerName,
        is_resume_from_wait: payload.isResumeFromWait ?? true,
        reply_id: payload.replyId ?? null,
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("flow-runtime invoke failed:", res.status, errText);
    }
  } catch (err) {
    console.error("flow-runtime invoke error:", err);
  }
}

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

/** Meta outbound status webhook values (sent → delivered → read); failed is terminal. */
function metaDeliveryRank(status: string): number | null {
  const s = status.trim().toLowerCase();
  if (s === "read") return 4;
  if (s === "delivered") return 3;
  if (s === "sent") return 2;
  if (s === "failed") return -1;
  return null;
}

function shouldUpgradeMetaDelivery(current: string | null | undefined, incoming: string): boolean {
  const incRank = metaDeliveryRank(incoming.trim());
  if (incRank === null) return false;
  if (incRank === -1) return true;

  const cur = String(current ?? "").trim();
  if (cur.toLowerCase() === "failed") return false;

  const curRank = metaDeliveryRank(cur);
  if (curRank === null || curRank === -1) return true;
  return incRank >= curRank;
}

function looksLikeMetaSessionExpiredMessage(value: unknown): boolean {
  const msg = String(value ?? "");
  return /re-engagement|24 hours|outside the window|session has expired|outside of allowed window/i.test(msg);
}

function isMetaSessionExpiredErrorFromStatusPayload(st: Record<string, unknown>): boolean {
  const code = st.code != null ? Number(st.code) : NaN;
  const title = st.title != null ? String(st.title) : "";
  const message = st.message != null ? String(st.message) : "";
  if (Number.isFinite(code) && (code === 131047 || code === 131026)) return true;
  return looksLikeMetaSessionExpiredMessage(title) || looksLikeMetaSessionExpiredMessage(message);
}

async function markConversationExpiredFromFailedStatus(args: {
  supabase: ReturnType<typeof createClient>;
  waMessageId: string;
  statusPayload: Record<string, unknown>;
}): Promise<void> {
  const { supabase, waMessageId, statusPayload } = args;

  const errors = statusPayload.errors;
  const firstErr =
    Array.isArray(errors) && errors.length > 0 && errors[0] && typeof errors[0] === "object"
      ? (errors[0] as Record<string, unknown>)
      : null;
  if (!firstErr || !isMetaSessionExpiredErrorFromStatusPayload(firstErr)) return;

  const { data: msgRow } = await supabase
    .from("whatsapp_messages")
    .select("conversation_id")
    .eq("wa_message_id", waMessageId)
    .maybeSingle();
  const conversationId = msgRow?.conversation_id != null ? String(msgRow.conversation_id) : "";
  if (!conversationId) return;

  const { data: conv } = await supabase
    .from("whatsapp_conversations")
    .select("organization_id, lead_status_id")
    .eq("id", conversationId)
    .maybeSingle();
  const orgId = conv?.organization_id != null ? String(conv.organization_id) : "";
  if (!orgId) return;

  // Find Expired status (org-scoped then global)
  let expiredId: string | null = null;
  const { data: orgExpired } = await supabase
    .from("lead_statuses")
    .select("id")
    .eq("organization_id", orgId)
    .eq("name", "Expired")
    .maybeSingle();
  expiredId = (orgExpired?.id as string | undefined) ?? null;
  if (!expiredId) {
    const { data: globalExpired } = await supabase
      .from("lead_statuses")
      .select("id")
      .is("organization_id", null)
      .eq("name", "Expired")
      .maybeSingle();
    expiredId = (globalExpired?.id as string | undefined) ?? null;
  }
  if (!expiredId) return;

  // Avoid overwriting terminal statuses (Converted/Resolve/etc).
  let oldStatusLabel: string | null = null;
  const currentStatusId = conv?.lead_status_id != null ? String(conv.lead_status_id) : "";
  const nowIso = new Date().toISOString();
  if (currentStatusId) {
    const { data: stRow } = await supabase
      .from("lead_statuses")
      .select("name")
      .eq("id", currentStatusId)
      .maybeSingle();
    oldStatusLabel = (stRow?.name as string) ?? null;
    const s = (oldStatusLabel ?? "").trim().toLowerCase();
    if (["closed", "resolve", "lost", "converted", "expired"].includes(s)) {
      // Still lock the composer when Meta says the session is over, even if status is terminal.
      await supabase
        .from("whatsapp_conversations")
        .update({ meta_session_expires_at: nowIso, updated_at: nowIso })
        .eq("id", conversationId);
      return;
    }
  }

  await supabase
    .from("whatsapp_conversations")
    .update({ lead_status_id: expiredId, meta_session_expires_at: nowIso, updated_at: nowIso })
    .eq("id", conversationId);

  await supabase.from("whatsapp_conversation_status_history").insert({
    conversation_id: conversationId,
    old_status: oldStatusLabel,
    new_status: "Expired",
    changed_at: nowIso,
    changed_by: null,
    changed_by_name: "Meta",
    organization_id: orgId,
  });
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
  const sticker = msg.sticker as { id?: string; mime_type?: string } | undefined;
  if (sticker?.id) return { id: sticker.id, type: "sticker", mime: sticker.mime_type };
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

function digitsOnly(s: string | null | undefined): string {
  return String(s ?? "").replace(/\D/g, "");
}

function normalizeClientKey(s: string | null | undefined): string {
  return String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/** Recent LEAD-* rows considered for merge (form submit + first WA message). */
const FORM_LEAD_MERGE_LOOKBACK_MS = 72 * 60 * 60 * 1000;

/**
 * Find a contact-form lead (ticket_id LEAD-…) to merge into this WA thread:
 * 1) same phone as WhatsApp `from`, or
 * 2) same display name as WA profile (`leads.client` vs Meta contact name) when exactly one recent match.
 */
async function findMergeableFormLeadId(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  opts: { customerWaId: string; waProfileClientLabel: string },
): Promise<string | null> {
  const phone = String(opts.customerWaId ?? "").trim();
  if (!phone) return null;

  const since = new Date(Date.now() - FORM_LEAD_MERGE_LOOKBACK_MS).toISOString();
  const { data: rows } = await supabase
    .from("leads")
    .select("id, phone_number, client, created_at")
    .eq("organization_id", orgId)
    .like("ticket_id", "LEAD-%")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(250);

  const list = rows ?? [];

  for (const r of list) {
    if (r.phone_number != null && String(r.phone_number).trim() !== "" && waPhonesMatch(String(r.phone_number), phone)) {
      return r.id;
    }
  }

  // contact-lead may store E.164 on `leads.phone_number` but some pipelines only fill `lead_submissions.phone_number`.
  const { data: submissions } = await supabase
    .from("lead_submissions")
    .select("lead_id, phone_number, status, submitted_at, updated_at")
    .eq("organization_id", orgId)
    .eq("is_active", true)
    .not("lead_id", "is", null)
    .gte("created_at", since)
    .limit(800);

  const checkedProfileLeads = new Set<string>();
  const byLead = new Map<string, { phone_number: string | null; status: string; submitted_at: string | null; updated_at: string }>();
  for (const s of submissions ?? []) {
    const lid = String(s.lead_id ?? "");
    if (!lid) continue;
    const existing = byLead.get(lid);
    const rank = (row: typeof s) =>
      (row.status === "submitted" ? 0 : row.status === "draft" ? 1 : 2) * 1e15 +
      new Date(row.submitted_at ?? 0).getTime() +
      new Date(row.updated_at ?? 0).getTime() / 1000;
    if (!existing || rank(s) >= rank(existing)) {
      byLead.set(lid, s as { phone_number: string | null; status: string; submitted_at: string | null; updated_at: string });
    }
  }
  for (const [lid, p] of byLead) {
    const ph = p.phone_number;
    if (ph == null || String(ph).trim() === "") continue;
    if (!waPhonesMatch(String(ph), phone)) continue;
    if (!lid || checkedProfileLeads.has(lid)) continue;
    checkedProfileLeads.add(lid);
    const { data: leadRow } = await supabase
      .from("leads")
      .select("id, ticket_id")
      .eq("id", lid)
      .eq("organization_id", orgId)
      .maybeSingle();
    const tid = String(leadRow?.ticket_id ?? "");
    if (leadRow?.id && tid.toUpperCase().startsWith("LEAD")) return leadRow.id as string;
  }

  const labelRaw = String(opts.waProfileClientLabel ?? "").trim();
  const label = normalizeClientKey(labelRaw);
  if (label.length < 3) return null;
  if (label === "whatsapp") return null;
  if (/^\d+$/.test(label.replace(/\s/g, ""))) return null;
  if (digitsOnly(labelRaw) === digitsOnly(phone) && digitsOnly(phone).length >= 9) return null;

  const nameMatches = list.filter((r) => {
    const c = normalizeClientKey(r.client ?? "");
    return c.length >= 3 && c === label;
  });
  if (nameMatches.length === 1) return nameMatches[0].id as string;

  // Last resort: in this window, only one form lead has empty phone_number (common for Elementor → WA template flows).
  const noPhoneLeads = list.filter((r) => !r.phone_number || String(r.phone_number).trim() === "");
  if (noPhoneLeads.length === 1) return noPhoneLeads[0].id as string;

  return null;
}

/** Match WhatsApp `from` to `leads.phone_number` (62 / 0 / missing country code). */
function waPhonesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const da = digitsOnly(a);
  const db = digitsOnly(b);
  if (!da || !db) return false;
  if (da === db) return true;
  const tail = (x: string, n: number) => (x.length <= n ? x : x.slice(-n));
  for (const n of [15, 12, 11, 10, 9]) {
    const ta = tail(da, n);
    const tb = tail(db, n);
    if (ta.length >= 9 && ta === tb) return true;
  }
  return false;
}

const WA_TICKET_PREFIX = "WA-";

/**
 * When a website/contact-form lead (ticket_id LEAD-…) already exists for the same number,
 * reuse that row: set ticket_id to WA-… so Leads shows one row with Open Chat + form fields.
 * If an auto-generated WA-only lead already exists, delete it first (frees unique ticket_id).
 */
async function reconcileFormLeadWithWaTicket(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  convId: string,
  customerWaId: string,
  waProfileClientLabel: string,
): Promise<void> {
  const ticketId = WA_TICKET_PREFIX + String(convId).replace(/-/g, "").slice(0, 8).toUpperCase();
  const { data: waTicketLead } = await supabase
    .from("leads")
    .select("id, ticket_id")
    .eq("organization_id", orgId)
    .eq("ticket_id", ticketId)
    .maybeSingle();

  const formLeadId = await findMergeableFormLeadId(supabase, orgId, {
    customerWaId,
    waProfileClientLabel: waProfileClientLabel || customerWaId,
  });
  if (!formLeadId) return;

  if (waTicketLead && waTicketLead.id !== formLeadId) {
    const { error: delErr } = await supabase.from("leads").delete().eq("id", waTicketLead.id);
    if (delErr) {
      console.error("reconcileFormLeadWithWaTicket: delete duplicate WA lead failed", delErr);
      return;
    }
  }

  const now = new Date().toISOString();
  const phone = String(customerWaId).trim();
  const { error: upErr } = await supabase
    .from("leads")
    .update({
      ticket_id: ticketId,
      phone_number: phone || null,
      updated_at: now,
    })
    .eq("id", formLeadId);
  if (upErr) {
    console.error("reconcileFormLeadWithWaTicket: update form lead failed", upErr);
    return;
  }
  console.log("reconcileFormLeadWithWaTicket: merged into form lead", { lead_id: formLeadId, ticket_id: ticketId });
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
  createdByDisplayName: string,
  displayPhoneNumber?: string | null,
  phoneNumberId?: string | null,
): Promise<string | null> {
  const ticketId = WA_TICKET_PREFIX + String(convId).replace(/-/g, "").slice(0, 8).toUpperCase();
  const { data: existing } = await supabase.from("leads").select("id").eq("ticket_id", ticketId).maybeSingle();
  if (existing?.id) return String(existing.id);

  const { data: unreadStatus } = await supabase
    .from("lead_statuses")
    .select("id")
    .eq("name", "Unread")
    .limit(1)
    .maybeSingle();
  const statusId = unreadStatus?.id ?? null;
  if (!statusId) {
    console.warn("ensureLeadForNewConversation: no Unread status in lead_statuses, skip lead insert");
    return null;
  }

  const source = "WhatsApp";
  const safeClient = (client && String(client).trim()) || source;
  const safeTitle = (title && String(title).trim().slice(0, 100)) || source;
  const phoneNumber = source === "WhatsApp" && customerWaId ? String(customerWaId).trim() || null : null;
  const now = new Date().toISOString();
  const webId = await resolveWebIdForInboundWhatsApp({
    admin: supabase,
    organizationId: orgId,
    phoneNumberId,
    displayPhoneNumber,
  });

  if (phoneNumber) {
    const formLeadId = await findMergeableFormLeadId(supabase, orgId, {
      customerWaId: phoneNumber,
      waProfileClientLabel: safeClient,
    });
    if (formLeadId) {
      const { error: mergeErr } = await supabase
        .from("leads")
        .update({
          ticket_id: ticketId,
          phone_number: phoneNumber,
          ...(webId ? { web_id: webId } : {}),
          updated_at: now,
        })
        .eq("id", formLeadId);
      if (mergeErr) {
        console.error("ensureLeadForNewConversation: merge into form lead failed", mergeErr);
      } else {
        console.log("ensureLeadForNewConversation: merged WA ticket into existing form lead", {
          lead_id: formLeadId,
          ticket_id: ticketId,
        });
      }
      return formLeadId;
    }
  }

  if (webId) {
    const floatingStubId = await findMergeableFloatingStubLeadId(supabase, orgId, webId);
    if (floatingStubId) {
      const { error: mergeErr } = await supabase
        .from("leads")
        .update({
          ticket_id: ticketId,
          client: safeClient,
          title: safeTitle,
          source,
          phone_number: phoneNumber,
          ...(webId ? { web_id: webId } : {}),
          updated_at: now,
        })
        .eq("id", floatingStubId);
      if (mergeErr) {
        console.error("ensureLeadForNewConversation: merge into floating stub failed", mergeErr);
      } else {
        console.log("ensureLeadForNewConversation: merged WA ticket into floating stub", {
          lead_id: floatingStubId,
          ticket_id: ticketId,
        });
      }
      return floatingStubId;
    }
  }

  const newLeadId = crypto.randomUUID();
  const { error } = await supabase.from("leads").insert({
    id: newLeadId,
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
    ...(webId ? { web_id: webId } : {}),
  });
  if (error) {
    console.error("ensureLeadForNewConversation: insert error", error);
    return null;
  }
  console.log("ensureLeadForNewConversation: lead created", { ticket_id: ticketId, source });
  return newLeadId;
}

function resolveVialdiWeddingWebIdFromInbound(
  webId: string | null,
): "vialdi-wedding" | null {
  return webId === "vialdi-wedding" ? "vialdi-wedding" : null;
}

async function ensureLeadsVialdiWeddingFromAnalyticsWaClick(args: {
  supabase: ReturnType<typeof createClient>;
  orgId: string;
  convId: string;
  customerWaId: string;
  customerName: string | null;
  displayPhoneNumber: string | null;
  phoneNumberId: string | null;
  timestampIso: string;
}): Promise<void> {
  const {
    supabase,
    orgId,
    convId,
    customerWaId,
    customerName,
    displayPhoneNumber,
    phoneNumberId,
    timestampIso,
  } = args;

  const resolvedWebId = await resolveWebIdForInboundWhatsApp({
    admin: supabase,
    organizationId: orgId,
    phoneNumberId,
    displayPhoneNumber,
  });
  const webId = resolveVialdiWeddingWebIdFromInbound(resolvedWebId);
  if (!webId) return;

  const ticketId = WA_TICKET_PREFIX + String(convId).replace(/-/g, "").slice(0, 8).toUpperCase();

  try {
    const { data: leadRow, error: leadSelErr } = await supabase
      .from("leads")
      .select("id")
      .eq("organization_id", orgId)
      .eq("ticket_id", ticketId)
      .maybeSingle();

    if (leadSelErr) {
      console.warn("ensureLeadsVialdiWeddingFromAnalyticsWaClick: leads select error", leadSelErr);
      return;
    }
    const leadId = leadRow?.id;
    if (!leadId) return;

    await ensureWaLeadWebsiteAttribution({
      supabase,
      orgId,
      leadId: String(leadId),
      ticketId,
      customerWaId,
      displayPhoneNumber,
      phoneNumberId,
      inboundTimestampIso: timestampIso,
    });

    const { data: patchedLead } = await supabase
      .from("leads")
      .select("analytics_session_id, attribution, attribution_label")
      .eq("id", leadId)
      .maybeSingle();

    const safeName = (customerName ?? customerWaId ?? "WhatsApp").toString().trim().slice(0, 200);
    const { error: upsertErr } = await supabase.from("leads_vialdi_wedding").upsert(
      {
        organization_id: orgId,
        lead_id: leadId,
        name: safeName,
        phone_number: customerWaId || null,
        email: null,
        package_label: "WhatsApp",
        event_date: null,
        event_time: null,
        event_address: null,
        step: 1,
        source: "WhatsApp",
        analytics_session_id: patchedLead?.analytics_session_id ?? null,
        attribution: patchedLead?.attribution ?? null,
        attribution_label: patchedLead?.attribution_label ?? null,
      },
      { onConflict: "organization_id,step1_dedupe_key" },
    );

    if (upsertErr) {
      console.warn("ensureLeadsVialdiWeddingFromAnalyticsWaClick: leads_vialdi_wedding upsert error", upsertErr);
    }
  } catch (e) {
    console.warn("ensureLeadsVialdiWeddingFromAnalyticsWaClick: unexpected error", e);
  }
}

/** Inline: Supabase deploy bundle resolves `index.ts` reliably; local `./notifyLivechatSendPush` import can fail to bundle. */
type LivechatPushTable = "whatsapp_messages" | "instagram_messages" | "email_messages";

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

/** Keep only high-signal fields + preserve `errors` from Meta status payloads. */
function pickWhatsappStatusForDebug(st: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of ["id", "status", "timestamp", "recipient_id", "conversation", "pricing", "errors"] as const) {
    if (k in st) out[k] = st[k];
  }
  return out;
}

/** Update inbox row status + merge status history into raw_metadata.whatsapp_webhook */
async function updateWhatsappMessageStatusWithDebug(args: {
  supabase: ReturnType<typeof createClient>;
  waMessageId: string;
  status: string;
  statusTimestampIso: string;
  statusPayload: Record<string, unknown>;
}): Promise<void> {
  const { supabase, waMessageId, status, statusTimestampIso, statusPayload } = args;

  const { data: row } = await supabase
    .from("whatsapp_messages")
    .select("raw_metadata")
    .eq("wa_message_id", waMessageId)
    .maybeSingle();

  const oldMeta =
    row?.raw_metadata && typeof row.raw_metadata === "object" && !Array.isArray(row.raw_metadata)
      ? (row.raw_metadata as Record<string, unknown>)
      : {};

  const oldWebhook =
    oldMeta.whatsapp_webhook && typeof oldMeta.whatsapp_webhook === "object" && !Array.isArray(oldMeta.whatsapp_webhook)
      ? (oldMeta.whatsapp_webhook as Record<string, unknown>)
      : {};

  const nowIso = new Date().toISOString();

  const prevHistoryRaw = oldWebhook.status_history;
  const prevHistory = Array.isArray(prevHistoryRaw) ? prevHistoryRaw : [];
  const nextHistory = [
    ...prevHistory,
    {
      received_at: nowIso,
      status_updated_at: statusTimestampIso,
      status,
      payload: pickWhatsappStatusForDebug(statusPayload),
    },
  ].slice(-20);

  const nextMeta: Record<string, unknown> = {
    ...oldMeta,
    whatsapp_webhook: {
      ...oldWebhook,
      last_status: pickWhatsappStatusForDebug(statusPayload),
      last_status_received_at: nowIso,
      status_history: nextHistory,
    },
  };

  await supabase
    .from("whatsapp_messages")
    .update({
      status,
      status_updated_at: statusTimestampIso,
      raw_metadata: nextMeta,
    })
    .eq("wa_message_id", waMessageId);
}

/** Meta Cloud API: outbound `statuses[]` may include `conversation.expiration_timestamp` (Unix seconds). */
async function persistWhatsappMetaSessionExpiryFromStatusPayload(
  supabase: ReturnType<typeof createClient>,
  st: Record<string, unknown>,
): Promise<void> {
  const conv = st.conversation as { expiration_timestamp?: string | number } | undefined;
  const rawExp = conv?.expiration_timestamp;
  if (rawExp == null) return;
  const expSec = Number(rawExp);
  if (!Number.isFinite(expSec) || expSec <= 0) return;
  const expiresAt = new Date(expSec * 1000).toISOString();

  const waMessageId = st.id != null ? String(st.id).trim() : "";
  if (!waMessageId) return;

  const { data: msg } = await supabase
    .from("whatsapp_messages")
    .select("conversation_id")
    .eq("wa_message_id", waMessageId)
    .maybeSingle();
  const cid = msg?.conversation_id != null ? String(msg.conversation_id) : null;
  if (!cid) return;

  const { data: row } = await supabase
    .from("whatsapp_conversations")
    .select("meta_session_expires_at")
    .eq("id", cid)
    .maybeSingle();

  const prevMs = row?.meta_session_expires_at
    ? new Date(String(row.meta_session_expires_at)).getTime()
    : 0;
  const nextMs = new Date(expiresAt).getTime();
  const maxMs = Math.max(prevMs, nextMs);

  await supabase
    .from("whatsapp_conversations")
    .update({
      meta_session_expires_at: new Date(maxMs).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", cid);
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

              // Status updates (sent | delivered | read | failed): inbox raw_metadata + campaign blast recipients
              for (const st of statuses) {
                const waMessageId = st.id != null ? String(st.id).trim() : "";
                const status = st.status != null ? String(st.status).trim() : "";
                const statusTimestamp = st.timestamp ? new Date(Number(st.timestamp) * 1000).toISOString() : new Date().toISOString();
                if (!waMessageId || !status) continue;

                await updateWhatsappMessageStatusWithDebug({
                  supabase,
                  waMessageId,
                  status,
                  statusTimestampIso: statusTimestamp,
                  statusPayload: st as Record<string, unknown>,
                });

                await syncOmnichannelWhatsAppDelivery(supabase, {
                  waMessageId,
                  metaStatus: status,
                  statusPayload: st as Record<string, unknown>,
                  statusTimestampIso: statusTimestamp,
                });

                await persistWhatsappMetaSessionExpiryFromStatusPayload(supabase, st as Record<string, unknown>);

                // If Meta reports the outbound message failed due to session window expiry, mark the conversation Expired
                // so the composer is disabled and UI stays consistent (without touching Converted/Resolve leads).
                if (status.trim().toLowerCase() === "failed") {
                  await markConversationExpiredFromFailedStatus({
                    supabase,
                    waMessageId,
                    statusPayload: st as Record<string, unknown>,
                  });
                }

                const { data: campRec } = await supabase
                  .from("whatsapp_campaign_recipients")
                  .select("id, wa_delivery_status")
                  .eq("wa_message_id", waMessageId)
                  .maybeSingle();

                if (campRec && typeof campRec === "object" && "id" in campRec) {
                  const row = campRec as { id: string; wa_delivery_status: string | null };
                  if (shouldUpgradeMetaDelivery(row.wa_delivery_status, status)) {
                    await supabase
                      .from("whatsapp_campaign_recipients")
                      .update({ wa_delivery_status: status, wa_delivery_status_at: statusTimestamp })
                      .eq("id", row.id);
                  }
                }
              }

              if (!phoneNumberId || messages.length === 0) {
                if (phoneNumberId && messages.length === 0 && (value.statuses ?? []).length === 0) {
                  console.log("Webhook: phone_number_id=", phoneNumberId, "has no messages and no statuses in this payload, skipping");
                }
                continue;
              }

              // Resolve orgs by phone_number_id from organization_whatsapp_accounts only (no fallback to organization_meta_config).
              type OrgAccount = {
                organization_id: string;
                meta_access_token: string;
                created_by_display_name: string;
                display_phone_number: string | null;
              };
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
                      display_phone_number: r.display_phone_number ?? null,
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
                  let displayNumber =
                    typeof rawDisplayNumber === "number"
                      ? String(rawDisplayNumber)
                      : (typeof rawDisplayNumber === "string" ? rawDisplayNumber.trim() : "");
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
                const extracted = extractInboundWhatsAppBody(msg as Record<string, unknown>);
                let msgType = extracted.messageType || String(msg.type ?? "text");
                let bodyText = extracted.body;
                if (!extracted.replyId) {
                  bodyText = msg.text?.body ?? mediaCaption ?? extracted.body ?? (msgType === "text" ? "" : `[${msgType}]`);
                  if (msgType === "text" && !msg.text?.body && mediaCaption) msgType = String(msg.type ?? "text");
                }
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
                    account.created_by_display_name,
                    account.display_phone_number,
                    phoneNumberId,
                  );
                }

                if (!conv) {
                  continue;
                }

                await reconcileFormLeadWithWaTicket(
                  supabase,
                  orgId,
                  conv.id,
                  customerWaId,
                  customerName ?? customerWaId ?? "",
                );

                await ensureLeadsVialdiWeddingFromAnalyticsWaClick({
                  supabase,
                  orgId,
                  convId: conv.id,
                  customerWaId,
                  customerName: customerName ?? null,
                  displayPhoneNumber: account.display_phone_number,
                  phoneNumberId,
                  timestampIso: timestamp,
                });

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

                if (msgType === "sticker" && mediaUrl) {
                  bodyText = "Sticker";
                  await supabase
                    .from("whatsapp_conversations")
                    .update({ last_message_body: "Sticker", updated_at: timestamp })
                    .eq("id", conv.id);
                }

                const insertPayload: Record<string, unknown> = {
                  conversation_id: conv.id,
                  direction: "inbound",
                  wa_message_id: msgId,
                  platform_message_id: msgId,
                  channel: "whatsapp",
                  body: bodyText,
                  message_type: msgType,
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
                          : ["image", "video", "document", "audio", "sticker"].includes(repliedType.toLowerCase())
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

                const { error: waInsertErr } = await supabase.from("whatsapp_messages").insert(insertPayload);
                if (waInsertErr) {
                  const isDuplicate =
                    (waInsertErr as { code?: string }).code === "23505" ||
                    String(waInsertErr.message ?? "").toLowerCase().includes("duplicate");
                  if (isDuplicate) {
                    console.warn("Duplicate wa_message_id; continuing flow-runtime resume", msgId);
                  } else {
                    console.error("whatsapp_messages insert error (still invoking flow-runtime)", waInsertErr);
                  }
                }
                // Always resume automation flows even when insert fails (Meta retries / duplicate wa_message_id).
                void invokeAutomationFlowRuntime({
                  organizationId: orgId,
                  conversationId: conv.id,
                  messageId: msgId,
                  messageBody: bodyText ?? "",
                  phoneNumberId: phoneNumberId ?? null,
                  customerWaId,
                  customerName: customerName ?? null,
                  isResumeFromWait: true,
                  replyId: extracted.replyId,
                });
                if (waInsertErr) {
                  continue;
                }
                await notifyLivechatInboundPush("whatsapp_messages", insertPayload);
                // Sync last_message from actual latest message so preview is always correct
                await supabase.rpc("sync_conversation_last_message", { p_conversation_id: conv.id });

                // Customer inbound reopens Meta CSW — clear stale lock from prior failed/expired outbound.
                await supabase
                  .from("whatsapp_conversations")
                  .update({
                    meta_session_expires_at: null,
                    last_inbound_at: timestamp,
                    updated_at: timestamp,
                  })
                  .eq("id", conv.id);

                // Template follow-up cycle: customer replied → reset followup, Set Status
                const { data: convTemplateState } = await supabase
                  .from("whatsapp_conversations")
                  .select("template_followup_awaiting_reply, ticket_id")
                  .eq("id", conv.id)
                  .maybeSingle();
                if (convTemplateState?.template_followup_awaiting_reply === true) {
                  let linkedLeadId: string | null = null;
                  const convTicket = (convTemplateState.ticket_id as string | null)?.trim() ?? "";
                  if (convTicket) {
                    const { data: leadByTicket } = await supabase
                      .from("leads")
                      .select("id")
                      .eq("organization_id", orgId)
                      .eq("ticket_id", convTicket)
                      .maybeSingle();
                    linkedLeadId = (leadByTicket?.id as string | undefined) ?? null;
                  }
                  const { error: resetErr } = await supabase.rpc("apply_template_followup_customer_reply", {
                    p_lead_id: linkedLeadId,
                    p_conv_id: conv.id,
                  });
                  if (resetErr) {
                    console.error("apply_template_followup_customer_reply error:", resetErr);
                  }
                }

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
                const isExpired = statusNameLower === "expired";
                const isNewOrReopen = openStatusId && (statusId == null || isResolved || isExpired);
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

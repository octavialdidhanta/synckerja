/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

/** Resend uses Svix for webhook signing. Verify svix-signature using RESEND_WEBHOOK_SECRET (Signing Secret from Resend). */
const WEBHOOK_SECRET_ENV = "RESEND_WEBHOOK_SECRET";
const TIMESTAMP_TOLERANCE_SEC = 300; // 5 minutes

function getHeader(req: Request, name: string): string | null {
  const v = req.headers.get(name);
  return v != null && v.trim() !== "" ? v.trim() : null;
}

/** Base64 encode ArrayBuffer (for HMAC-SHA256 result). */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/** Constant-time string comparison to prevent timing attacks. */
function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

/**
 * Verify Resend/Svix webhook signature.
 * Secret: Signing Secret from Resend (e.g. whsec_xxx). Key for HMAC is base64-decoded part after whsec_.
 */
async function verifyResendWebhook(
  rawBody: string,
  svixId: string | null,
  svixTimestamp: string | null,
  svixSignature: string | null,
  secret: string
): Promise<boolean> {
  if (!svixId || !svixTimestamp || !svixSignature) return false;
  const timestamp = parseInt(svixTimestamp, 10);
  if (isNaN(timestamp)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > TIMESTAMP_TOLERANCE_SEC) return false;

  const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;
  const secretB64 = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  const secretBytes = Uint8Array.from(atob(secretB64), (c) => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(signedContent)
  );
  const expectedSig = arrayBufferToBase64(sigBuffer);

  const parts = svixSignature.split(" ");
  for (const part of parts) {
    const comma = part.indexOf(",");
    const sig = comma >= 0 ? part.slice(comma + 1) : part;
    if (secureCompare(sig, expectedSig)) return true;
  }
  return false;
}

/** Resend email.received webhook payload – body often empty; use email_id + Resend API to get full content. */
interface ResendEmailReceivedPayload {
  type?: string;
  created_at?: string;
  data?: {
    email_id?: string;
    created_at?: string;
    from?: string;
    to?: string[];
    subject?: string;
    text?: string;
    html?: string;
  };
}

const RESEND_API_KEY_ENV = "RESEND_API_KEY";
const RESEND_RECEIVING_API = "https://api.resend.com/emails/receiving";

/** Fetch full email content (html/text) from Resend Receiving API so links and body are available. */
async function fetchReceivedEmailContent(emailId: string): Promise<{ html?: string; text?: string } | null> {
  const apiKey = Deno.env.get(RESEND_API_KEY_ENV);
  if (!apiKey?.trim()) return null;
  try {
    const res = await fetch(`${RESEND_RECEIVING_API}/${encodeURIComponent(emailId)}`, {
      headers: { Authorization: `Bearer ${apiKey.trim()}` },
    });
    if (!res.ok) {
      console.error("email-inbound: Resend receiving API", res.status, await res.text());
      return null;
    }
    const data = (await res.json()) as { html?: string; text?: string };
    return { html: data?.html, text: data?.text };
  } catch (e) {
    console.error("email-inbound: fetch received email failed", e);
    return null;
  }
}

/** Extract Gmail confirmation code from text (e.g. "Kode konfirmasi: 106074202" or "Confirmation code: 106074202"). */
function extractConfirmationCode(text: string | null | undefined): string | null {
  if (!text || typeof text !== "string") return null;
  const normalized = text.trim();
  // Match "Kode konfirmasi: 106074202" or "Confirmation code: 106074202" or "106074202" (6-10 digits)
  const withLabel = /(?:kode\s+konfirmasi|confirmation\s+code)\s*[:\s]+\s*(\d{6,10})/i.exec(normalized);
  if (withLabel) return withLabel[1];
  const digitsOnly = /\b(\d{6,10})\b/.exec(normalized);
  return digitsOnly ? digitsOnly[1] : null;
}

/** Parse "Name <email@domain.com>" to email. */
function parseFromEmail(from: string | undefined): string | null {
  if (!from || typeof from !== "string") return null;
  const match = /<([^>]+)>/.exec(from.trim());
  if (match) return match[1].trim().toLowerCase();
  return from.trim().toLowerCase();
}

/** Parse "Display Name <email@domain.com>" to display name (or null if plain email). */
function parseFromDisplayName(from: string | undefined): string | null {
  if (!from || typeof from !== "string") return null;
  const trimmed = from.trim();
  const match = /^([^<]+)<([^>]+)>$/.exec(trimmed);
  if (!match) return null;
  const name = match[1].trim();
  if (!name || name.includes("@")) return null;
  return name;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: { ...corsHeaders, "Content-Length": "2" } });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    console.log("email-inbound: POST received");
    const rawBody = await req.text();
    const webhookSecret = Deno.env.get(WEBHOOK_SECRET_ENV);
    if (webhookSecret) {
      const svixId = getHeader(req, "svix-id");
      const svixTimestamp = getHeader(req, "svix-timestamp");
      const svixSignature = getHeader(req, "svix-signature");
      const valid = await verifyResendWebhook(
        rawBody,
        svixId,
        svixTimestamp,
        svixSignature,
        webhookSecret
      );
      if (!valid) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("email-inbound: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set");
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let body: ResendEmailReceivedPayload;
    try {
      body = JSON.parse(rawBody) as ResendEmailReceivedPayload;
    } catch {
      return new Response(JSON.stringify({ received: false, reason: "invalid payload" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (body?.type !== "email.received" || !body?.data?.to?.length) {
      console.log("email-inbound: skipped, type or to missing", body?.type, body?.data?.to);
      return new Response(JSON.stringify({ received: false, reason: "invalid payload" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const toAddresses = body.data.to as string[];
    console.log("email-inbound: processing to", toAddresses);
    const fromRaw = body.data.from ?? "";
    const fromEmail = parseFromEmail(fromRaw);
    const fromDisplayName = parseFromDisplayName(fromRaw);
    const fromEmailNormalized = (fromEmail ?? fromRaw).trim().toLowerCase();
    const subject = body.data.subject ?? "";
    let textBody = (body.data.text ?? body.data.html ?? "").trim();
    if (body.data.email_id && (!textBody || textBody.length < 100)) {
      const full = await fetchReceivedEmailContent(body.data.email_id);
      if (full?.html || full?.text) {
        textBody = (full.html ?? full.text ?? "").trim();
      }
    }
    const confirmationCode = extractConfirmationCode(textBody) || extractConfirmationCode(subject);

    for (const to of toAddresses) {
      const toNormalized = (typeof to === "string" ? to : "").trim().toLowerCase();
      if (!toNormalized) continue;

      const { data: conn, error: connError } = await supabase
        .from("organization_email_connections")
        .select("id, organization_id")
        .eq("inbound_address", toNormalized)
        .maybeSingle();

      if (connError || !conn) {
        if (connError) console.error("email-inbound: connection lookup error", connError);
        else console.log("email-inbound: no connection for inbound_address", toNormalized, "- add this address in Connect Email");
        continue;
      }

      // One room per sender: find or create conversation by (connection, from_email)
      let conversationId: string;
      const { data: existingConv } = await supabase
        .from("email_conversations")
        .select("id")
        .eq("email_connection_id", conn.id)
        .eq("from_email", fromEmailNormalized)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingConv?.id) {
        conversationId = existingConv.id;
      } else {
        const nowIso = new Date().toISOString();
        const { data: newConv, error: insertConvError } = await supabase
          .from("email_conversations")
          .insert({
            organization_id: conn.organization_id,
            email_connection_id: conn.id,
            from_email: fromEmailNormalized,
            from_display_name: fromDisplayName || null,
            thread_subject: subject || null,
            last_message_at: nowIso,
            last_inbound_at: nowIso,
          })
          .select("id")
          .single();
        if (insertConvError || !newConv?.id) {
          console.error("email-inbound: insert conversation failed", insertConvError);
          continue;
        }
        conversationId = newConv.id;
      }

      const { error: msgError } = await supabase.from("email_messages").insert({
        conversation_id: conversationId,
        direction: "inbound",
        from_email: fromEmail ?? fromRaw,
        from_display_name: fromDisplayName || null,
        to_email: toNormalized,
        subject: subject || null,
        body: textBody || null,
        confirmation_code: confirmationCode,
      });

      if (msgError) {
        console.error("email-inbound: insert message failed", msgError);
        continue;
      }

      const nowIso = new Date().toISOString();
      await supabase
        .from("email_conversations")
        .update({
          last_message_at: nowIso,
          last_inbound_at: nowIso,
          updated_at: nowIso,
          thread_subject: subject || null,
          from_display_name: fromDisplayName || undefined,
        })
        .eq("id", conversationId);

      // Reopen to Unread (Open) when customer sends new email and status was Closed (same as whatsapp-webhook)
      const { data: convRow } = await supabase
        .from("email_conversations")
        .select("lead_status_id")
        .eq("id", conversationId)
        .maybeSingle();
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
      const statusNameLower = leadStatusName?.trim().toLowerCase() ?? "";
      const isResolved = statusNameLower === "closed" || statusNameLower === "resolve";
      if (isResolved) {
        const { data: openStatus } = await supabase
          .from("lead_statuses")
          .select("id")
          .eq("name", "Open")
          .maybeSingle();
        const { data: unreadStatus } = openStatus?.id
          ? { data: null }
          : await supabase.from("lead_statuses").select("id").eq("name", "Unread").maybeSingle();
        const openStatusId = openStatus?.id ?? unreadStatus?.id ?? null;
        if (openStatusId) {
          const nowIso = new Date().toISOString();
          await supabase
            .from("email_conversations")
            .update({ lead_status_id: openStatusId, last_inbound_at: nowIso, updated_at: nowIso })
            .eq("id", conversationId);
          const ticketId = `EMAIL-${conversationId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
          const { data: convOrg } = await supabase
            .from("email_conversations")
            .select("organization_id")
            .eq("id", conversationId)
            .maybeSingle();
          if (convOrg?.organization_id) {
            const { error: leadErr } = await supabase
              .from("leads")
              .update({ status_id: openStatusId, updated_at: nowIso })
              .eq("organization_id", convOrg.organization_id)
              .eq("ticket_id", ticketId);
            if (leadErr) console.error("email-inbound: reopen sync leads.status_id to Open failed:", leadErr);
          }
        }
      }

      if (confirmationCode) {
        await supabase
          .from("organization_email_connections")
          .update({
            confirmation_code: confirmationCode,
            status: "verified",
            updated_at: new Date().toISOString(),
          })
          .eq("id", conn.id);
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("email-inbound error", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fetchImapMessages, fetchImapMessagesByMessageIds } from "../_shared/denoImapClient.ts";
import { decryptEmailConnectionPassword } from "../_shared/emailConnectionCrypto.ts";
import { persistInboundEmail } from "../_shared/emailInboundPersist.ts";
import { parseRawEmail, parsedEmailBody } from "../_shared/simpleEmailParse.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-email-imap-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const INITIAL_UID_LOOKBACK = 50;

type EmailConnectionRow = {
  id: string;
  organization_id: string;
  email_address: string;
  inbound_address: string;
  imap_host: string | null;
  imap_port: number | null;
  imap_last_uid: number | null;
  provider: string | null;
};

function normalizeImapPassword(password: string, provider: string | null | undefined): string {
  if ((provider ?? "").toLowerCase().includes("gmail")) {
    return password.replace(/\s+/g, "");
  }
  return password.trim();
}

function isAuthorized(req: Request, serviceRoleKey: string): boolean {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (authHeader === `Bearer ${serviceRoleKey}`) return true;
  const cronSecret = Deno.env.get("EMAIL_IMAP_CRON_SECRET")?.trim();
  const headerSecret = req.headers.get("x-email-imap-cron-secret")?.trim();
  return Boolean(cronSecret && headerSecret && cronSecret === headerSecret);
}

function bodyLooksLikeHtml(body: string): boolean {
  const trimmed = body.trim();
  return /<!DOCTYPE html/i.test(trimmed) || /<html[\s>]/i.test(trimmed);
}

async function listPlainTextMessageIds(
  supabase: ReturnType<typeof createClient>,
  connectionId: string,
): Promise<string[]> {
  const { data: conversations } = await supabase
    .from("email_conversations")
    .select("id")
    .eq("email_connection_id", connectionId);
  const conversationIds = (conversations ?? []).map((row) => row.id as string);
  if (conversationIds.length === 0) return [];

  const { data: rows } = await supabase
    .from("email_messages")
    .select("external_message_id, body")
    .in("conversation_id", conversationIds)
    .eq("direction", "inbound")
    .not("external_message_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(100);

  return (rows ?? [])
    .filter((row) => {
      const body = (row.body ?? "").trim();
      return body.length > 0 && !bodyLooksLikeHtml(body);
    })
    .map((row) => (row.external_message_id as string).trim())
    .filter(Boolean)
    .slice(0, 25);
}

async function processImapMessageBatch(
  supabase: ReturnType<typeof createClient>,
  conn: EmailConnectionRow,
  mailboxEmail: string,
  messages: Awaited<ReturnType<typeof fetchImapMessages>>["messages"],
): Promise<number> {
  let processed = 0;
  for (const msg of messages) {
    const parsed = parseRawEmail(msg.raw);
    const fromRaw = parsed.from.trim();
    const fromEmail = fromRaw.match(/<([^>]+)>/)?.[1]?.toLowerCase() ??
      fromRaw.toLowerCase();
    if (fromEmail === mailboxEmail) continue;

    const textBody = parsedEmailBody(parsed);
    const subject = parsed.subject;
    const externalMessageId = parsed.messageId || `imap:uid:${msg.uid}`;

    const result = await persistInboundEmail(supabase, {
      organizationId: conn.organization_id,
      connectionId: conn.id,
      fromRaw: fromRaw || fromEmail,
      toEmail: conn.email_address,
      subject,
      textBody,
      externalMessageId,
      markConnectionVerified: false,
    });
    if (result.ok && result.skipped !== "duplicate") processed += 1;
  }
  return processed;
}

async function syncConnection(
  supabase: ReturnType<typeof createClient>,
  conn: EmailConnectionRow,
  password: string,
): Promise<{ processed: number; maxUid: number | null; error?: string }> {
  const imapHost = conn.imap_host?.trim() || "imap.hostinger.com";
  const imapPort = conn.imap_port && conn.imap_port > 0 ? conn.imap_port : 993;
  const mailboxEmail = conn.email_address.trim().toLowerCase();

  try {
    const { messages, maxUid } = await fetchImapMessages(
      {
        host: imapHost,
        port: imapPort,
        user: conn.email_address,
        pass: password,
        provider: conn.provider,
      },
      conn.imap_last_uid,
      INITIAL_UID_LOOKBACK,
    );

    const imapConfig = {
      host: imapHost,
      port: imapPort,
      user: conn.email_address,
      pass: password,
      provider: conn.provider,
    };

    const plainMessageIds = await listPlainTextMessageIds(supabase, conn.id);
    const upgradeMessages = plainMessageIds.length > 0
      ? await fetchImapMessagesByMessageIds(imapConfig, plainMessageIds)
      : [];

    const seenUids = new Set(messages.map((m) => m.uid));
    const mergedMessages = [
      ...messages,
      ...upgradeMessages.filter((m) => !seenUids.has(m.uid)),
    ];

    const processed = await processImapMessageBatch(
      supabase,
      conn,
      mailboxEmail,
      mergedMessages,
    );

    return { processed, maxUid: maxUid ?? conn.imap_last_uid };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("email-imap-sync: connection failed", conn.id, message);
    return { processed: 0, maxUid: conn.imap_last_uid, error: message };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!isAuthorized(req, serviceRoleKey)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!Deno.env.get("EMAIL_CONNECTION_ENCRYPTION_KEY")?.trim()) {
      return new Response(JSON.stringify({ error: "EMAIL_CONNECTION_ENCRYPTION_KEY not configured" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({})) as { connection_id?: string };
    const connectionIdFilter = body.connection_id?.trim() || null;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let query = supabase
      .from("organization_email_connections")
      .select("id, organization_id, email_address, inbound_address, imap_host, imap_port, imap_last_uid, provider")
      .eq("connection_method", "imap")
      .eq("status", "verified");

    if (connectionIdFilter) query = query.eq("id", connectionIdFilter);

    const { data: connections, error: connError } = await query;
    if (connError) {
      console.error("email-imap-sync: list connections failed", connError);
      return new Response(JSON.stringify({ error: connError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rows = (connections ?? []) as EmailConnectionRow[];
    const summary: Array<{ connection_id: string; processed: number; error?: string }> = [];

    for (const conn of rows) {
      const { data: secretRow, error: secretErr } = await supabase
        .from("organization_email_connection_secrets")
        .select("password_enc")
        .eq("connection_id", conn.id)
        .maybeSingle();
      if (secretErr || !secretRow?.password_enc) {
        summary.push({ connection_id: conn.id, processed: 0, error: "missing_credentials" });
        await supabase
          .from("organization_email_connections")
          .update({
            imap_sync_error: "missing_credentials",
            updated_at: new Date().toISOString(),
          })
          .eq("id", conn.id);
        continue;
      }

      let password: string;
      try {
        password = await decryptEmailConnectionPassword(secretRow.password_enc);
      } catch {
        summary.push({ connection_id: conn.id, processed: 0, error: "decrypt_failed" });
        continue;
      }

      const result = await syncConnection(
        supabase,
        conn,
        normalizeImapPassword(password, conn.provider),
      );
      summary.push({
        connection_id: conn.id,
        processed: result.processed,
        error: result.error,
      });

      await supabase
        .from("organization_email_connections")
        .update({
          imap_last_uid: result.maxUid ?? conn.imap_last_uid,
          imap_last_sync_at: new Date().toISOString(),
          imap_sync_error: result.error ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", conn.id);
    }

    return new Response(JSON.stringify({ ok: true, synced: summary.length, summary }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("email-imap-sync error", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  if (!supabaseUrl || !serviceRoleKey) return;

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
      console.error("emailInboundPersist: livechat-send-push HTTP error", res.status, t.slice(0, 800));
    }
  } catch (e) {
    console.error("emailInboundPersist: livechat-send-push fetch failed", e);
  }
}

export function parseFromEmail(from: string | undefined): string | null {
  if (!from || typeof from !== "string") return null;
  const match = /<([^>]+)>/.exec(from.trim());
  if (match) return match[1].trim().toLowerCase();
  return from.trim().toLowerCase();
}

export function parseFromDisplayName(from: string | undefined): string | null {
  if (!from || typeof from !== "string") return null;
  const trimmed = from.trim();
  const match = /^([^<]+)<([^>]+)>$/.exec(trimmed);
  if (!match) return null;
  const name = match[1].trim();
  if (!name || name.includes("@")) return null;
  return name;
}

export function extractConfirmationCode(text: string | null | undefined): string | null {
  if (!text || typeof text !== "string") return null;
  const normalized = text.replace(/\s+/g, " ").trim();
  const patterns = [
    /(?:kode\s+konfirmasi|confirmation\s+code)\s*[:\s]+(\d{6,8})\b/i,
    /(?:paste in gmail|gmail forwarding|forwarding and pop\/imap|penerusan dan pop\/imap)[\s\S]{0,160}?(\d{6,8})\b/i,
    /(?:menunggu konfirmasi|waiting for confirmation)[\s\S]{0,160}?(\d{6,8})\b/i,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(normalized);
    if (match?.[1]) return match[1];
  }
  return null;
}

export type PersistInboundEmailParams = {
  organizationId: string;
  connectionId: string;
  fromRaw: string;
  toEmail: string;
  subject: string;
  textBody: string;
  externalMessageId?: string | null;
  markConnectionVerified?: boolean;
};

export async function persistInboundEmail(
  supabase: SupabaseClient,
  params: PersistInboundEmailParams,
): Promise<{ ok: boolean; skipped?: string; conversationId?: string }> {
  const fromEmail = parseFromEmail(params.fromRaw);
  const fromDisplayName = parseFromDisplayName(params.fromRaw);
  const fromEmailNormalized = (fromEmail ?? params.fromRaw).trim().toLowerCase();
  const subject = params.subject ?? "";
  const textBody = (params.textBody ?? "").trim();
  const confirmationCode = extractConfirmationCode(textBody) || extractConfirmationCode(subject);
  const toNormalized = params.toEmail.trim().toLowerCase();
  const externalMessageId = params.externalMessageId?.trim() || null;

  let conversationId: string;
  const { data: existingConv } = await supabase
    .from("email_conversations")
    .select("id")
    .eq("email_connection_id", params.connectionId)
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
        organization_id: params.organizationId,
        email_connection_id: params.connectionId,
        from_email: fromEmailNormalized,
        from_display_name: fromDisplayName || null,
        thread_subject: subject || null,
        last_message_at: nowIso,
        last_inbound_at: nowIso,
      })
      .select("id")
      .single();
    if (insertConvError || !newConv?.id) {
      console.error("emailInboundPersist: insert conversation failed", insertConvError);
      return { ok: false, skipped: "conversation_insert_failed" };
    }
    conversationId = newConv.id;
    const { error: newEmailCycleErr } = await supabase.from("email_conversation_cycles").insert({
      conversation_id: conversationId,
      cycle_started_at: nowIso,
    });
    if (newEmailCycleErr) console.error("emailInboundPersist: new conversation cycle insert failed", newEmailCycleErr);
  }

  if (externalMessageId) {
    const { data: dup } = await supabase
      .from("email_messages")
      .select("id, body")
      .eq("conversation_id", conversationId)
      .eq("external_message_id", externalMessageId)
      .maybeSingle();
    if (dup?.id) {
      const existingBody = (dup.body ?? "").trim();
      const incomingBody = textBody.trim();
      const existingHasHtml = /<!DOCTYPE html/i.test(existingBody) || /<html[\s>]/i.test(existingBody);
      const incomingHasHtml = /<!DOCTYPE html/i.test(incomingBody) || /<html[\s>]/i.test(incomingBody);
      const existingIsRichHtml = existingHasHtml && existingBody.length > 800;
      const incomingIsRichHtml = incomingHasHtml && incomingBody.length > 800;
      const shouldUpgrade =
        (!existingHasHtml && incomingHasHtml && incomingBody.length > 200) ||
        (!existingIsRichHtml && incomingIsRichHtml) ||
        (incomingIsRichHtml && incomingBody.length > existingBody.length * 1.1) ||
        (!existingHasHtml && incomingHasHtml && incomingBody.length > existingBody.length * 1.5);
      if (shouldUpgrade) {
        await supabase.from("email_messages").update({ body: incomingBody }).eq("id", dup.id);
      }
      return { ok: true, skipped: "duplicate", conversationId };
    }
  }

  const emailInsertPayload = {
    conversation_id: conversationId,
    direction: "inbound" as const,
    from_email: fromEmail ?? params.fromRaw,
    from_display_name: fromDisplayName || null,
    to_email: toNormalized,
    subject: subject || null,
    body: textBody || null,
    confirmation_code: confirmationCode,
    external_message_id: externalMessageId,
  };
  const { error: msgError } = await supabase.from("email_messages").insert(emailInsertPayload);

  if (msgError) {
    if (msgError.code === "23505") return { ok: true, skipped: "duplicate", conversationId };
    console.error("emailInboundPersist: insert message failed", msgError);
    return { ok: false, skipped: "message_insert_failed" };
  }

  await notifyLivechatInboundPush("email_messages", emailInsertPayload as Record<string, unknown>);

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
    const orgId = params.organizationId;
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
    if (openStatusId) {
      await supabase
        .from("email_conversations")
        .update({ lead_status_id: openStatusId, last_inbound_at: nowIso, updated_at: nowIso })
        .eq("id", conversationId);
      const ticketId = `EMAIL-${conversationId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
      const { error: leadErr } = await supabase
        .from("leads")
        .update({ status_id: openStatusId, updated_at: nowIso })
        .eq("organization_id", orgId)
        .eq("ticket_id", ticketId);
      if (leadErr) console.error("emailInboundPersist: reopen sync leads failed:", leadErr);
      const { error: reopenCycleErr } = await supabase.from("email_conversation_cycles").insert({
        conversation_id: conversationId,
        cycle_started_at: nowIso,
      });
      if (reopenCycleErr) console.error("emailInboundPersist: reopen cycle insert failed", reopenCycleErr);
    }
  }

  if (params.markConnectionVerified !== false) {
    if (confirmationCode) {
      await supabase
        .from("organization_email_connections")
        .update({
          confirmation_code: confirmationCode,
          status: "verified",
          updated_at: new Date().toISOString(),
        })
        .eq("id", params.connectionId);
    }
  }

  return { ok: true, conversationId };
}

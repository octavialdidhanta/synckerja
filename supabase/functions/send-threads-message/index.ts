/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { replyThreadsComment, resolveThreadsPostMediaIdForReply } from "../_shared/threadsContentApi.ts";
import { getThreadsAccessToken } from "../_shared/threadsContentAuth.ts";
import {
  isUnreadLeadStatusName,
  resolveInProgressLeadStatusId,
  resolveInProgressLeadStatusDebug,
} from "../_shared/omnichannelLeadStatusResolve.ts";
import {
  assertSenderIsActiveAssignee,
  jsonGateError,
  resolveEmployeeForOmnichannelSend,
} from "../send-instagram-message/omnichannelAssigneeGate.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

async function markThreadsConversationExpiredReactive(
  supabase: ReturnType<typeof createClient>,
  conversationId: string,
  orgId: string,
): Promise<void> {
  const { data: conv } = await supabase
    .from("threads_conversations")
    .select("lead_status_id")
    .eq("id", conversationId)
    .maybeSingle();

  let expiredId: string | null = null;
  const { data: orgExpired } = await supabase
    .from("lead_statuses")
    .select("id")
    .eq("organization_id", orgId)
    .eq("name", "Expired")
    .maybeSingle();
  expiredId = (orgExpired?.id as string | undefined) ?? null;
  if (!expiredId) {
    const { data: g } = await supabase
      .from("lead_statuses")
      .select("id")
      .is("organization_id", null)
      .eq("name", "Expired")
      .maybeSingle();
    expiredId = (g?.id as string | undefined) ?? null;
  }
  if (!expiredId) return;

  let statusName = "";
  if (conv?.lead_status_id) {
    const { data: stRow } = await supabase
      .from("lead_statuses")
      .select("name")
      .eq("id", conv.lead_status_id as string)
      .maybeSingle();
    statusName = ((stRow?.name as string) ?? "").trim().toLowerCase();
  }
  if (["closed", "resolve", "lost", "converted", "expired"].includes(statusName)) return;

  const nowIso = new Date().toISOString();
  await supabase
    .from("threads_conversations")
    .update({ lead_status_id: expiredId, meta_session_expires_at: nowIso, updated_at: nowIso })
    .eq("id", conversationId);
}

async function applyThreadsUnreadToInProgressOnReply(
  supabase: ReturnType<typeof createClient>,
  conversationId: string,
  now: string,
): Promise<string | null> {
  const { data: convBefore } = await supabase
    .from("threads_conversations")
    .select("lead_status_id, organization_id, ticket_id")
    .eq("id", conversationId)
    .maybeSingle();

  const convOrgId = (convBefore?.organization_id as string | undefined) ?? null;
  let statusNameBefore: string | null = null;
  const statusIdBefore = convBefore?.lead_status_id ?? null;
  if (statusIdBefore) {
    const { data: st } = await supabase.from("lead_statuses").select("name").eq("id", statusIdBefore).maybeSingle();
    statusNameBefore = (st?.name as string) ?? null;
  }
  if (!isUnreadLeadStatusName(statusNameBefore)) return null;

  const inProgressId = await resolveInProgressLeadStatusId(supabase, convOrgId);
  if (!inProgressId) {
    const debug = await resolveInProgressLeadStatusDebug(supabase, convOrgId);
    console.warn("send-threads-message: no In Progress lead_status", { convOrgId, names: debug.names });
    return null;
  }

  await supabase
    .from("threads_conversations")
    .update({ lead_status_id: inProgressId, updated_at: now })
    .eq("id", conversationId);

  const ticketId =
    (convBefore?.ticket_id as string) ?? `TH-${conversationId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
  if (convOrgId) {
    await supabase
      .from("leads")
      .update({ status_id: inProgressId, updated_at: now })
      .eq("organization_id", convOrgId)
      .eq("ticket_id", ticketId);
  }

  const { data: currentCycle } = await supabase
    .from("threads_conversation_cycles")
    .select("id")
    .eq("conversation_id", conversationId)
    .is("resolved_at", null)
    .order("cycle_started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (currentCycle?.id) {
    await supabase
      .from("threads_conversation_cycles")
      .update({ first_response_at: now, updated_at: now })
      .eq("id", currentCycle.id);
  }
  return inProgressId;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const text = body.text != null ? String(body.text).trim().slice(0, 1000) : "";
    const conversationId = body.conversation_id != null ? String(body.conversation_id).trim() : null;
    const replyToPlatformId = body.reply_to_wa_message_id != null
      ? String(body.reply_to_wa_message_id).trim()
      : body.reply_to_platform_message_id != null
      ? String(body.reply_to_platform_message_id).trim()
      : null;

    if (!text) {
      return new Response(
        JSON.stringify({ error: "Pesan tidak boleh kosong.", code: "MISSING_CONTENT" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!conversationId) {
      return new Response(
        JSON.stringify({ error: "conversation_id wajib untuk Threads.", code: "MISSING_CONVERSATION" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: conv } = await supabase
      .from("threads_conversations")
      .select("organization_id, threads_user_id, root_media_id, lead_status_id, meta_session_expires_at, assignee_id")
      .eq("id", conversationId)
      .maybeSingle();

    if (!conv?.organization_id || !conv?.threads_user_id || !conv?.root_media_id) {
      return new Response(
        JSON.stringify({ error: "Percakapan tidak valid.", code: "INVALID_CONVERSATION" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (conv.assignee_id == null || String(conv.assignee_id).trim() === "") {
      return new Response(
        JSON.stringify({ error: "Tetapkan agen sebelum mengirim pesan.", code: "ASSIGNEE_REQUIRED" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const senderRes = await resolveEmployeeForOmnichannelSend(
      supabase,
      user.id,
      conv.organization_id as string,
    );
    if (!senderRes.ok) return jsonGateError(senderRes, corsHeaders);
    const assigneeMismatch = assertSenderIsActiveAssignee(conv.assignee_id, senderRes.employeeId);
    if (assigneeMismatch) return jsonGateError(assigneeMismatch, corsHeaders);

    const leadStatusId = conv.lead_status_id ?? null;
    if (leadStatusId) {
      const { data: statusRow } = await supabase.from("lead_statuses").select("name").eq("id", leadStatusId).maybeSingle();
      const statusName = ((statusRow?.name as string) ?? "").trim().toLowerCase();
      if (statusName === "closed" || statusName === "resolve") {
        return new Response(
          JSON.stringify({ error: "Chat sudah di-resolve.", code: "CONVERSATION_RESOLVED" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (statusName === "expired") {
        return new Response(
          JSON.stringify({ error: "Sesi Meta sudah berakhir.", code: "CONVERSATION_EXPIRED" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const metaExp = conv.meta_session_expires_at;
    if (metaExp != null && String(metaExp).trim() !== "") {
      const expMs = new Date(String(metaExp)).getTime();
      if (!Number.isNaN(expMs) && Date.now() > expMs) {
        return new Response(
          JSON.stringify({ error: "Sesi Meta sudah berakhir.", code: "CONVERSATION_EXPIRED" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const threadsUserId = String(conv.threads_user_id).trim();
    const accessToken = await getThreadsAccessToken(
      supabase,
      conv.organization_id as string,
      threadsUserId,
    );
    if (!accessToken) {
      return new Response(
        JSON.stringify({
          error: "Token Threads tidak ditemukan. Connect ulang di integrasi Threads.",
          code: "MISSING_THREADS_TOKEN",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const rootMediaId = await resolveThreadsPostMediaIdForReply(
      supabase,
      conversationId,
      String(conv.root_media_id).trim(),
      accessToken,
      replyToPlatformId,
    );
    let apiResult: { id: string };
    try {
      apiResult = await replyThreadsComment(rootMediaId, text, accessToken, replyToPlatformId ?? undefined);
    } catch (apiErr) {
      const rawMsg = apiErr instanceof Error ? apiErr.message : "Threads API error";
      const maybeWrongMedia = /does not exist|unsupported post|cannot be loaded/i.test(rawMsg);
      if (maybeWrongMedia && replyToPlatformId) {
        try {
          const recovered = await resolveThreadsPostMediaIdForReply(
            supabase,
            conversationId,
            replyToPlatformId,
            accessToken,
            replyToPlatformId,
          );
          apiResult = await replyThreadsComment(recovered, text, accessToken, replyToPlatformId);
        } catch (retryErr) {
          const retryMsg = retryErr instanceof Error ? retryErr.message : rawMsg;
          const sessionMaybe = /24 hours|window|session|expired|permission/i.test(retryMsg);
          if (sessionMaybe) {
            await markThreadsConversationExpiredReactive(supabase, conversationId, conv.organization_id as string);
          }
          return new Response(
            JSON.stringify({ error: retryMsg, code: "THREADS_API_ERROR" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      } else {
        const sessionMaybe = /24 hours|window|session|expired|permission/i.test(rawMsg);
        if (sessionMaybe) {
          await markThreadsConversationExpiredReactive(supabase, conversationId, conv.organization_id as string);
        }
        return new Response(
          JSON.stringify({ error: rawMsg, code: "THREADS_API_ERROR" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const messageId = apiResult.id || null;
    const now = new Date().toISOString();
    const lastBody = text.slice(0, 200);
    const insertPayload: Record<string, unknown> = {
      conversation_id: conversationId,
      direction: "outbound",
      platform_message_id: messageId,
      body: text,
      message_type: "text",
      raw_metadata: apiResult,
      status: "sent",
      status_updated_at: now,
      created_at: now,
    };
    if (replyToPlatformId) insertPayload.reply_to_platform_message_id = replyToPlatformId;

    const insertResult = await supabase.from("threads_messages").insert(insertPayload).select().single();
    let insertedMessage = insertResult.data ?? null;
    if (insertResult.error && messageId) {
      const { data: existing } = await supabase
        .from("threads_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .eq("platform_message_id", messageId)
        .maybeSingle();
      insertedMessage = existing ?? null;
    }

    await supabase
      .from("threads_conversations")
      .update({
        last_message_at: now,
        last_message_body: lastBody,
        last_message_direction: "outbound",
        last_message_status: "sent",
        updated_at: now,
      })
      .eq("id", conversationId);

    const returnedLeadStatusId = await applyThreadsUnreadToInProgressOnReply(supabase, conversationId, now);

    return new Response(
      JSON.stringify({
        success: true,
        message_id: messageId,
        message: insertedMessage,
        lead_status_id: returnedLeadStatusId ?? undefined,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("send-threads-message: error", err);
    return new Response(
      JSON.stringify({ error: "Gagal mengirim pesan Threads.", code: "INTERNAL_ERROR" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

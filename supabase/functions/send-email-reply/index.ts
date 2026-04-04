/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const RESEND_API_KEY_ENV = "RESEND_API_KEY";
const RESEND_SEND_API = "https://api.resend.com/emails";

Deno.serve(async (req: Request) => {
  // Log immediately so we see every request that reaches this function
  console.log("[send-email-reply] request received", req.method, new Date().toISOString());

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
    console.log("[send-email-reply] POST body parsing...");
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "").trim();
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseWithUser = createClient(supabaseUrl, serviceRoleKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: { user }, error: userError } = await supabaseWithUser.auth.getUser(token);
    if (userError || !user) {
      console.log("[send-email-reply] auth failed", userError?.message ?? "no user");
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("active_organization_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const activeOrgId = profile?.active_organization_id ?? null;
    if (!activeOrgId) {
      return new Response(JSON.stringify({ error: "No organization selected" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({})) as {
      conversation_id?: string;
      body?: string;
      subject?: string;
      to?: string;
      cc?: string;
      bcc?: string;
      attachments?: Array<{ filename: string; content: string }>;
    };
    const conversationId = body.conversation_id != null ? String(body.conversation_id).trim() : "";
    const replyBody = body.body != null ? String(body.body).trim() : "";
    const replySubject = body.subject != null ? String(body.subject).trim() : null;
    const overrideTo = body.to != null ? String(body.to).trim() : null;
    const cc = body.cc != null ? String(body.cc).trim() : null;
    const bcc = body.bcc != null ? String(body.bcc).trim() : null;
    const attachments = Array.isArray(body.attachments)
      ? body.attachments.filter((a) => a && typeof a.filename === "string" && typeof a.content === "string")
      : [];
    console.log("[send-email-reply] conversation_id=", conversationId, "body_len=", replyBody.length, "attachments=", attachments.length);

    if (!conversationId) {
      return new Response(JSON.stringify({ error: "Missing conversation_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!replyBody) {
      return new Response(JSON.stringify({ error: "Missing body (reply text)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: conv, error: convError } = await supabaseAdmin
      .from("email_conversations")
      .select("id, organization_id, email_connection_id, from_email, thread_subject, lead_status_id")
      .eq("id", conversationId)
      .maybeSingle();

    if (convError || !conv) {
      return new Response(JSON.stringify({ error: "Conversation not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (conv.organization_id !== activeOrgId) {
      return new Response(JSON.stringify({ error: "Access denied" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Block outbound when conversation is Resolved (Closed) until new inbound
    if (conv.lead_status_id) {
      const { data: statusRow } = await supabaseAdmin
        .from("lead_statuses")
        .select("name")
        .eq("id", conv.lead_status_id)
        .maybeSingle();
      const statusName = (statusRow?.name as string) ?? "";
      if (statusName.trim().toLowerCase() === "closed") {
        return new Response(
          JSON.stringify({
            error:
              "Chat sudah di-resolve. Kirim pesan tidak diizinkan sampai ada pesan masuk baru dari customer.",
            code: "CONVERSATION_RESOLVED",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const { data: conn, error: connError } = await supabaseAdmin
      .from("organization_email_connections")
      .select("id, inbound_address, email_address")
      .eq("id", conv.email_connection_id)
      .eq("organization_id", conv.organization_id)
      .maybeSingle();

    if (connError || !conn) {
      return new Response(JSON.stringify({ error: "Email connection not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const toRaw = (overrideTo || conv.from_email)?.trim();
    const toEmails = toRaw ? toRaw.split(",").map((e) => e.trim()).filter(Boolean) : [];
    if (toEmails.length === 0) {
      return new Response(JSON.stringify({ error: "No recipient (from_email) for this conversation" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get(RESEND_API_KEY_ENV)?.trim();
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fromAddress = conn.inbound_address;
    const displayName = conn.email_address?.trim() || "Support";
    const fromHeader = `${displayName} <${fromAddress}>`;
    const rawSubject = replySubject || `Re: ${conv.thread_subject?.trim() || "Email"}`;
    const subjectBase = rawSubject.replace(/^(Re:\s*)+/i, "").trim() || "Email";
    const subject = subjectBase === "Email" ? rawSubject : `Re: ${subjectBase}`;
    const htmlBody = replyBody.replace(/\n/g, "<br>\n");

    const payload: Record<string, unknown> = {
      from: fromHeader,
      to: toEmails,
      subject,
      html: htmlBody,
      reply_to: conn.email_address?.trim() || undefined,
    };
    if (cc) payload.cc = cc.split(",").map((e) => e.trim()).filter(Boolean);
    if (bcc) payload.bcc = bcc.split(",").map((e) => e.trim()).filter(Boolean);
    if (attachments.length > 0) {
      payload.attachments = attachments.map((a) => ({ filename: a.filename, content: a.content }));
    }
    const res = await fetch(RESEND_SEND_API, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const resJson = await res.json().catch(() => ({})) as { id?: string; message?: string };
    if (!res.ok) {
      const msg = resJson?.message ?? res.statusText ?? "Resend send failed";
      return new Response(JSON.stringify({ error: msg }), {
        status: res.status >= 400 ? res.status : 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date().toISOString();
    const { data: insertedMsg, error: insertError } = await supabaseAdmin
      .from("email_messages")
      .insert({
        conversation_id: conversationId,
        direction: "outbound",
        from_email: fromAddress,
        to_email: toEmails[0],
        subject: subject || null,
        body: replyBody,
        confirmation_code: null,
        cc: cc || null,
        bcc: bcc || null,
      })
      .select("id, conversation_id, direction, from_email, to_email, subject, body, cc, bcc, created_at")
      .single();

    if (insertError) {
      console.error("[send-email-reply] insert message failed", insertError);
      return new Response(JSON.stringify({ error: "Failed to save reply" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabaseAdmin
      .from("email_conversations")
      .update({
        last_message_at: now,
        updated_at: now,
      })
      .eq("id", conversationId);

    // Unread → In Progress when user sends reply (same as WhatsApp send-whatsapp-message)
    let currentStatusName: string | null = null;
    if (conv.lead_status_id) {
      const { data: statusRow } = await supabaseAdmin
        .from("lead_statuses")
        .select("name")
        .eq("id", conv.lead_status_id)
        .maybeSingle();
      currentStatusName = (statusRow?.name as string) ?? null;
    }
    const isOpenOrUnset = currentStatusName == null || currentStatusName.trim().toLowerCase() === "open";
    if (isOpenOrUnset) {
      // Multi-tenant: prefer status for conversation's org, fallback to default (organization_id IS NULL)
      let inProgressStatus: { id: string } | null = null;
      if (conv.organization_id) {
        const { data: orgStatus } = await supabaseAdmin
          .from("lead_statuses")
          .select("id")
          .eq("organization_id", conv.organization_id)
          .eq("name", "In Progress")
          .maybeSingle();
        inProgressStatus = orgStatus;
      }
      if (!inProgressStatus?.id) {
        const { data: defaultStatus } = await supabaseAdmin
          .from("lead_statuses")
          .select("id")
          .is("organization_id", null)
          .eq("name", "In Progress")
          .maybeSingle();
        inProgressStatus = defaultStatus;
      }
      if (inProgressStatus?.id) {
        await supabaseAdmin
          .from("email_conversations")
          .update({ lead_status_id: inProgressStatus.id, updated_at: now })
          .eq("id", conversationId);
        // Sync leads.status_id so leads-management shows In Progress (same as send-whatsapp-message)
        const ticketId = `EMAIL-${conversationId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
        if (conv.organization_id) {
          const { error: leadErr } = await supabaseAdmin
            .from("leads")
            .update({ status_id: inProgressStatus.id, updated_at: now })
            .eq("organization_id", conv.organization_id)
            .eq("ticket_id", ticketId);
          if (leadErr) console.error("[send-email-reply] sync leads.status_id to In Progress failed:", leadErr);
        }
      }
    }

    console.log("[send-email-reply] success message_id=", insertedMsg?.id);
    return new Response(
      JSON.stringify({ success: true, message: insertedMsg }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[send-email-reply] error", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

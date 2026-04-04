/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const META_API_BASE = "https://graph.facebook.com/v18.0";

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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseWithUser = createClient(supabaseUrl, serviceRoleKey, { global: { headers: { Authorization: authHeader } } });
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: { user }, error: userError } = await supabaseWithUser.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("active_organization_id")
      .eq("user_id", user.id)
      .single();

    let orgId = profile?.active_organization_id ?? null;

    const body = await req.json().catch(() => ({}));
    const to = body.to != null ? String(body.to).replace(/\D/g, "") : "";
    const text = body.text != null ? String(body.text).trim() : "";
    const conversationId = body.conversation_id ?? null;
    const mediaType = body.media_type != null ? String(body.media_type).toLowerCase().trim() : "";
    const mediaLink = body.media_link != null ? String(body.media_link).trim() : "";
    const caption = body.caption != null ? String(body.caption).trim().slice(0, 1024) : "";
    const replyToWaMessageId = body.reply_to_wa_message_id != null ? String(body.reply_to_wa_message_id).trim() : null;
    const replyToBody = body.reply_to_body != null ? String(body.reply_to_body).trim().slice(0, 500) : null;
    const replyToMessageType = body.reply_to_message_type != null ? String(body.reply_to_message_type).trim().slice(0, 20) : null;
    const replyToSender = body.reply_to_sender != null ? String(body.reply_to_sender).trim().slice(0, 120) : null;

    const isMedia = mediaType === "image" || mediaType === "video" || mediaType === "document";
    const hasText = text.length > 0;
    const hasMedia = isMedia && mediaLink.length > 0;

    if (!to) {
      return new Response(
        JSON.stringify({ error: "Missing to (customer WhatsApp number)", code: "MISSING_TO" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!hasText && !hasMedia) {
      const hint =
        body.media_type != null || body.media_link != null
          ? "media_type must be image|video|document and media_link must be a non-empty URL"
          : "Provide text and/or media (media_type + media_link)";
      return new Response(
        JSON.stringify({ error: `Missing text or media. ${hint}`, code: "MISSING_CONTENT" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resolve config: when conversationId given, use that conversation's phone_number_id + org → organization_whatsapp_accounts (admin client so RLS does not block)
    let config: { meta_access_token: string; phone_number_id: string } | null = null;
    let resolvedOrgId: string | null = null;

    const tryAccount = async (oid: string, pnId: string | null) => {
      const base = supabaseAdmin
        .from("organization_whatsapp_accounts")
        .select("meta_access_token, phone_number_id")
        .eq("organization_id", oid)
        .eq("is_active", true);
      const q = pnId ? base.eq("phone_number_id", pnId) : base.limit(1);
      const { data: rows, error } = await q;
      const data = Array.isArray(rows) ? rows[0] : null;
      if (!error && data?.phone_number_id) {
        let accessToken = (data.meta_access_token ?? "").trim();
        if (!accessToken) {
          const { data: orgMeta } = await supabaseAdmin.from("organization_meta_config").select("meta_access_token").eq("organization_id", oid).maybeSingle();
          accessToken = (orgMeta?.meta_access_token ?? "").trim();
        }
        if (accessToken) return { config: { meta_access_token: accessToken, phone_number_id: data.phone_number_id }, orgId: oid };
      }
      return null;
    };

    if (conversationId) {
      const { data: convRow } = await supabaseAdmin
        .from("whatsapp_conversations")
        .select("organization_id, phone_number_id, channel")
        .eq("id", conversationId)
        .maybeSingle();
      const convChannel = (convRow?.channel ?? "").toString().toLowerCase();
      if (convChannel === "instagram") {
        return new Response(
          JSON.stringify({
            error:
              "Percakapan ini dari Instagram. Pengiriman pesan dari inbox ini hanya untuk WhatsApp. Gunakan percakapan WhatsApp.",
            code: "INSTAGRAM_CONVERSATION",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (convRow?.organization_id) {
        const pnId = convRow.phone_number_id != null ? String(convRow.phone_number_id).trim() || null : null;
        const current = pnId
          ? await tryAccount(convRow.organization_id, pnId)
          : await tryAccount(convRow.organization_id, null);
        if (current) {
          config = current.config;
          resolvedOrgId = current.orgId;
        }
        // Jangan pakai akun organisasi lain: jika org percakapan tidak punya akun WhatsApp, tolak kirim.
        if (!config || !resolvedOrgId) {
          return new Response(
            JSON.stringify({
              error:
                "WhatsApp not configured for this organization. Connect WhatsApp in Operations → Consultant → WhatsApp Connect.",
              code: "WHATSAPP_NOT_CONFIGURED",
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    if (!config || !resolvedOrgId) {
      const { data: userOrgs } = await supabaseAdmin
        .from("user_organizations")
        .select("organization_id")
        .eq("user_id", user.id);
      const orgIds = (userOrgs ?? []).map((r: { organization_id: string }) => r.organization_id);
      if (orgId) {
        const current = await tryAccount(orgId, null);
        if (current) {
          config = current.config;
          resolvedOrgId = current.orgId;
        }
      }
      if (!config && orgIds.length > 0) {
        for (const oid of orgIds) {
          if (oid === orgId) continue;
          const current = await tryAccount(oid, null);
          if (current) {
            config = current.config;
            resolvedOrgId = current.orgId;
            break;
          }
        }
      }
    }

    if (!config || !resolvedOrgId) {
      return new Response(
        JSON.stringify({
          error:
            "WhatsApp not configured for this organization. Connect WhatsApp in Operations → Consultant → WhatsApp Connect.",
          code: "WHATSAPP_NOT_CONFIGURED",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (conversationId) {
      const { data: convRow } = await supabaseAdmin
        .from("whatsapp_conversations")
        .select("lead_status_id, last_inbound_at, created_at")
        .eq("id", conversationId)
        .maybeSingle();
      const leadStatusId = convRow?.lead_status_id ?? null;
      if (leadStatusId) {
        const { data: statusRow } = await supabaseAdmin
          .from("lead_statuses")
          .select("name")
          .eq("id", leadStatusId)
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
      const lastInboundAt = convRow?.last_inbound_at != null ? new Date(convRow.last_inbound_at as string).getTime() : NaN;
      const createdAt = convRow?.created_at != null ? new Date(convRow.created_at as string).getTime() : NaN;
      const effectiveMs = Number.isNaN(lastInboundAt) ? createdAt : lastInboundAt;
      if (!Number.isNaN(effectiveMs) && Date.now() - effectiveMs > 24 * 60 * 60 * 1000) {
        return new Response(
          JSON.stringify({
            error:
              "Pesan terakhir dari customer sudah lewat 24 jam. Kirim pesan tidak diizinkan sampai customer mengirim pesan lagi.",
            code: "OUTSIDE_24H_WINDOW",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const metaUrl = `${META_API_BASE}/${config.phone_number_id}/messages`;
    let metaBody: Record<string, unknown> = {
      messaging_product: "whatsapp",
      to,
    };
    if (replyToWaMessageId) {
      metaBody.context = { message_id: replyToWaMessageId };
    }

    if (hasMedia) {
      const mediaPayload: { link: string; caption?: string; filename?: string } = { link: mediaLink };
      if (caption) mediaPayload.caption = caption;
      if (mediaType === "document") mediaPayload.filename = mediaLink.split("/").pop()?.split("?")[0] || "document";
      metaBody.type = mediaType;
      metaBody[mediaType] = mediaPayload;
    } else {
      metaBody.type = "text";
      metaBody.text = { body: text };
    }

    const metaRes = await fetch(metaUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${config.meta_access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(metaBody),
    });

    const metaData = await metaRes.json().catch(() => ({}));
    if (!metaRes.ok) {
      const metaError = metaData?.error;
      const metaMsg = metaError?.message ?? metaData?.error_message ?? "Meta API error";
      const code = metaError?.code;
      const subcode = metaError?.error_subcode;
      console.error("Meta API error:", metaRes.status, metaData);

      // Meta code 100 + subcode 33 = object doesn't exist / missing permissions / unsupported operation
      // Sering terjadi jika ID yang dipakai adalah Instagram Business Account ID / Page ID, bukan WhatsApp Phone Number ID
      const userHint =
        code === 100 && (subcode === 33 || /does not exist|missing permissions|does not support/i.test(metaMsg))
          ? "ID yang dipakai bukan WhatsApp Phone Number ID (mungkin ID Instagram/Page). Di WhatsApp Connect, pastikan Anda memasukkan Phone Number ID dari Meta: WhatsApp → API Setup, bukan Instagram Business Account ID. Periksa juga: token dan Phone Number ID harus dari App & WABA yang sama."
          : metaMsg;

      return new Response(
        JSON.stringify({
          error: userHint,
          details: metaData,
          code,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const waMessageId = metaData.messages?.[0]?.id ?? null;

    if (conversationId && waMessageId) {
      const storedBody = hasMedia ? (caption || `[${mediaType}]`) : text;
      const lastBody = storedBody.slice(0, 200);
      const now = new Date().toISOString();
      const insertPayload: Record<string, unknown> = {
        conversation_id: conversationId,
        direction: "outbound",
        wa_message_id: waMessageId,
        platform_message_id: waMessageId,
        channel: "whatsapp",
        body: storedBody,
        message_type: hasMedia ? mediaType : "text",
        raw_metadata: metaData,
        status: "sent",
        reply_to_wa_message_id: replyToWaMessageId ?? null,
        reply_to_body: replyToBody ?? null,
        reply_to_message_type: replyToMessageType ?? null,
        reply_to_sender: replyToSender ?? null,
      };
      if (hasMedia && mediaLink) insertPayload.media_url = mediaLink;
      const { data: insertedMessage, error: insertError } = await supabaseAdmin
        .from("whatsapp_messages")
        .insert(insertPayload)
        .select()
        .single();
      if (insertError) {
        console.error("whatsapp_messages insert error:", insertError);
      }
      const { data: convBefore } = await supabaseAdmin
        .from("whatsapp_conversations")
        .select("lead_status_id, organization_id, ticket_id")
        .eq("id", conversationId)
        .maybeSingle();
      const statusIdBefore = convBefore?.lead_status_id ?? null;
      const convOrgId = convBefore?.organization_id ?? null;
      let statusNameBefore: string | null = null;
      if (statusIdBefore) {
        const { data: st } = await supabaseAdmin
          .from("lead_statuses")
          .select("name")
          .eq("id", statusIdBefore)
          .maybeSingle();
        statusNameBefore = (st?.name as string) ?? null;
      }

      let returnedLeadStatusId: string | null = null;

      await supabaseAdmin
        .from("whatsapp_conversations")
        .update({
          last_message_at: now,
          last_message_body: lastBody,
          updated_at: now,
        })
        .eq("id", conversationId);

      // Treat null (unset), "Open", or "Unread" as Unread → update to In Progress on first outbound reply
      const statusLower = statusNameBefore?.trim().toLowerCase() ?? "";
      const isOpenOrUnset =
        !statusNameBefore || statusLower === "open" || statusLower === "unread";
      if (!isOpenOrUnset) {
        console.log("send-whatsapp-message: skip In Progress update (status not Open/Unread)", {
          conversationId,
          statusNameBefore,
          isOpenOrUnset,
        });
      }
      if (isOpenOrUnset) {
        // Multi-tenant: prefer status for conversation's org, fallback to default (organization_id IS NULL)
        let inProgressStatus: { id: string } | null = null;
        if (convOrgId) {
          const { data: orgStatus } = await supabaseAdmin
            .from("lead_statuses")
            .select("id")
            .eq("organization_id", convOrgId)
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
        console.log("Unread→In Progress:", { conversationId, statusNameBefore, inProgressId: inProgressStatus?.id ?? "MISSING" });
        if (inProgressStatus?.id) {
          returnedLeadStatusId = inProgressStatus.id;
          const { error: updateErr } = await supabaseAdmin
            .from("whatsapp_conversations")
            .update({ lead_status_id: inProgressStatus.id, updated_at: now })
            .eq("id", conversationId);
          if (updateErr) console.error("Update to In Progress failed:", updateErr);
          else console.log("Status updated to In Progress:", conversationId);
          const ticketId = (convBefore?.ticket_id as string) ?? `WA-${conversationId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
          if (convOrgId) {
            const { error: leadErr } = await supabaseAdmin
              .from("leads")
              .update({ status_id: inProgressStatus.id, updated_at: now })
              .eq("organization_id", convOrgId)
              .eq("ticket_id", ticketId);
            if (leadErr) console.error("Sync leads.status_id to In Progress failed:", leadErr);
          }
          const { data: currentCycle } = await supabaseAdmin
            .from("whatsapp_conversation_cycles")
            .select("id")
            .eq("conversation_id", conversationId)
            .is("resolved_at", null)
            .order("cycle_started_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (currentCycle?.id) {
            await supabaseAdmin
              .from("whatsapp_conversation_cycles")
              .update({ first_response_at: now, updated_at: now })
              .eq("id", currentCycle.id);
          }
        } else {
          console.warn("Cannot set In Progress: lead_statuses has no row with name 'In Progress'.", {
            conversationId,
            convOrgId,
          });
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          message_id: waMessageId,
          message: insertedMessage ?? null,
          lead_status_id: returnedLeadStatusId ?? undefined,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message_id: waMessageId, message: null }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("send-whatsapp-message error:", err);
    return new Response(
      JSON.stringify({ error: "Send failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

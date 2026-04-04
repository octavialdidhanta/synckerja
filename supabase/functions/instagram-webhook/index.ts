import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const META_GRAPH_VERSION = "v21.0";
const INSTAGRAM_MEDIA_BUCKET = "whatsapp-media";

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

/** Create lead for new Instagram conversation (ticket_id IG-xxx). */
async function ensureLeadForNewInstagramConversation(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  convId: string,
  clientName: string,
  title: string,
  customerIgId: string,
  createdByDisplayName: string
): Promise<void> {
  const ticketId = "IG-" + String(convId).replace(/-/g, "").slice(0, 8).toUpperCase();
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
    console.warn("ensureLeadForNewInstagramConversation: no Unread status, skip lead insert");
    return;
  }

  const safeClient = (clientName && String(clientName).trim()) || "Instagram";
  const safeTitle = (title && String(title).trim().slice(0, 100)) || "Instagram";

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
    source: "Instagram",
    services: null,
    followup: 0,
    phone_number: null,
  });
  if (error) console.error("ensureLeadForNewInstagramConversation: insert error", error);
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  console.log("[instagram-webhook] ENTRY", req.method, url.pathname);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
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

      if (mode !== "subscribe" || !challenge) {
        return new Response("instagram-webhook ok", { status: 200, headers: { ...corsHeaders, "Content-Type": "text/plain" } });
      }

      let verified = false;
      if (token) {
        const { data: igAccount } = await supabase
          .from("organization_instagram_accounts")
          .select("id")
          .eq("verify_token", token)
          .eq("is_active", true)
          .maybeSingle();
        if (igAccount) verified = true;
        if (!verified) {
          const { data: metaByVerify } = await supabase
            .from("organization_meta_config")
            .select("id")
            .eq("verify_token", token)
            .eq("is_active", true)
            .maybeSingle();
          if (metaByVerify) verified = true;
        }
        if (!verified) {
          const { data: metaByIgToken } = await supabase
            .from("organization_meta_config")
            .select("id")
            .eq("instagram_verify_token", token)
            .eq("is_active", true)
            .maybeSingle();
          if (metaByIgToken) verified = true;
        }
      }

      if (!verified) {
        console.error("[instagram-webhook] GET: verify_token not found");
        return new Response("Forbidden", { status: 403, headers: corsHeaders });
      }
      console.log("[instagram-webhook] GET: verification success");
      const challengeStr = challenge != null ? String(challenge) : "";
      return new Response(challengeStr, { status: 200, headers: { ...corsHeaders, "Content-Type": "text/plain" } });
    }

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch((e) => {
      console.error("[instagram-webhook] POST body parse error", e);
      return {};
    });
    const bodyObject = body?.object ?? "(missing)";
    const entryCount = Array.isArray(body?.entry) ? body.entry.length : 0;
    console.log("[instagram-webhook] POST received — object:", bodyObject, "entries:", entryCount);
    if (body?.object !== "instagram") {
      console.log("[instagram-webhook] POST: object is not 'instagram', ignoring. Payload object:", bodyObject);
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const entries = body?.entry ?? [];
    if (entries.length > 0) {
      const first = entries[0] as Record<string, unknown>;
      const keys = first ? Object.keys(first) : [];
      const hasChanges = Array.isArray(first?.changes) && (first.changes as unknown[]).length > 0;
      const hasMessaging = Array.isArray(first?.messaging) && (first.messaging as unknown[]).length > 0;
      console.log("[instagram-webhook] first entry keys:", keys.join(", "), "id:", first?.id, "messaging?:", hasMessaging ? (first.messaging as unknown[]).length : "none", "changes?:", hasChanges ? (first.changes as unknown[]).length : "none");
      if (hasChanges && !hasMessaging) {
        console.log("[instagram-webhook] Payload punya 'changes' bukan 'messaging' — ini bukan event DM. Untuk tes: kirim pesan nyata dari app Instagram ke akun bisnis (@octa.vialdi), jangan pakai tombol Test di Meta.");
      }
    }
    for (const entry of entries) {
      const igAccountId = entry?.id != null && entry?.id !== "" ? String(entry.id).trim() : null;
      let messaging = entry?.messaging ?? [];
      if ((!igAccountId || igAccountId === "0" || !Array.isArray(messaging) || messaging.length === 0) && Array.isArray((entry as Record<string, unknown>)?.changes)) {
        const changes = (entry as Record<string, unknown>).changes as Array<Record<string, unknown>>;
        for (const ch of changes) {
          const val = ch?.value as Record<string, unknown> | undefined;
          if (val && (val.messaging_event || (val.sender && val.message))) {
            messaging = [val.messaging_event ?? val] as typeof messaging;
            console.log("[instagram-webhook] using message from entry.changes");
            break;
          }
        }
      }
      if (!Array.isArray(messaging) || messaging.length === 0) continue;
      let effectiveId = igAccountId && igAccountId !== "0" ? igAccountId : null;
      console.log("[instagram-webhook] entry id:", effectiveId ?? "(from changes)", "messaging events:", messaging.length);
      if (!effectiveId && messaging.length > 0) {
        const { data: singleAccount } = await supabase
          .from("organization_instagram_accounts")
          .select("instagram_business_account_id")
          .eq("is_active", true)
          .limit(1)
          .maybeSingle();
        if (singleAccount?.instagram_business_account_id) {
          effectiveId = String(singleAccount.instagram_business_account_id).trim();
          console.log("[instagram-webhook] using single account fallback id:", effectiveId);
        }
      }
      if (!effectiveId) continue;

      const { data: accountRows, error: accError } = await supabase
        .from("organization_instagram_accounts")
        .select("organization_id, page_access_token, instagram_username, instagram_name")
        .eq("instagram_business_account_id", effectiveId)
        .eq("is_active", true);

      if (accError || !accountRows?.length) {
        console.error("[instagram-webhook] config not found for instagram_business_account_id:", effectiveId, "— pastikan akun Instagram ini yang di-connect di halaman Connect Instagram. Error:", accError ?? "");
        continue;
      }

      console.log("[instagram-webhook] account found for ig id:", effectiveId, "org:", accountRows[0]?.organization_id);
      const account = accountRows[0] as {
        organization_id: string;
        page_access_token: string | null;
        instagram_username: string | null;
        instagram_name: string | null;
      };
      const orgId = account.organization_id;
      const accessToken = (account.page_access_token ?? "").trim() || null;
      const displayName =
        (account.instagram_username ? "@" + account.instagram_username.trim() : null) ||
        (account.instagram_name ?? "").trim() ||
        "Instagram";

      type MessagingEvt = { message?: { is_echo?: boolean; mid?: string }; sender?: { id?: unknown }; recipient?: { id?: unknown }; timestamp?: unknown };
      for (const evt of messaging) {
        const e = evt as MessagingEvt;
        if (e.message?.is_echo) {
          console.log("[instagram-webhook] skip: is_echo");
          continue;
        }
        const senderId = e.sender?.id != null ? String(e.sender.id) : null;
        const recipientId = e.recipient?.id != null ? String(e.recipient.id) : null;
        if (!senderId) {
          console.log("[instagram-webhook] skip: no senderId");
          continue;
        }
        if (recipientId && recipientId !== effectiveId) {
          console.log("[instagram-webhook] recipientId differs from entry id (continuing anyway)", { recipientId, effectiveId });
        }

        const mid = e.message?.mid != null ? String(e.message.mid) : null;
        const ts = e.timestamp != null ? new Date(Number(e.timestamp)).toISOString() : new Date().toISOString();
        const { body: bodyText, messageType } = getMessageBody(evt as Record<string, unknown>);
        const lastBody = bodyText.slice(0, 200);

        const convPayload = {
          organization_id: orgId,
          instagram_business_account_id: effectiveId,
          customer_ig_id: senderId,
          customer_external_id: senderId,
          last_message_at: ts,
          last_message_body: lastBody,
          last_message_direction: "inbound",
          last_message_status: null as string | null,
          first_inbound_at: null as string | null,
          last_inbound_at: ts,
          updated_at: ts,
        };

        const { data: existingConv } = await supabase
          .from("instagram_conversations")
          .select("id, first_inbound_at")
          .eq("organization_id", orgId)
          .eq("instagram_business_account_id", effectiveId)
          .eq("customer_ig_id", senderId)
          .maybeSingle();

        let conv: { id: string; first_inbound_at: string | null } | null = null;
        if (existingConv) {
          const { data: updated } = await supabase
            .from("instagram_conversations")
            .update({
              last_message_at: ts,
              last_message_body: lastBody,
              last_message_direction: "inbound",
              last_inbound_at: ts,
              updated_at: ts,
            })
            .eq("id", existingConv.id)
            .select("id, first_inbound_at")
            .single();
          conv = updated;
        } else {
          const ticketId = "IG-" + crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
          const { data: openStatus } = await supabase.from("lead_statuses").select("id").eq("name", "Open").maybeSingle();
          const { data: unreadStatus } = await supabase.from("lead_statuses").select("id").eq("name", "Unread").maybeSingle();
          const leadStatusId = openStatus?.id ?? unreadStatus?.id ?? null;

          const { data: inserted, error: insertErr } = await supabase
            .from("instagram_conversations")
            .insert({
              ...convPayload,
              ticket_id: ticketId,
              lead_status_id: leadStatusId,
              first_inbound_at: ts,
            })
            .select("id, first_inbound_at")
            .single();
          if (insertErr) {
            console.error("[instagram-webhook] conversation insert error", insertErr);
            continue;
          }
          conv = inserted;
          await ensureLeadForNewInstagramConversation(
            supabase,
            orgId,
            conv!.id,
            "Instagram contact",
            lastBody || "Instagram",
            senderId,
            displayName
          );
        }

        if (!conv || !mid) {
          console.log("[instagram-webhook] skip save: no conv or mid", { conv: !!conv, mid: !!mid });
          continue;
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

        // Inbound reply context: extract reply_to.mid so UI can show reply preview
        const msgObj = (evt as Record<string, unknown>).message as { reply_to?: { mid?: string } } | undefined;
        const replyToMid = msgObj?.reply_to?.mid != null ? String(msgObj.reply_to.mid).trim() : null;
        if (replyToMid) {
          insertPayload.reply_to_platform_message_id = replyToMid;
          const { data: repliedToRow } = await supabase
            .from("instagram_messages")
            .select("body, message_type")
            .eq("conversation_id", conv.id)
            .eq("platform_message_id", replyToMid)
            .maybeSingle();
          if (repliedToRow) {
            const repliedBody = repliedToRow.body;
            const repliedType = (repliedToRow.message_type ?? "text") as string;
            insertPayload.reply_to_body =
              repliedBody != null && repliedBody !== ""
                ? String(repliedBody).slice(0, 500)
                : ["image", "video", "file"].includes((repliedType || "").toLowerCase())
                  ? `[${repliedType}]`
                  : "[Pesan]";
            insertPayload.reply_to_message_type = repliedType;
          } else {
            insertPayload.reply_to_body = "[Pesan]";
          }
        }

        const { error: msgErr } = await supabase.from("instagram_messages").insert(insertPayload);
        if (msgErr) {
          console.error("[instagram-webhook] instagram_messages insert error", msgErr);
          continue;
        }

        if (!existingConv?.first_inbound_at && conv.first_inbound_at) {
          await supabase
            .from("instagram_conversations")
            .update({ first_inbound_at: ts, updated_at: ts })
            .eq("id", conv.id);
        }

        // Resolve-cycle: when existing conversation receives inbound, re-open to Open (Unread) if status is Closed/Resolve or null (same logic as whatsapp-webhook)
        if (existingConv) {
          const { data: convRow } = await supabase
            .from("instagram_conversations")
            .select("lead_status_id")
            .eq("id", conv.id)
            .single();
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
          const statusNameLower = leadStatusName?.trim().toLowerCase() ?? "";
          const isResolved = statusNameLower === "closed" || statusNameLower === "resolve";
          const isNewOrReopen = openStatusId && (statusId == null || isResolved);
          if (isNewOrReopen) {
            const { error: updateErr } = await supabase
              .from("instagram_conversations")
              .update({ lead_status_id: openStatusId, last_inbound_at: ts, updated_at: ts })
              .eq("id", conv.id);
            if (updateErr) {
              console.error("[instagram-webhook] Reopen to Open (Unread) update error:", updateErr);
            } else {
              console.log("[instagram-webhook] Reopened conversation to Open (Unread):", conv.id, { openStatusId, hadStatus: statusId });
            }
          }
        }

        console.log("[instagram-webhook] message saved", { convId: conv.id, mid });
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[instagram-webhook] error", err);
    return new Response(JSON.stringify({ error: "Webhook failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

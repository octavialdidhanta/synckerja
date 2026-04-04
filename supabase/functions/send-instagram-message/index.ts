/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const META_GRAPH_VERSION = "v21.0";

Deno.serve(async (req: Request) => {
  console.log("send-instagram-message: request received", { method: req.method });

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
      console.log("send-instagram-message: missing or invalid Authorization");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      console.log("send-instagram-message: invalid token", userError?.message);
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("active_organization_id")
      .eq("user_id", user.id)
      .single();

    let orgId = profile?.active_organization_id ?? null;

    const body = await req.json().catch(() => ({}));
    const to = body.to != null ? String(body.to).trim() : "";
    const text = body.text != null ? String(body.text).trim().slice(0, 1000) : "";
    const conversationId = body.conversation_id != null ? String(body.conversation_id).trim() : null;
    const replyToMid = body.reply_to_wa_message_id != null ? String(body.reply_to_wa_message_id).trim() : null;

    console.log("send-instagram-message: payload", {
      to: to ? `${to.slice(0, 6)}...` : "",
      textLen: text.length,
      conversationId: conversationId ?? null,
      replyToMid: replyToMid ?? null,
    });

    if (!to) {
      console.log("send-instagram-message: missing to (recipient PSID)");
      return new Response(
        JSON.stringify({
          error: "Penerima tidak tersedia (ID Instagram kosong). Pilih percakapan yang valid.",
          code: "MISSING_TO",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!text) {
      console.log("send-instagram-message: missing text");
      return new Response(
        JSON.stringify({
          error: "Pesan tidak boleh kosong.",
          code: "MISSING_TEXT",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: userOrgs } = await supabase
      .from("user_organizations")
      .select("organization_id")
      .eq("user_id", user.id);
    const orgIds = (userOrgs ?? []).map((r: { organization_id: string }) => r.organization_id);

    type ResolvedConfig = {
      organization_id: string;
      pageId: string;
      tokenToUse: string;
    };

    let resolved: ResolvedConfig | null = null;

    // 1) When conversation_id is provided we MUST use the same Page that owns the conversation (avoids Meta #100 "No matching user found")
    if (conversationId) {
      const { data: conv } = await supabase
        .from("instagram_conversations")
        .select("organization_id, instagram_business_account_id, lead_status_id, last_inbound_at, created_at")
        .eq("id", conversationId)
        .maybeSingle();
      if (conv?.organization_id && conv?.instagram_business_account_id) {
        const leadStatusId = conv?.lead_status_id ?? null;
        if (leadStatusId) {
          const { data: statusRow } = await supabase
            .from("lead_statuses")
            .select("name")
            .eq("id", leadStatusId)
            .maybeSingle();
          const statusName = (statusRow?.name as string) ?? "";
          if (statusName.trim().toLowerCase() === "closed") {
            return new Response(
              JSON.stringify({
                error: "Chat sudah di-resolve. Kirim pesan tidak diizinkan sampai ada pesan masuk baru dari customer.",
                code: "CONVERSATION_RESOLVED",
              }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
        const lastInboundAt = conv?.last_inbound_at != null ? new Date(conv.last_inbound_at as string).getTime() : NaN;
        const createdAt = conv?.created_at != null ? new Date(conv.created_at as string).getTime() : NaN;
        const effectiveMs = Number.isNaN(lastInboundAt) ? createdAt : lastInboundAt;
        if (!Number.isNaN(effectiveMs) && Date.now() - effectiveMs > 24 * 60 * 60 * 1000) {
          return new Response(
            JSON.stringify({
              error: "Pesan terakhir dari customer sudah lewat 24 jam. Kirim pesan tidak diizinkan sampai customer mengirim pesan lagi.",
              code: "OUTSIDE_24H_WINDOW",
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const { data: igAcc } = await supabase
          .from("organization_instagram_accounts")
          .select("facebook_page_id, page_access_token")
          .eq("organization_id", conv.organization_id)
          .eq("instagram_business_account_id", conv.instagram_business_account_id)
          .eq("is_active", true)
          .maybeSingle();
        const pageToken = (igAcc?.page_access_token ?? "").trim();
        const pageId = (igAcc?.facebook_page_id ?? "").trim() || null;
        if (pageToken && pageId) {
          resolved = { organization_id: conv.organization_id, pageId, tokenToUse: pageToken };
          orgId = conv.organization_id;
          console.log("send-instagram-message: using conversation Page", {
            conversation_id: conversationId.slice(0, 8) + "...",
            organization_id: conv.organization_id.slice(0, 8) + "...",
            instagram_business_account_id: conv.instagram_business_account_id.slice(0, 8) + "...",
            page_id_prefix: pageId.slice(0, 8) + "...",
            recipient_id_prefix: to.slice(0, 8) + "...",
          });
        } else {
          // Do NOT fall back to meta_config: recipient ID is scoped to this conversation's Page
          console.error("send-instagram-message: conversation has no matching org Instagram account", {
            conversation_id: conversationId,
            organization_id: conv.organization_id,
            instagram_business_account_id: conv.instagram_business_account_id,
          });
          return new Response(
            JSON.stringify({
              error: "Akun Instagram untuk percakapan ini tidak ditemukan atau token hilang. Buka Connect Instagram, disconnect lalu connect lagi akun @ yang dipakai untuk percakapan ini.",
              code: "CONVERSATION_ACCOUNT_MISMATCH",
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } else {
        return new Response(
          JSON.stringify({
            error: "Percakapan tidak valid. Pilih percakapan yang masih ada.",
            code: "INVALID_CONVERSATION",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 2) Fallback only when no conversation_id: organization_meta_config + /me/accounts
    if (!resolved) {
      const tryOrg = async (oid: string) => {
        const { data, error } = await supabase
          .from("organization_meta_config")
          .select("organization_id, meta_access_token, meta_business_manager_id, instagram_business_account_id, facebook_page_id")
          .eq("organization_id", oid)
          .eq("is_active", true)
          .not("instagram_business_account_id", "is", null)
          .maybeSingle();
        if (!error && data?.meta_access_token?.trim()) return { config: data, orgId: oid };
        return null;
      };

      type ConfigRow = {
        organization_id: string;
        meta_access_token: string;
        meta_business_manager_id: string | null;
        instagram_business_account_id: string | null;
        facebook_page_id: string | null;
      };
      let config: ConfigRow | null = null;
      if (orgId) config = (await tryOrg(orgId))?.config ?? null;
      if (!config && orgIds.length > 0) {
        for (const oid of orgIds) {
          if (oid === orgId) continue;
          const r = await tryOrg(oid);
          if (r) {
            config = r.config;
            orgId = r.orgId;
            break;
          }
        }
      }

      if (!config) {
        console.log("send-instagram-message: no org config with Instagram", { activeOrgId: orgId ?? null, orgIdsTried: orgIds?.length ?? 0 });
        return new Response(
          JSON.stringify({
            error: "Instagram belum terhubung untuk organisasi ini. Buka halaman Connect Instagram dan sambungkan akun Instagram bisnis.",
            code: "INSTAGRAM_NOT_CONFIGURED",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      orgId = config.organization_id;
      const storedToken = config.meta_access_token.trim();
      const igAccountId = (config.instagram_business_account_id ?? "").trim();
      const businessId = (config.meta_business_manager_id ?? "").trim() || null;
      let pageId: string | null = (config.facebook_page_id ?? "").trim() || null;
      let tokenToUse = storedToken;
      const fields = "id,instagram_business_account{id},access_token";

      function pickPage(
        pages: Array<{ id?: string; access_token?: string; instagram_business_account?: { id?: string } }>
      ): void {
        const page = pages.find((p) => String(p?.instagram_business_account?.id ?? "") === igAccountId);
        if (page?.id) {
          pageId = String(page.id);
          if (typeof page?.access_token === "string" && page.access_token.trim()) {
            tokenToUse = page.access_token.trim();
          }
        }
      }

      if (igAccountId) {
        const meUrl = `https://graph.facebook.com/${META_GRAPH_VERSION}/me/accounts?fields=${encodeURIComponent(fields)}`;
        const accRes = await fetch(meUrl, { method: "GET", headers: { "Authorization": `Bearer ${storedToken}` } });
        const accData = await accRes.json().catch(() => ({})) as {
          data?: Array<{ id?: string; access_token?: string; instagram_business_account?: { id?: string } }>;
          error?: { message?: string; code?: number };
        };
        if (Array.isArray(accData?.data)) pickPage(accData.data);
        if (!pageId && businessId) {
          const ownedUrl = `https://graph.facebook.com/${META_GRAPH_VERSION}/${encodeURIComponent(businessId)}/owned_pages?fields=${encodeURIComponent(fields)}`;
          const ownedRes = await fetch(ownedUrl, { method: "GET", headers: { "Authorization": `Bearer ${storedToken}` } });
          const ownedData = await ownedRes.json().catch(() => ({})) as {
            data?: Array<{ id?: string; access_token?: string; instagram_business_account?: { id?: string } }>;
          };
          if (Array.isArray(ownedData?.data)) pickPage(ownedData.data);
        }
      }

      if (pageId && tokenToUse) {
        resolved = { organization_id: orgId, pageId, tokenToUse };
      }
    }

    if (!resolved) {
      return new Response(
        JSON.stringify({
          error: "Tidak dapat mengambil Page/Instagram. Sambungkan akun Instagram di halaman Connect Instagram dan pastikan Page access token tersedia.",
          code: "MISSING_PAGE_ID",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pageId = resolved.pageId;
    const tokenToUse = resolved.tokenToUse;

    const metaPayload: Record<string, unknown> = {
      recipient: { id: to },
      message: { text },
    };
    if (replyToMid) {
      metaPayload.reply_to = { mid: replyToMid };
    }

    const metaUrl = `https://graph.facebook.com/${META_GRAPH_VERSION}/${pageId}/messages`;
    console.log("send-instagram-message: calling Meta API", {
      conversation_id: conversationId ? conversationId.slice(0, 8) + "..." : null,
      page_id_prefix: pageId.slice(0, 8) + "...",
      recipient_id_prefix: to.slice(0, 8) + "...",
    });

    let metaRes: Response;
    let metaData: { recipient_id?: string; message_id?: string; error?: { message?: string; code?: number; error_subcode?: number; type?: string } };
    try {
      metaRes = await fetch(metaUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${tokenToUse}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(metaPayload),
      });
      const rawBody = await metaRes.text();
      metaData = (() => {
        try {
          return (rawBody ? JSON.parse(rawBody) : {}) as typeof metaData;
        } catch {
          return {};
        }
      })();
    } catch (fetchErr) {
      const msg = fetchErr instanceof Error ? fetchErr.message : "Meta API request failed";
      console.error("send-instagram-message: Meta fetch error", msg, fetchErr);
      return new Response(
        JSON.stringify({
          error: "Gagal menghubungi Meta API. Cek koneksi atau token di Connect Instagram.",
          code: "META_FETCH_ERROR",
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("send-instagram-message: Meta response", {
      ok: metaRes.ok,
      status: metaRes.status,
      message_id: metaData?.message_id ?? null,
      error: metaData?.error?.message ?? null,
      error_code: metaData?.error?.code ?? null,
    });

    if (!metaRes.ok) {
      const rawMsg = metaData?.error?.message ?? "Meta API error";
      const code = metaData?.error?.code;
      const subcode = metaData?.error?.error_subcode;
      const errorType = metaData?.error?.type ?? "";
      // 551 = outside 24h messaging window (freeform only within 24h of user message)
      const errMsg =
        code === 551 || subcode === 551
          ? "Tidak bisa mengirim: percakapan di luar jendela 24 jam. Pengguna harus mengirim pesan dalam 24 jam terakhir agar Anda bisa membalas pesan bebas (bukan template)."
          : rawMsg;
      // Log full Meta error for debugging (no PII)
      console.error("send-instagram-message: Meta API error full", JSON.stringify({ code, subcode, type: errorType, message: rawMsg }));
      // Use 400 for Meta client errors (invalid request, token, permission) so client can show message; 502 for rate limit / server-side
      const statusFromMeta = metaRes.status >= 400 && metaRes.status < 500 ? 400 : 502;
      return new Response(
        JSON.stringify({
          error: errMsg,
          details: metaData,
          code: code ?? undefined,
        }),
        { status: statusFromMeta, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const messageId = metaData?.message_id ?? null;

    if (conversationId && messageId) {
      const now = new Date().toISOString();
      const lastBody = text.slice(0, 200);
      const insertPayload: Record<string, unknown> = {
        conversation_id: conversationId,
        direction: "outbound",
        platform_message_id: messageId,
        body: text,
        message_type: "text",
        raw_metadata: metaData,
        status: "sent",
        status_updated_at: now,
        created_at: now,
      };
      if (replyToMid) insertPayload.reply_to_platform_message_id = replyToMid;

      const insertResult = await supabase
        .from("instagram_messages")
        .insert(insertPayload)
        .select()
        .single();

      if (insertResult.error) {
        console.error("send-instagram-message: instagram_messages insert error", insertResult.error);
      } else {
        await supabase
          .from("instagram_conversations")
          .update({
            last_message_at: now,
            last_message_body: lastBody,
            last_message_direction: "outbound",
            last_message_status: "sent",
            updated_at: now,
          })
          .eq("id", conversationId);
      }

      return new Response(
        JSON.stringify({
          success: true,
          message_id: messageId,
          message: insertResult.data ?? null,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message_id: messageId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("send-instagram-message: error", errMsg, err);
    return new Response(
      JSON.stringify({
        error: "Gagal mengirim pesan Instagram. Coba lagi atau cek Connect Instagram.",
        code: "INTERNAL_ERROR",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

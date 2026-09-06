/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const APP_ID_OFFICE = "id.synckerja.app";
const APP_ID_POS = "id.synckerja.pos";

function normalizeAppId(raw: unknown): string {
  const v = typeof raw === "string" ? raw.trim() : "";
  if (v === APP_ID_POS) return APP_ID_POS;
  return APP_ID_OFFICE;
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
    const supabaseWithUser = createClient(supabaseUrl, serviceRoleKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseWithUser.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const fcmToken = typeof body.token === "string" ? body.token.trim() : "";
    const platform = typeof body.platform === "string" ? body.platform.toLowerCase() : "";
    const rawContext = typeof body.context === "string" ? body.context.trim().toLowerCase() : "livechat";
    const context = rawContext === "general" ? "general" : "livechat";
    const appId = normalizeAppId(body.app_id);
    if (!fcmToken || !platform) {
      return new Response(
        JSON.stringify({ error: "Missing token or platform" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (platform !== "android" && platform !== "ios") {
      return new Response(
        JSON.stringify({ error: "platform must be android or ios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // POS must never own livechat tokens (Omnichannel is Office-only).
    if (appId === APP_ID_POS) {
      await supabaseAdmin.from("fcm_tokens").delete().eq("token", fcmToken).eq("context", "livechat");
      if (context === "livechat") {
        return new Response(
          JSON.stringify({ ok: true, skipped: "pos_no_livechat" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // Satu perangkat (satu FCM token) hanya boleh terdaftar untuk satu user per context+app.
    await supabaseAdmin
      .from("fcm_tokens")
      .delete()
      .eq("token", fcmToken)
      .eq("context", context)
      .eq("app_id", appId);

    const { error: upsertError } = await supabaseAdmin.from("fcm_tokens").upsert(
      {
        user_id: user.id,
        token: fcmToken,
        platform,
        context,
        app_id: appId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,token,context,app_id" },
    );

    if (upsertError) {
      console.error("livechat-save-fcm-token: upsert failed", upsertError.message, upsertError);
      return new Response(
        JSON.stringify({ error: upsertError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

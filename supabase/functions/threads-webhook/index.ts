/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

async function verifyThreadsWebhookToken(
  supabase: ReturnType<typeof createClient>,
  token: string,
): Promise<boolean> {
  const trimmed = token.trim();
  if (!trimmed) return false;

  const { data: byThreadsToken } = await supabase
    .from("organization_instagram_accounts")
    .select("id")
    .eq("threads_verify_token", trimmed)
    .eq("is_active", true)
    .eq("has_threads", true)
    .maybeSingle();
  if (byThreadsToken) return true;

  const { data: byVerifyToken } = await supabase
    .from("organization_instagram_accounts")
    .select("id")
    .eq("verify_token", trimmed)
    .eq("is_active", true)
    .eq("has_threads", true)
    .maybeSingle();
  if (byVerifyToken) return true;

  const { data: metaByVerify } = await supabase
    .from("organization_meta_config")
    .select("id")
    .eq("verify_token", trimmed)
    .eq("is_active", true)
    .maybeSingle();
  if (metaByVerify) return true;

  return false;
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  console.log("[threads-webhook] ENTRY", req.method, url.pathname);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    if (req.method === "GET") {
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");

      if (mode !== "subscribe" || !challenge) {
        return new Response("threads-webhook ok", {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "text/plain" },
        });
      }

      const verified = token ? await verifyThreadsWebhookToken(supabase, token) : false;
      if (!verified) {
        console.error("[threads-webhook] GET: verify_token not found");
        return new Response("Forbidden", { status: 403, headers: corsHeaders });
      }

      console.log("[threads-webhook] GET: verification success");
      return new Response(String(challenge), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Threads livechat removed — webhook kept for Meta verification only.
    console.log("[threads-webhook] POST acknowledged (livechat disabled)");
    return new Response(JSON.stringify({ success: true, processed: 0, livechat_disabled: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[threads-webhook] error", err);
    return new Response(JSON.stringify({ error: "Webhook failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});







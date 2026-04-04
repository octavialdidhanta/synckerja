/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const META_GRAPH_BASE = "https://graph.facebook.com/v18.0";

// WhatsApp Cloud API (Graph API): node WhatsAppBusinessPhoneNumber has no "media" field.
// GET /{phone_number_id}/media?type=profile_picture&user_id=... returns 400 (#100).
// Meta does not expose contact profile pictures via this API. Return 404 so UI shows initials.
const CLOUD_API_PROFILE_PICTURE_UNSUPPORTED = true;

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  console.log("[get-whatsapp-profile-photo] ENTRY", req.method, url.pathname);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      console.log("[get-whatsapp-profile-photo] Missing or invalid Authorization");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log("[get-whatsapp-profile-photo] Step 1: Auth header OK");

    const token = authHeader.replace("Bearer ", "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseWithUser = createClient(supabaseUrl, serviceRoleKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: { user }, error: userError } = await supabaseWithUser.auth.getUser(token);
    if (userError || !user) {
      console.log("[get-whatsapp-profile-photo] Invalid token", userError?.message ?? "no user");
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log("[get-whatsapp-profile-photo] Step 2: User OK");

    let conversationId: string | null = null;
    let wantStream = false;
    if (req.method === "GET") {
      conversationId = url.searchParams.get("conversation_id")?.trim() ?? null;
      wantStream = url.searchParams.get("stream") === "1";
    } else {
      const body = await req.json().catch((e) => {
        console.log("[get-whatsapp-profile-photo] Body parse error", String(e));
        return {};
      });
      conversationId = body.conversation_id != null ? String(body.conversation_id).trim() : null;
      wantStream = body.stream === true;
    }
    console.log("[get-whatsapp-profile-photo] Step 3: conversation_id=", conversationId, "stream=", wantStream);
    if (!conversationId) {
      console.log("[get-whatsapp-profile-photo] Missing conversation_id");
      return new Response(
        JSON.stringify({ error: "Missing conversation_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: conv, error: convError } = await supabaseAdmin
      .from("whatsapp_conversations")
      .select("organization_id, phone_number_id, customer_wa_id, channel")
      .eq("id", conversationId)
      .single();

    if (convError || !conv?.phone_number_id || !conv?.customer_wa_id) {
      console.log("[get-whatsapp-profile-photo] Conversation not found", convError?.message ?? "missing fields");
      return new Response(JSON.stringify({ error: "Conversation not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log("[get-whatsapp-profile-photo] Step 4: Conversation OK");

    const { data: accountRows, error: accountError } = await supabaseAdmin
      .from("organization_whatsapp_accounts")
      .select("meta_access_token")
      .eq("organization_id", conv.organization_id)
      .eq("phone_number_id", conv.phone_number_id)
      .eq("is_active", true)
      .limit(1);
    const account = accountRows?.[0] as { meta_access_token?: string } | undefined;

    const accessToken = account?.meta_access_token?.trim();
    if (accountError || !accessToken) {
      console.log("[get-whatsapp-profile-photo] No account token", accountError?.message ?? "no token");
      return new Response(JSON.stringify({ error: "No token for this conversation" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log("[get-whatsapp-profile-photo] Step 5: Account token OK");

    if (CLOUD_API_PROFILE_PICTURE_UNSUPPORTED) {
      console.log("[get-whatsapp-profile-photo] Cloud API does not support contact profile picture (WhatsAppBusinessPhoneNumber has no media field); returning 404");
      return new Response(JSON.stringify({ error: "Profile picture not available" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const phoneNumberId = encodeURIComponent(conv.phone_number_id);
    const userId = encodeURIComponent(conv.customer_wa_id);
    const mediaRes = await fetch(
      `${META_GRAPH_BASE}/${phoneNumberId}/media?type=profile_picture&user_id=${userId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!mediaRes.ok) {
      const errBody = await mediaRes.text().catch(() => "");
      console.log("[get-whatsapp-profile-photo] Meta profile_picture API failed", mediaRes.status, errBody.slice(0, 200));
      return new Response(JSON.stringify({ error: "Profile picture not available" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mediaJson = (await mediaRes.json()) as { id?: string };
    const mediaId = mediaJson?.id;
    if (!mediaId) {
      console.log("[get-whatsapp-profile-photo] Meta returned no media id", JSON.stringify(mediaJson).slice(0, 200));
      return new Response(JSON.stringify({ error: "Profile picture not available" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const urlRes = await fetch(`${META_GRAPH_BASE}/${mediaId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!urlRes.ok) {
      const errBody = await urlRes.text().catch(() => "");
      console.log("[get-whatsapp-profile-photo] Meta media URL fetch failed", urlRes.status, errBody.slice(0, 200));
      return new Response(JSON.stringify({ error: "Failed to get profile picture URL" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const urlJson = (await urlRes.json()) as { url?: string };
    const profileUrl = urlJson?.url;
    if (!profileUrl || typeof profileUrl !== "string") {
      console.log("[get-whatsapp-profile-photo] No profile URL in Meta response", JSON.stringify(urlJson).slice(0, 200));
      return new Response(JSON.stringify({ error: "Profile picture URL not returned" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (wantStream) {
      console.log("[get-whatsapp-profile-photo] Step 6: Fetching image from Meta");
      const imageRes = await fetch(profileUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!imageRes.ok) {
        console.log("[get-whatsapp-profile-photo] Meta image fetch failed", imageRes.status);
        return new Response(JSON.stringify({ error: "Failed to fetch image" }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const contentType = imageRes.headers.get("Content-Type") || "image/jpeg";
      const imageBytes = await imageRes.arrayBuffer();
      console.log("[get-whatsapp-profile-photo] Step 7: Returning image stream", imageBytes.byteLength, "bytes");
      return new Response(imageBytes, {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": contentType },
      });
    }

    return new Response(JSON.stringify({ url: profileUrl }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("get-whatsapp-profile-photo error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

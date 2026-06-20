/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const META_GRAPH_VERSION = "v21.0";

Deno.serve(async (req: Request) => {
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
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    let conversationId: string | null = null;
    let wantStream = false;
    if (req.method === "GET") {
      conversationId = url.searchParams.get("conversation_id")?.trim() ?? null;
      wantStream = url.searchParams.get("stream") === "1";
    } else {
      const body = await req.json().catch(() => ({})) as { conversation_id?: string; stream?: boolean };
      conversationId = body.conversation_id?.trim() ?? null;
      wantStream = body.stream === true;
    }

    if (!conversationId) {
      return new Response(JSON.stringify({ error: "Missing conversation_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: conv, error: convError } = await supabaseAdmin
      .from("instagram_conversations")
      .select("organization_id, instagram_business_account_id, customer_ig_id")
      .eq("id", conversationId)
      .single();

    if (convError || !conv?.customer_ig_id || !conv?.instagram_business_account_id) {
      return new Response(JSON.stringify({ error: "Conversation not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: igAcc } = await supabaseAdmin
      .from("organization_instagram_accounts")
      .select("page_access_token")
      .eq("organization_id", conv.organization_id)
      .eq("instagram_business_account_id", conv.instagram_business_account_id)
      .eq("is_active", true)
      .maybeSingle();

    const accessToken = (igAcc?.page_access_token ?? "").trim();
    if (!accessToken) {
      return new Response(JSON.stringify({ error: "No token for this conversation" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: linkedBizAcc } = await supabaseAdmin
      .from("organization_instagram_accounts")
      .select("instagram_business_account_id")
      .eq("organization_id", conv.organization_id)
      .eq("instagram_business_account_id", conv.customer_ig_id)
      .eq("is_active", true)
      .maybeSingle();

    const isIgBusinessAccount = Boolean(linkedBizAcc?.instagram_business_account_id);
    const profileField = isIgBusinessAccount ? "profile_picture_url" : "profile_pic";

    const graphUrl =
      `https://graph.facebook.com/${META_GRAPH_VERSION}/${encodeURIComponent(conv.customer_ig_id)}` +
      `?fields=${encodeURIComponent(profileField)}` +
      `&access_token=${encodeURIComponent(accessToken)}`;

    const graphRes = await fetch(graphUrl, { method: "GET" });
    const graphData = await graphRes.json().catch(() => ({})) as {
      profile_pic?: string;
      profile_picture_url?: string;
      error?: { message?: string };
    };

    const profileUrlRaw = isIgBusinessAccount ? graphData.profile_picture_url : graphData.profile_pic;
    const profileUrl = typeof profileUrlRaw === "string" ? profileUrlRaw.trim() : "";
    if (!graphRes.ok || !profileUrl) {
      return new Response(JSON.stringify({ error: "Profile picture not available" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (wantStream) {
      const imageRes = await fetch(profileUrl);
      if (!imageRes.ok) {
        return new Response(JSON.stringify({ error: "Failed to fetch image" }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const contentType = imageRes.headers.get("Content-Type") || "image/jpeg";
      const imageBytes = await imageRes.arrayBuffer();
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
    console.error("get-instagram-profile-photo error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

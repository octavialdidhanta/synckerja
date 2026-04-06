/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  const json = (body: object, status: number) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!jwt) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!serviceRoleKey) {
      console.error("google-oauth-manage: SUPABASE_SERVICE_ROLE_KEY missing");
      return json({ error: "Server configuration error" }, 500);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(jwt);
    if (userError || !user) {
      return json({ error: "Invalid or expired session. Please sign in again." }, 401);
    }

    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    const action = body.action != null ? String(body.action).trim() : "";

    if (action === "oauth_client_config") {
      /** Public OAuth web client id (same as Google Cloud). Lets production work when VITE_GOOGLE_CLIENT_ID was missing at build time but GOOGLE_CLIENT_ID is set on Edge Functions. */
      const clientId = (Deno.env.get("GOOGLE_CLIENT_ID") ?? "").trim();
      return json({ clientId }, 200);
    }

    if (action === "status") {
      const { data, error } = await supabaseAdmin
        .from("user_google_oauth_credentials")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) {
        console.error("google-oauth-manage: status read", error.message);
        return json({ error: "Failed to read connection state" }, 500);
      }
      return json({ connected: Boolean(data) }, 200);
    }

    if (action === "disconnect") {
      const { error } = await supabaseAdmin
        .from("user_google_oauth_credentials")
        .delete()
        .eq("user_id", user.id);
      if (error) {
        console.error("google-oauth-manage: disconnect", error.message);
        return json({ error: "Failed to disconnect Google" }, 500);
      }
      return json({ ok: true }, 200);
    }

    return json({ error: "Invalid action" }, 400);
  } catch (e) {
    const err = e as Error;
    console.error("google-oauth-manage:", err.message);
    return json({ error: "Internal server error" }, 500);
  }
});

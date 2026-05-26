/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { googleDriveOAuthRedirectAllowlist } from "../_shared/googleDriveOAuthConfig.ts";

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
      console.error("google-oauth-token: SUPABASE_SERVICE_ROLE_KEY missing");
      return json({ error: "Server configuration error" }, 500);
    }

    const clientId = Deno.env.get("GOOGLE_CLIENT_ID") ?? "";
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "";
    if (!clientId || !clientSecret) {
      console.error("google-oauth-token: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET missing");
      return json({ error: "Google OAuth is not configured on the server" }, 500);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(jwt);
    if (userError || !user) {
      console.error("google-oauth-token: getUser failed", userError?.message ?? userError);
      return json({ error: "Invalid or expired session. Please sign in again." }, 401);
    }

    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    const code = body.code != null ? String(body.code).trim() : "";
    const redirectUri = body.redirect_uri != null ? String(body.redirect_uri).trim() : "";
    if (!code) {
      return json({ error: "Missing code" }, 400);
    }
    if (!redirectUri) {
      return json({ error: "Missing redirect_uri" }, 400);
    }

    const allowed = googleDriveOAuthRedirectAllowlist();
    if (!allowed.includes(redirectUri)) {
      console.warn("google-oauth-token: redirect_uri not allowlisted", redirectUri);
      return json({ error: "redirect_uri is not allowed" }, 400);
    }

    const tokenParams = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    });

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenParams.toString(),
    });

    const tokenJson = (await tokenRes.json()) as Record<string, unknown>;

    if (!tokenRes.ok) {
      const errDesc =
        typeof tokenJson.error_description === "string"
          ? tokenJson.error_description
          : typeof tokenJson.error === "string"
            ? tokenJson.error
            : "Token exchange failed";
      console.error("google-oauth-token: Google token error", errDesc);
      return json({ error: errDesc }, 400);
    }

    const accessToken = typeof tokenJson.access_token === "string" ? tokenJson.access_token : "";
    const refreshToken = typeof tokenJson.refresh_token === "string" ? tokenJson.refresh_token : "";
    const expiresIn = typeof tokenJson.expires_in === "number" ? tokenJson.expires_in : 3600;
    const scope = typeof tokenJson.scope === "string" ? tokenJson.scope : null;

    if (!accessToken) {
      return json({ error: "Google response missing access_token" }, 502);
    }

    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
    const nowIso = new Date().toISOString();
    const patch = {
      access_token: accessToken,
      access_token_expires_at: expiresAt,
      ...(scope != null ? { scope } : {}),
      updated_at: nowIso,
    };

    const { data: existing } = await supabaseAdmin
      .from("user_google_oauth_credentials")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      const updateRow = refreshToken ? { ...patch, refresh_token: refreshToken } : patch;
      const { error: updateError } = await supabaseAdmin
        .from("user_google_oauth_credentials")
        .update(updateRow)
        .eq("user_id", user.id);
      if (updateError) {
        console.error("google-oauth-token: update failed", updateError.message);
        return json({ error: "Failed to store credentials" }, 500);
      }
    } else {
      const { error: insertError } = await supabaseAdmin.from("user_google_oauth_credentials").insert({
        user_id: user.id,
        refresh_token: refreshToken || null,
        ...patch,
      });
      if (insertError) {
        console.error("google-oauth-token: insert failed", insertError.message);
        return json({ error: "Failed to store credentials" }, 500);
      }
    }

    // Do not return refresh_token or access_token to the browser.
    return json(
      {
        ok: true,
        scope,
        has_refresh_token: Boolean(refreshToken),
      },
      200,
    );
  } catch (e) {
    const err = e as Error;
    console.error("google-oauth-token:", err.message);
    return json({ error: "Internal server error" }, 500);
  }
});

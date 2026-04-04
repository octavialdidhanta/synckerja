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
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: { ...corsHeaders, "Content-Length": "2" } });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const appId = Deno.env.get("META_APP_ID");
    const appSecret = Deno.env.get("META_APP_SECRET");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseWithUser = createClient(supabaseUrl, serviceRoleKey, { global: { headers: { Authorization: authHeader } } });
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: { user }, error: userError } = await supabaseWithUser.auth.getUser(authHeader.replace("Bearer ", ""));
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

    const orgId = profile?.active_organization_id ?? null;
    if (!orgId) {
      return new Response(
        JSON.stringify({ error: "No active organization. Select an organization first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json().catch(() => ({})) as { code?: string; redirect_uri?: string; token?: string };
    const directToken = typeof body.token === "string" ? body.token.trim() : "";
    const code = typeof body.code === "string" ? body.code.trim() : "";
    const redirectUriRaw = typeof body.redirect_uri === "string" ? body.redirect_uri.trim() : "";
    const redirectUri = redirectUriRaw.replace(/\/+$/, "");

    if (!directToken && (!appId?.trim() || !appSecret?.trim())) {
      return new Response(
        JSON.stringify({ error: "Meta OAuth not configured (META_APP_ID / META_APP_SECRET)." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let accessToken = "";

    if (directToken) {
      // Business Login flow: token (long_lived_token) sent from client; save directly
      accessToken = directToken;
    } else {
      if (!code) {
        return new Response(
          JSON.stringify({ error: "Missing code (OAuth authorization code) or token (Business Login)." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (!redirectUri) {
        return new Response(
          JSON.stringify({ error: "Missing redirect_uri (must match Meta app callback URL)." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const tokenUrl = `https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token?client_id=${encodeURIComponent(appId ?? "")}&client_secret=${encodeURIComponent(appSecret ?? "")}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${encodeURIComponent(code)}`;
      const tokenRes = await fetch(tokenUrl, { method: "GET" });
      const tokenData = await tokenRes.json().catch(() => ({})) as {
        access_token?: string;
        token_type?: string;
        expires_in?: number;
        error?: { message?: string; code?: number };
      };

      if (!tokenRes.ok || tokenData?.error) {
        const errMsg = tokenData?.error?.message ?? "Meta token exchange failed";
        console.error("meta-oauth-exchange: token exchange failed", errMsg);
        return new Response(
          JSON.stringify({ error: errMsg, code: tokenData?.error?.code }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      accessToken = tokenData?.access_token?.trim() ?? "";
      if (!accessToken) {
        return new Response(
          JSON.stringify({ error: "No access_token in Meta response." }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Exchange for long-lived token (60 days) if short-lived
      const exchangeUrl = `https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token?grant_type=fb_exchange_token&client_id=${encodeURIComponent(appId ?? "")}&client_secret=${encodeURIComponent(appSecret ?? "")}&fb_exchange_token=${encodeURIComponent(accessToken)}`;
      const longRes = await fetch(exchangeUrl, { method: "GET" });
      const longData = await longRes.json().catch(() => ({})) as { access_token?: string; expires_in?: number };
      if (longRes.ok && longData?.access_token?.trim()) {
        accessToken = longData.access_token.trim();
      }
    }

    // All data to organization_instagram_accounts only (no organization_meta_config).
    // Fetch Pages with Instagram and upsert into organization_instagram_accounts.
    // so /operations/consultant/instagram/connect shows connected accounts without extra "Connect" click
    const fields = "id,name,access_token,instagram_business_account{id,username,name}";
    const pagesWithIg: Array<{ pageId: string; pageToken: string; igId: string; username: string | null; name: string | null }> = [];

    function collectPages(pages: Array<{ id?: string; access_token?: string; instagram_business_account?: { id?: string; username?: string; name?: string } }>) {
      for (const page of pages) {
        const ig = page?.instagram_business_account;
        const pageId = page?.id ? String(page.id) : "";
        const pageToken = typeof page?.access_token === "string" ? page.access_token.trim() : "";
        if (ig?.id && pageId && pageToken) {
          pagesWithIg.push({
            pageId,
            pageToken,
            igId: String(ig.id),
            username: typeof ig.username === "string" ? ig.username : null,
            name: typeof ig.name === "string" ? ig.name : null,
          });
        }
      }
    }

    const meUrl = `https://graph.facebook.com/${META_GRAPH_VERSION}/me/accounts?fields=${encodeURIComponent(fields)}`;
    const meRes = await fetch(meUrl, { method: "GET", headers: { Authorization: `Bearer ${accessToken}` } });
    const meData = await meRes.json().catch(() => ({})) as {
      data?: Array<{ id?: string; name?: string; access_token?: string; instagram_business_account?: { id?: string; username?: string; name?: string } }>;
      error?: { message?: string };
    };
    if (meRes.ok && Array.isArray(meData?.data)) {
      collectPages(meData.data);
    }

    for (const row of pagesWithIg) {
      const { data: existingIg } = await supabaseAdmin
        .from("organization_instagram_accounts")
        .select("verify_token")
        .eq("organization_id", orgId)
        .eq("instagram_business_account_id", row.igId)
        .maybeSingle();
      const verifyToken =
        (existingIg as { verify_token?: string } | null)?.verify_token?.trim() ||
        `ig_${orgId.replace(/-/g, "").slice(0, 8)}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
      await supabaseAdmin
        .from("organization_instagram_accounts")
        .upsert(
          {
            organization_id: orgId,
            instagram_business_account_id: row.igId,
            facebook_page_id: row.pageId,
            page_access_token: row.pageToken,
            instagram_username: row.username,
            instagram_name: row.name,
            verify_token: verifyToken,
            is_active: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "organization_id,instagram_business_account_id", ignoreDuplicates: false }
        );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Instagram accounts synced to organization_instagram_accounts.",
        accounts_synced: pagesWithIg.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("meta-oauth-exchange: error", err);
    return new Response(
      JSON.stringify({ error: "Internal error." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

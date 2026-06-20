/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  subscribeInstagramPageToWebhooks,
  type InstagramPageSubscribeResult,
} from "../_shared/metaInstagramPageSubscribe.ts";
import {
  fetchGrantedPermissions,
  metaGraphVersion,
} from "../_shared/metaPlatformScopes.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

async function exchangeForLongLivedToken(
  shortToken: string,
  appId: string,
  appSecret: string,
): Promise<string> {
  const version = metaGraphVersion();
  const exchangeUrl = `https://graph.facebook.com/${version}/oauth/access_token?grant_type=fb_exchange_token&client_id=${encodeURIComponent(appId)}&client_secret=${encodeURIComponent(appSecret)}&fb_exchange_token=${encodeURIComponent(shortToken)}`;
  const longRes = await fetch(exchangeUrl, { method: "GET" });
  const longData = await longRes.json().catch(() => ({})) as { access_token?: string; error?: { message?: string } };
  if (longRes.ok && longData?.access_token?.trim()) {
    return longData.access_token.trim();
  }
  console.warn("meta-oauth-exchange: fb_exchange_token failed, using original token", longData?.error?.message ?? longRes.status);
  return shortToken;
}

type PageRow = {
  pageId: string;
  pageName: string | null;
  pageToken: string;
  igId: string | null;
  igUsername: string | null;
  igName: string | null;
};

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
    const graphVersion = metaGraphVersion();

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
      accessToken = directToken;
      if (appId?.trim() && appSecret?.trim()) {
        accessToken = await exchangeForLongLivedToken(accessToken, appId.trim(), appSecret.trim());
      }
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

      const tokenUrl = `https://graph.facebook.com/${graphVersion}/oauth/access_token?client_id=${encodeURIComponent(appId ?? "")}&client_secret=${encodeURIComponent(appSecret ?? "")}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${encodeURIComponent(code)}`;
      const tokenRes = await fetch(tokenUrl, { method: "GET" });
      const tokenData = await tokenRes.json().catch(() => ({})) as {
        access_token?: string;
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

      accessToken = await exchangeForLongLivedToken(accessToken, appId ?? "", appSecret ?? "");
    }

    const grantedScopes = await fetchGrantedPermissions(accessToken, appId ?? undefined);
    const grantedScopesJson = grantedScopes;

    const fields = "id,name,access_token,instagram_business_account{id,username,name}";
    const pages: PageRow[] = [];

    function collectPages(rawPages: Array<{
      id?: string;
      name?: string;
      access_token?: string;
      instagram_business_account?: { id?: string; username?: string; name?: string };
    }>) {
      for (const page of rawPages) {
        const pageId = page?.id ? String(page.id) : "";
        const pageToken = typeof page?.access_token === "string" ? page.access_token.trim() : "";
        if (!pageId || !pageToken) continue;
        const ig = page?.instagram_business_account;
        pages.push({
          pageId,
          pageName: typeof page.name === "string" ? page.name : null,
          pageToken,
          igId: ig?.id ? String(ig.id) : null,
          igUsername: typeof ig?.username === "string" ? ig.username : null,
          igName: typeof ig?.name === "string" ? ig.name : null,
        });
      }
    }

    const meUrl = `https://graph.facebook.com/${graphVersion}/me/accounts?fields=${encodeURIComponent(fields)}`;
    const meRes = await fetch(meUrl, { method: "GET", headers: { Authorization: `Bearer ${accessToken}` } });
    const meData = await meRes.json().catch(() => ({})) as {
      data?: Array<{
        id?: string;
        name?: string;
        access_token?: string;
        instagram_business_account?: { id?: string; username?: string; name?: string };
      }>;
      error?: { message?: string };
    };
    if (meRes.ok && Array.isArray(meData?.data)) {
      collectPages(meData.data);
    } else if (meData?.error?.message && !meRes.ok) {
      const errMsg = meData.error.message ?? "Meta API error fetching Pages";
      console.error("meta-oauth-exchange: me/accounts failed", errMsg);
      return new Response(
        JSON.stringify({ error: errMsg }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const webhookSubscribeResults: InstagramPageSubscribeResult[] = [];
    let igAccountsSynced = 0;
    let fbPagesSynced = 0;

    for (const row of pages) {
      if (row.igId) {
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
              facebook_page_name: row.pageName,
              page_access_token: row.pageToken,
              instagram_username: row.igUsername,
              instagram_name: row.igName,
              verify_token: verifyToken,
              granted_scopes: grantedScopesJson,
              has_instagram: true,
              is_active: true,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "organization_id,instagram_business_account_id", ignoreDuplicates: false }
          );
        // Mirror page token for Facebook organic + Messenger livechat.
        const { data: existingFb } = await supabaseAdmin
          .from("organization_facebook_pages")
          .select("verify_token")
          .eq("organization_id", orgId)
          .eq("facebook_page_id", row.pageId)
          .maybeSingle();
        const fbVerifyToken =
          (existingFb as { verify_token?: string } | null)?.verify_token?.trim() ||
          `fb_${orgId.replace(/-/g, "").slice(0, 8)}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
        await supabaseAdmin
          .from("organization_facebook_pages")
          .upsert(
            {
              organization_id: orgId,
              facebook_page_id: row.pageId,
              page_name: row.pageName,
              page_access_token: row.pageToken,
              verify_token: fbVerifyToken,
              granted_scopes: grantedScopesJson,
              is_active: true,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "organization_id,facebook_page_id", ignoreDuplicates: false }
          );
        igAccountsSynced += 1;

        const subscribeResult = await subscribeInstagramPageToWebhooks(row.pageId, row.pageToken);
        webhookSubscribeResults.push({
          ...subscribeResult,
          instagramBusinessAccountId: row.igId,
        });
        if (!subscribeResult.success) {
          console.warn("meta-oauth-exchange: page webhook subscribe failed", row.pageId, subscribeResult.error);
        }
      } else {
        const { data: existingFb } = await supabaseAdmin
          .from("organization_facebook_pages")
          .select("verify_token")
          .eq("organization_id", orgId)
          .eq("facebook_page_id", row.pageId)
          .maybeSingle();
        const fbVerifyToken =
          (existingFb as { verify_token?: string } | null)?.verify_token?.trim() ||
          `fb_${orgId.replace(/-/g, "").slice(0, 8)}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
        await supabaseAdmin
          .from("organization_facebook_pages")
          .upsert(
            {
              organization_id: orgId,
              facebook_page_id: row.pageId,
              page_name: row.pageName,
              page_access_token: row.pageToken,
              verify_token: fbVerifyToken,
              granted_scopes: grantedScopesJson,
              is_active: true,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "organization_id,facebook_page_id", ignoreDuplicates: false }
          );
        fbPagesSynced += 1;

        const subscribeResult = await subscribeInstagramPageToWebhooks(row.pageId, row.pageToken);
        webhookSubscribeResults.push(subscribeResult);
        if (!subscribeResult.success) {
          console.warn("meta-oauth-exchange: FB-only page webhook subscribe failed", row.pageId, subscribeResult.error);
        }
      }
    }

    const accountsSynced = igAccountsSynced;
    const totalPagesSynced = igAccountsSynced + fbPagesSynced;
    const webhookSubscribedCount = webhookSubscribeResults.filter((r) => r.success).length;
    const responseBody: Record<string, unknown> = {
      success: true,
      message: accountsSynced > 0 || fbPagesSynced > 0
        ? "Meta accounts synced."
        : "OAuth token valid but no Facebook Pages found.",
      accounts_synced: accountsSynced,
      facebook_pages_synced: fbPagesSynced,
      granted_scopes: grantedScopes,
      webhook_subscribed_count: webhookSubscribedCount,
      webhook_subscribe_results: webhookSubscribeResults,
    };
    if (accountsSynced === 0 && fbPagesSynced === 0) {
      responseBody.warning =
        "No Facebook Pages were found. Ensure your login has Page admin access and pages_show_list is granted.";
    } else if (totalPagesSynced > 0 && webhookSubscribedCount < totalPagesSynced) {
      responseBody.warning =
        "Accounts synced but Page webhook subscription failed for some Pages. Grant pages_manage_metadata and reconnect.";
    }

    return new Response(
      JSON.stringify(responseBody),
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

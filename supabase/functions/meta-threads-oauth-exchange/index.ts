/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { THREADS_OAUTH_SCOPE_LIST } from "../_shared/metaPlatformScopes.ts";
import {
  isThreadsAppConfigured,
  threadsAppConfigErrorMessage,
  threadsAppId,
  threadsAppSecret,
} from "../_shared/threadsAppCredentials.ts";
import {
  exchangeThreadsAuthCode,
  exchangeThreadsLongLivedToken,
  fetchThreadsProfile,
} from "../_shared/threadsContentApi.ts";
import { encryptThreadsContentToken } from "../_shared/threadsContentConfigCrypto.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

function parseGrantedScopes(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      return [];
    }
  }
  return [];
}

function mergeGrantedScopes(existing: unknown, extra: readonly string[]): string[] {
  return [...new Set([...parseGrantedScopes(existing), ...extra])];
}

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
    const appId = threadsAppId();
    const appSecret = threadsAppSecret();
    if (!isThreadsAppConfigured()) {
      return new Response(JSON.stringify({ error: threadsAppConfigErrorMessage() }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({})) as {
      code?: string;
      redirect_uri?: string;
    };
    const code = body?.code?.trim() ?? "";
    const redirectUri = body?.redirect_uri?.trim() ?? "";
    if (!code || !redirectUri) {
      return new Response(JSON.stringify({ error: "code and redirect_uri are required." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseWithUser = createClient(supabaseUrl, serviceRoleKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: userData, error: userErr } = await supabaseWithUser.auth.getUser();
    if (userErr || !userData?.user?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: membership, error: membershipErr } = await supabaseAdmin
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", userData.user.id)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    const orgId = membership?.organization_id?.trim() ?? "";
    if (membershipErr || !orgId) {
      return new Response(JSON.stringify({ error: "Organization not found." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const shortLived = await exchangeThreadsAuthCode(code, redirectUri, appId, appSecret);
    const threadsExchanged = await exchangeThreadsLongLivedToken(shortLived.access_token, appSecret);
    const threadsToken = threadsExchanged.access_token;
    const profile = await fetchThreadsProfile(threadsToken);
    const tokenEnc = await encryptThreadsContentToken(threadsToken);
    const tokenExpiresAt = threadsExchanged.expires_in
      ? new Date(Date.now() + threadsExchanged.expires_in * 1000).toISOString()
      : null;
    const nowIso = new Date().toISOString();

    const { data: igRows, error: igErr } = await supabaseAdmin
      .from("organization_instagram_accounts")
      .select("id, granted_scopes")
      .eq("organization_id", orgId)
      .eq("is_active", true);

    if (igErr) {
      return new Response(JSON.stringify({ error: igErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rows = igRows ?? [];
    if (rows.length === 0) {
      return new Response(
        JSON.stringify({
          error: "Connect Instagram with Facebook first, then authorize Threads.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    let threadsAccountsSynced = 0;
    for (const row of rows) {
      const mergedScopes = mergeGrantedScopes(row.granted_scopes, THREADS_OAUTH_SCOPE_LIST);
      const { error: updateErr } = await supabaseAdmin
        .from("organization_instagram_accounts")
        .update({
          threads_user_id: profile.id,
          threads_username: profile.username,
          threads_profile_picture_url: profile.threads_profile_picture_url,
          has_threads: true,
          threads_access_token_enc: tokenEnc,
          threads_token_expires_at: tokenExpiresAt,
          granted_scopes: mergedScopes,
          updated_at: nowIso,
        })
        .eq("id", row.id);
      if (!updateErr) threadsAccountsSynced += 1;
      else console.warn("meta-threads-oauth-exchange: save failed", row.id, updateErr.message);
    }

    return new Response(
      JSON.stringify({
        success: true,
        threads_accounts_synced: threadsAccountsSynced,
        threads_username: profile.username,
        granted_scopes: [...THREADS_OAUTH_SCOPE_LIST],
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("meta-threads-oauth-exchange: error", err);
    const message = err instanceof Error ? err.message : "Internal error.";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

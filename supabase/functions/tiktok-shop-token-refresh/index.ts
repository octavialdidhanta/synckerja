/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getTikTokShopAccessToken } from "../_shared/tiktokShopOrgResolver.ts";

const BATCH_LIMIT = 50;
const ACCESS_REFRESH_WITHIN_MS = 2 * 24 * 60 * 60 * 1000; // 2 days

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(), "Content-Type": "application/json" },
  });
}

function isAuthorized(req: Request): boolean {
  const auth = (req.headers.get("Authorization") ?? "").trim();
  if (!auth.toLowerCase().startsWith("bearer ")) return false;
  const token = auth.slice(7).trim();
  if (!token) return false;

  const serviceRole = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();
  if (serviceRole && token === serviceRole) return true;

  const cronSecret = (Deno.env.get("TIKTOK_SHOP_TOKEN_REFRESH_SECRET") ?? "").trim();
  if (cronSecret && token === cronSecret) return true;

  // Reuse TikTok content scheduler secret when dedicated secret is unset.
  const scheduledSecret = (Deno.env.get("SCHEDULED_POSTS_INTERNAL_SECRET") ?? "").trim();
  if (scheduledSecret && token === scheduledSecret) return true;

  return false;
}

type TokenCandidate = {
  organization_id: string;
  seller_open_id: string;
  access_token_expires_at: string | null;
  refresh_token_expires_at: string | null;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders() });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }
  if (!isAuthorized(req)) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "Server misconfigured" }, 500);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const now = Date.now();

  // Fetch a modest page and filter in-process (avoids fragile PostgREST timestamp OR syntax).
  const { data: rows, error } = await admin
    .from("organization_tiktok_shop_connection_tokens")
    .select(
      "organization_id, seller_open_id, access_token_expires_at, refresh_token_expires_at",
    )
    .order("access_token_expires_at", { ascending: true, nullsFirst: true })
    .limit(200);

  if (error) {
    console.error("tiktok-shop-token-refresh query:", error.message);
    return json({ error: error.message }, 500);
  }

  const candidates = ((rows ?? []) as TokenCandidate[])
    .filter((row) => {
      if (!row.organization_id || !row.seller_open_id) return false;
      if (row.refresh_token_expires_at) {
        const refreshMs = new Date(row.refresh_token_expires_at).getTime();
        if (Number.isFinite(refreshMs) && refreshMs < now) return false;
      }
      if (!row.access_token_expires_at) return true;
      const accessMs = new Date(row.access_token_expires_at).getTime();
      if (!Number.isFinite(accessMs)) return true;
      return accessMs < now + ACCESS_REFRESH_WITHIN_MS;
    })
    .slice(0, BATCH_LIMIT);

  let refreshed = 0;
  let failed = 0;
  const failures: Array<{ organization_id: string; seller_open_id: string }> = [];

  for (const row of candidates) {
    try {
      const token = await getTikTokShopAccessToken(
        admin,
        row.organization_id,
        row.seller_open_id,
        { forceRefresh: true },
      );
      if (token) {
        refreshed += 1;
      } else {
        failed += 1;
        failures.push({
          organization_id: row.organization_id,
          seller_open_id: row.seller_open_id,
        });
      }
    } catch (e) {
      failed += 1;
      failures.push({
        organization_id: row.organization_id,
        seller_open_id: row.seller_open_id,
      });
      console.error(
        "tiktok-shop-token-refresh seller:",
        row.organization_id,
        row.seller_open_id,
        e instanceof Error ? e.message : e,
      );
    }
  }

  return json({
    ok: true,
    examined: candidates.length,
    refreshed,
    failed,
    failures: failures.slice(0, 20),
  });
});

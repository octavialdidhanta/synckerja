/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getThreadsAccessToken } from "../_shared/threadsContentAuth.ts";
import type { ThreadsWebhookAccount } from "../_shared/threadsLivechatWebhook.ts";
import { syncThreadsLivechatInboundForOrg } from "../_shared/threadsLivechatSync.ts";
import { requireThreadsPlatformConfigured } from "../_shared/threadsContentAuth.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function isAuthorized(req: Request): boolean {
  const auth = req.headers.get("Authorization")?.trim() ?? "";
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() ?? "";
  const cronSecret = Deno.env.get("THREADS_LIVECHAT_CRON_SECRET")?.trim() ?? "";
  if (serviceRole && auth === `Bearer ${serviceRole}`) return true;
  if (cronSecret && auth === `Bearer ${cronSecret}`) return true;
  return false;
}

async function listAllThreadsOrgs(admin: ReturnType<typeof createClient>): Promise<
  Array<{ organization_id: string; threads_user_id: string; threads_username: string | null; instagram_username: string | null; instagram_name: string | null }>
> {
  const { data: rows, error } = await admin
    .from("organization_instagram_accounts")
    .select("organization_id, threads_user_id, threads_username, instagram_username, instagram_name")
    .eq("is_active", true)
    .eq("has_threads", true);
  if (error) throw new Error(error.message);

  const seen = new Set<string>();
  const out: Array<{
    organization_id: string;
    threads_user_id: string;
    threads_username: string | null;
    instagram_username: string | null;
    instagram_name: string | null;
  }> = [];

  for (const row of rows ?? []) {
    const r = row as Record<string, unknown>;
    const orgId = String(r.organization_id ?? "").trim();
    const threadsUserId = String(r.threads_user_id ?? "").trim();
    const key = `${orgId}:${threadsUserId}`;
    if (!orgId || !threadsUserId || seen.has(key)) continue;
    seen.add(key);
    out.push({
      organization_id: orgId,
      threads_user_id: threadsUserId,
      threads_username: typeof r.threads_username === "string" ? r.threads_username : null,
      instagram_username: typeof r.instagram_username === "string" ? r.instagram_username : null,
      instagram_name: typeof r.instagram_name === "string" ? r.instagram_name : null,
    });
  }
  return out;
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
  if (!isAuthorized(req)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const platformForbidden = requireThreadsPlatformConfigured();
  if (platformForbidden) return platformForbidden;

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const admin = createClient(supabaseUrl, serviceRoleKey);

  try {
    const orgAccounts = await listAllThreadsOrgs(admin);
    const byOrg = new Map<string, ThreadsWebhookAccount[]>();
    for (const row of orgAccounts) {
      const list = byOrg.get(row.organization_id) ?? [];
      list.push({
        organization_id: row.organization_id,
        threads_user_id: row.threads_user_id,
        threads_username: row.threads_username,
        instagram_username: row.instagram_username,
        instagram_name: row.instagram_name,
      });
      byOrg.set(row.organization_id, list);
    }

    let totalIngested = 0;
    let totalScannedPosts = 0;
    let totalScannedReplies = 0;
    const orgResults: Array<Record<string, unknown>> = [];

    for (const [organizationId, accounts] of byOrg.entries()) {
      const result = await syncThreadsLivechatInboundForOrg(
        admin,
        organizationId,
        (threadsUserId) => getThreadsAccessToken(admin, organizationId, threadsUserId),
        accounts,
        { lookbackDays: 90, maxPosts: 50 },
      );
      totalIngested += result.ingested;
      totalScannedPosts += result.scanned_posts;
      totalScannedReplies += result.scanned_replies;
      orgResults.push({ organization_id: organizationId, ...result });
    }

    console.log("[threads-livechat-sync-cron]", {
      orgs: orgResults.length,
      totalIngested,
      totalScannedPosts,
      totalScannedReplies,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        orgs: orgResults.length,
        ingested: totalIngested,
        scanned_posts: totalScannedPosts,
        scanned_replies: totalScannedReplies,
        results: orgResults,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[threads-livechat-sync-cron] error", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

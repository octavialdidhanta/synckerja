/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getUserFromBearer,
  requireActiveOrg,
  requireTikTokAdsPlatformConfigured,
  tiktokAdsCorsHeaders,
  tiktokAdsJson,
} from "../_shared/tiktokAdsAuth.ts";
import { attachTikTokAdThumbnails } from "../_shared/tiktokAdsApi.ts";
import { resolveOrgTikTokAdsForMetrics } from "../_shared/tiktokAdsOrgResolver.ts";

const MAX_ADS = 200;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: tiktokAdsCorsHeaders });
  }
  if (req.method !== "POST") {
    return tiktokAdsJson({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    return tiktokAdsJson({ error: "Server misconfigured" }, 500);
  }

  const platformForbidden = requireTikTokAdsPlatformConfigured();
  if (platformForbidden) return platformForbidden;

  const admin = createClient(supabaseUrl, serviceRoleKey);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return tiktokAdsJson({ error: "Invalid JSON body" }, 400);
  }

  const organizationId = String(body.organization_id ?? "").trim();
  if (!organizationId) return tiktokAdsJson({ error: "Missing organization_id" }, 400);

  const bearer = await getUserFromBearer(admin, req.headers.get("Authorization"));
  if ("error" in bearer) return bearer.error;
  const orgForbidden = await requireActiveOrg(admin, bearer.userId, organizationId);
  if (orgForbidden) return orgForbidden;

  const advertiserId = body.advertiser_id != null ? String(body.advertiser_id).trim() : null;
  const adIds = Array.isArray(body.ad_ids)
    ? [...new Set(body.ad_ids.map((id) => String(id ?? "").trim()).filter(Boolean))].slice(0, MAX_ADS)
    : [];
  if (adIds.length === 0) return tiktokAdsJson({ thumbnails: {} }, 200);

  const resolved = await resolveOrgTikTokAdsForMetrics(admin, organizationId, advertiserId);
  if (!resolved) {
    return tiktokAdsJson({ error: "TikTok Ads not connected or no account configured" }, 400);
  }

  const rows = adIds.map((adId) => ({ ad_id: adId }));
  await attachTikTokAdThumbnails(resolved.accessToken, resolved.account.advertiser_id, rows);

  const thumbnails: Record<string, string> = {};
  for (const row of rows) {
    const url = String(row.thumbnail_url ?? "").trim();
    if (url) thumbnails[String(row.ad_id)] = url;
  }
  return tiktokAdsJson({ thumbnails }, 200);
});

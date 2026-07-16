/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getUserFromBearer,
  isTikTokAdsPlatformConfigured,
  readPlatformTikTokAdsOAuth,
  requireActiveOrg,
  requireOrgAdmin,
  requireTikTokAdsPlatformConfigured,
  tiktokAdsCorsHeaders,
  tiktokAdsJson,
} from "../_shared/tiktokAdsAuth.ts";
import { getTikTokAdsAccessToken } from "../_shared/tiktokAdsOrgResolver.ts";
import { fetchTikTokIntegratedReport, listTikTokAdvertisers } from "../_shared/tiktokAdsApi.ts";

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

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

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const userRes = await getUserFromBearer(admin, req.headers.get("Authorization"));
  if ("error" in userRes) return userRes.error;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return tiktokAdsJson({ error: "Invalid JSON body" }, 400);
  }

  const action = String(body.action ?? "").trim();
  const organizationId = String(body.organization_id ?? "").trim();
  if (!organizationId) return tiktokAdsJson({ error: "Missing organization_id" }, 400);

  const orgForbidden = await requireActiveOrg(admin, userRes.userId, organizationId);
  if (orgForbidden) return orgForbidden;

  const adminForbidden = await requireOrgAdmin(admin, userRes.userId, organizationId);
  if (adminForbidden) return adminForbidden;

  if (action === "getSettings") {
    const { data: connection } = await admin
      .from("organization_tiktok_ads_connections")
      .select(
        "organization_id, tiktok_user_id, is_active, oauth_connected_at, last_test_at, last_test_ok, last_test_error, updated_at",
      )
      .eq("organization_id", organizationId)
      .maybeSingle();

    const { data: accounts } = await admin
      .from("organization_tiktok_ads_accounts")
      .select("id, label, advertiser_id, pixel_code, is_default, sort_order, is_active, created_at, updated_at")
      .eq("organization_id", organizationId)
      .order("sort_order", { ascending: true });

    const { data: tokenRow } = await admin
      .from("organization_tiktok_ads_connection_tokens")
      .select("organization_id")
      .eq("organization_id", organizationId)
      .maybeSingle();

    const oauthConnected = Boolean(tokenRow?.organization_id);

    return tiktokAdsJson({
      connection: connection ?? null,
      oauthConnected,
      accounts: oauthConnected ? (accounts ?? []) : [],
      serverConfigured: isTikTokAdsPlatformConfigured(),
    }, 200);
  }

  if (action === "disconnect") {
    await admin.from("organization_tiktok_ads_connection_tokens").delete().eq("organization_id", organizationId);
    await admin.from("organization_tiktok_ads_connections").upsert({
      organization_id: organizationId,
      oauth_connected_at: null,
      is_active: false,
      updated_at: new Date().toISOString(),
    }, { onConflict: "organization_id" });
    await admin
      .from("organization_tiktok_ads_accounts")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("organization_id", organizationId);
    return tiktokAdsJson({ ok: true }, 200);
  }

  if (action === "updateConnection") {
    const hasIsActive = Object.prototype.hasOwnProperty.call(body, "is_active");
    if (!hasIsActive) return tiktokAdsJson({ error: "Nothing to update" }, 400);
    const { error } = await admin
      .from("organization_tiktok_ads_connections")
      .update({ is_active: body.is_active === true, updated_at: new Date().toISOString() })
      .eq("organization_id", organizationId);
    if (error) return tiktokAdsJson({ error: error.message }, 500);
    return tiktokAdsJson({ ok: true }, 200);
  }

  if (action === "upsertAccount") {
    const id = body.id != null ? String(body.id).trim() : "";
    const label = String(body.label ?? "").trim();
    const advertiserId = digitsOnly(String(body.advertiser_id ?? ""));
    const pixelCode = body.pixel_code != null ? String(body.pixel_code).trim() : null;
    const isDefault = body.is_default === true;
    const isActive = body.is_active !== false;
    if (!advertiserId) return tiktokAdsJson({ error: "advertiser_id is required" }, 400);

    if (isDefault) {
      await admin.from("organization_tiktok_ads_accounts").update({ is_default: false }).eq("organization_id", organizationId);
    }

    const row = {
      ...(id ? { id } : {}),
      organization_id: organizationId,
      label: label || advertiserId,
      advertiser_id: advertiserId,
      pixel_code: pixelCode,
      is_default: isDefault,
      is_active: isActive,
      updated_at: new Date().toISOString(),
    };

    const { error } = id
      ? await admin.from("organization_tiktok_ads_accounts").update(row).eq("id", id)
      : await admin.from("organization_tiktok_ads_accounts").insert(row);
    if (error) return tiktokAdsJson({ error: error.message }, 500);
    return tiktokAdsJson({ ok: true }, 200);
  }

  if (action === "deleteAccount") {
    const accountId = String(body.account_id ?? "").trim();
    if (!accountId) return tiktokAdsJson({ error: "Missing account_id" }, 400);
    const { error } = await admin
      .from("organization_tiktok_ads_accounts")
      .delete()
      .eq("id", accountId)
      .eq("organization_id", organizationId);
    if (error) return tiktokAdsJson({ error: error.message }, 500);
    return tiktokAdsJson({ ok: true }, 200);
  }

  if (action === "setDefaultAccount") {
    const accountId = String(body.account_id ?? "").trim();
    if (!accountId) return tiktokAdsJson({ error: "Missing account_id" }, 400);
    await admin.from("organization_tiktok_ads_accounts").update({ is_default: false }).eq("organization_id", organizationId);
    const { error } = await admin
      .from("organization_tiktok_ads_accounts")
      .update({ is_default: true, updated_at: new Date().toISOString() })
      .eq("id", accountId)
      .eq("organization_id", organizationId);
    if (error) return tiktokAdsJson({ error: error.message }, 500);
    return tiktokAdsJson({ ok: true }, 200);
  }

  const platformForbidden = requireTikTokAdsPlatformConfigured();
  if (platformForbidden) return platformForbidden;
  const oauth = readPlatformTikTokAdsOAuth()!;

  if (action === "listAccessibleAdvertisers") {
    const accessToken = await getTikTokAdsAccessToken(admin, organizationId);
    if (!accessToken) return tiktokAdsJson({ error: "Connect TikTok Ads first" }, 400);
    const advertisers = await listTikTokAdvertisers(accessToken, oauth.appId, oauth.appSecret);
    return tiktokAdsJson({
      advertisers: advertisers.map((a) => ({
        advertiser_id: a.advertiser_id,
        name: a.advertiser_name,
      })),
    }, 200);
  }

  if (action === "syncAccessibleAccounts") {
    const accessToken = await getTikTokAdsAccessToken(admin, organizationId);
    if (!accessToken) return tiktokAdsJson({ error: "Connect TikTok Ads first" }, 400);
    const remote = await listTikTokAdvertisers(accessToken, oauth.appId, oauth.appSecret);
    const { data: existing } = await admin
      .from("organization_tiktok_ads_accounts")
      .select("advertiser_id")
      .eq("organization_id", organizationId);
    const existingIds = new Set((existing ?? []).map((r) => String((r as { advertiser_id: string }).advertiser_id)));
    let imported = 0;
    const skipped: Array<{ advertiser_id: string; reason: string }> = [];

    for (const acc of remote) {
      const id = digitsOnly(acc.advertiser_id);
      if (!id) continue;
      if (existingIds.has(id)) {
        skipped.push({ advertiser_id: id, reason: "already_exists" });
        continue;
      }
      const { error } = await admin.from("organization_tiktok_ads_accounts").insert({
        organization_id: organizationId,
        label: acc.advertiser_name?.trim() || id,
        advertiser_id: id,
        is_default: existingIds.size === 0 && imported === 0,
        is_active: true,
      });
      if (error) skipped.push({ advertiser_id: id, reason: error.message });
      else {
        imported++;
        existingIds.add(id);
      }
    }

    const { data: accounts } = await admin
      .from("organization_tiktok_ads_accounts")
      .select("*")
      .eq("organization_id", organizationId);
    return tiktokAdsJson({ imported, skipped, accounts: accounts ?? [] }, 200);
  }

  if (action === "testConnection") {
    const accessToken = await getTikTokAdsAccessToken(admin, organizationId);
    const now = new Date().toISOString();
    if (!accessToken) {
      await admin.from("organization_tiktok_ads_connections").update({
        last_test_at: now,
        last_test_ok: false,
        last_test_error: "Not connected",
        updated_at: now,
      }).eq("organization_id", organizationId);
      return tiktokAdsJson({ ok: false, error: "Not connected" }, 400);
    }

    const { data: def } = await admin
      .from("organization_tiktok_ads_accounts")
      .select("advertiser_id")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .eq("is_default", true)
      .maybeSingle();
    const advertiserId = def?.advertiser_id ? String(def.advertiser_id) : "";

    try {
      if (advertiserId) {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 6);
        const fmt = (d: Date) => d.toISOString().slice(0, 10);
        await fetchTikTokIntegratedReport(accessToken, advertiserId, "campaign", fmt(start), fmt(end));
      } else {
        await listTikTokAdvertisers(accessToken, oauth.appId, oauth.appSecret);
      }
      await admin.from("organization_tiktok_ads_connections").update({
        last_test_at: now,
        last_test_ok: true,
        last_test_error: null,
        updated_at: now,
      }).eq("organization_id", organizationId);
      return tiktokAdsJson({ ok: true }, 200);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await admin.from("organization_tiktok_ads_connections").update({
        last_test_at: now,
        last_test_ok: false,
        last_test_error: msg,
        updated_at: now,
      }).eq("organization_id", organizationId);
      return tiktokAdsJson({ ok: false, error: msg }, 400);
    }
  }

  return tiktokAdsJson({ error: "Unknown action" }, 400);
});

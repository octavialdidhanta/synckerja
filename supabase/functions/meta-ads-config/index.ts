/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getUserFromBearer,
  metaAdsCorsHeaders,
  metaAdsJson,
  metaGraphVersion,
  readPlatformMetaAdsOAuth,
  requireOrgAdmin,
} from "../_shared/metaAdsAuth.ts";
import { getMetaAdsAccessToken, metaActId } from "../_shared/metaAdsOrgResolver.ts";

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

async function graphGet(accessToken: string, path: string): Promise<unknown> {
  const v = metaGraphVersion();
  const sep = path.includes("?") ? "&" : "?";
  const url = `https://graph.facebook.com/${v}/${path}${sep}access_token=${encodeURIComponent(accessToken)}`;
  const res = await fetch(url);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (json as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

/** First ad pixel on the ad account (Meta Dataset / Pixel ID). */
async function resolveFirstPixelId(
  accessToken: string,
  adAccountId: string,
): Promise<string | null> {
  try {
    const act = metaActId(adAccountId);
    const data = await graphGet(accessToken, `${act}/adspixels?fields=id,name&limit=25`);
    const pixels = (data as { data?: Array<{ id?: string }> })?.data ?? [];
    if (pixels.length === 0) return null;
    const id = digitsOnly(String(pixels[0].id ?? ""));
    return id || null;
  } catch {
    return null;
  }
}

async function backfillMissingPixelIds(
  admin: ReturnType<typeof createClient>,
  organizationId: string,
  accessToken: string,
): Promise<number> {
  const { data: rows } = await admin
    .from("organization_meta_ads_accounts")
    .select("id, ad_account_id, pixel_id")
    .eq("organization_id", organizationId)
    .eq("pixel_id", "0");

  let resolved = 0;
  for (const row of rows ?? []) {
    const adId = String((row as { ad_account_id: string }).ad_account_id);
    const pixelId = await resolveFirstPixelId(accessToken, adId);
    if (!pixelId) continue;
    const { error } = await admin
      .from("organization_meta_ads_accounts")
      .update({
        pixel_id: pixelId,
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", (row as { id: string }).id)
      .eq("organization_id", organizationId);
    if (!error) resolved++;
  }
  return resolved;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: metaAdsCorsHeaders });
  }
  if (req.method !== "POST") {
    return metaAdsJson({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    return metaAdsJson({ error: "Server misconfigured" }, 500);
  }

  if (!readPlatformMetaAdsOAuth()) {
    return metaAdsJson({ error: "Meta Ads is not configured on the server" }, 503);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const userRes = await getUserFromBearer(admin, req.headers.get("Authorization"));
  if ("error" in userRes) return userRes.error;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return metaAdsJson({ error: "Invalid JSON body" }, 400);
  }

  const action = String(body.action ?? "").trim();
  const organizationId = String(body.organization_id ?? "").trim();
  if (!organizationId) {
    return metaAdsJson({ error: "Missing organization_id" }, 400);
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("active_organization_id")
    .eq("user_id", userRes.userId)
    .maybeSingle();
  const activeOrg = profile?.active_organization_id != null ? String(profile.active_organization_id) : "";
  if (!activeOrg || activeOrg !== organizationId) {
    return metaAdsJson({ error: "Forbidden" }, 403);
  }

  const forbidden = await requireOrgAdmin(admin, userRes.userId, organizationId);
  if (forbidden) return forbidden;

  if (action === "getSettings") {
    const { data: connection } = await admin
      .from("organization_meta_ads_connections")
      .select(
        "organization_id, meta_user_id, is_active, oauth_connected_at, last_test_at, last_test_ok, last_test_error, updated_at",
      )
      .eq("organization_id", organizationId)
      .maybeSingle();

    const { data: accounts } = await admin
      .from("organization_meta_ads_accounts")
      .select(
        "id, label, ad_account_id, pixel_id, default_event_name, is_default, sort_order, is_active, created_at, updated_at",
      )
      .eq("organization_id", organizationId)
      .order("sort_order", { ascending: true });

    const { data: tokenRow } = await admin
      .from("organization_meta_ads_connection_tokens")
      .select("organization_id")
      .eq("organization_id", organizationId)
      .maybeSingle();

    const oauthConnected = Boolean(tokenRow?.organization_id);

    return metaAdsJson({
      connection: connection ?? null,
      oauthConnected,
      accounts: oauthConnected ? (accounts ?? []) : [],
    }, 200);
  }

  if (action === "disconnect") {
    await admin.from("organization_meta_ads_connection_tokens").delete().eq("organization_id", organizationId);
    await admin.from("organization_meta_ads_connections").upsert({
      organization_id: organizationId,
      oauth_connected_at: null,
      is_active: false,
      updated_at: new Date().toISOString(),
    }, { onConflict: "organization_id" });
    await admin
      .from("organization_meta_ads_accounts")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("organization_id", organizationId);
    return metaAdsJson({ ok: true }, 200);
  }

  if (action === "updateConnection") {
    const hasIsActive = Object.prototype.hasOwnProperty.call(body, "is_active");
    if (!hasIsActive) return metaAdsJson({ error: "Nothing to update" }, 400);

    const { data: existing } = await admin
      .from("organization_meta_ads_connections")
      .select("organization_id")
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (!existing?.organization_id) {
      return metaAdsJson({ error: "Connect Meta Ads first" }, 400);
    }

    const { error } = await admin
      .from("organization_meta_ads_connections")
      .update({
        is_active: body.is_active === true,
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", organizationId);
    if (error) return metaAdsJson({ error: error.message }, 500);
    return metaAdsJson({ ok: true }, 200);
  }

  if (action === "upsertAccount") {
    const id = body.id != null ? String(body.id).trim() : "";
    const label = String(body.label ?? "").trim();
    const adAccountId = digitsOnly(String(body.ad_account_id ?? ""));
    const pixelId = digitsOnly(String(body.pixel_id ?? ""));
    const defaultEventName = String(body.default_event_name ?? "Purchase").trim() || "Purchase";
    const isDefault = body.is_default === true;
    const isActive = body.is_active !== false;

    if (!adAccountId) return metaAdsJson({ error: "ad_account_id is required" }, 400);
    if (!pixelId) return metaAdsJson({ error: "pixel_id is required" }, 400);

    if (isDefault) {
      await admin
        .from("organization_meta_ads_accounts")
        .update({ is_default: false })
        .eq("organization_id", organizationId);
    }

    const row = {
      ...(id ? { id } : {}),
      organization_id: organizationId,
      label: label || adAccountId,
      ad_account_id: adAccountId,
      pixel_id: pixelId,
      default_event_name: defaultEventName,
      is_default: isDefault,
      is_active: isActive,
      updated_at: new Date().toISOString(),
    };

    const { error } = id
      ? await admin.from("organization_meta_ads_accounts").update(row).eq("id", id)
      : await admin.from("organization_meta_ads_accounts").insert(row);
    if (error) return metaAdsJson({ error: error.message }, 500);
    return metaAdsJson({ ok: true }, 200);
  }

  if (action === "deleteAccount") {
    const accountId = String(body.account_id ?? "").trim();
    if (!accountId) return metaAdsJson({ error: "Missing account_id" }, 400);
    const { error } = await admin
      .from("organization_meta_ads_accounts")
      .delete()
      .eq("id", accountId)
      .eq("organization_id", organizationId);
    if (error) return metaAdsJson({ error: error.message }, 500);
    return metaAdsJson({ ok: true }, 200);
  }

  if (action === "setDefaultAccount") {
    const accountId = String(body.account_id ?? "").trim();
    if (!accountId) return metaAdsJson({ error: "Missing account_id" }, 400);
    await admin
      .from("organization_meta_ads_accounts")
      .update({ is_default: false })
      .eq("organization_id", organizationId);
    const { error } = await admin
      .from("organization_meta_ads_accounts")
      .update({ is_default: true, updated_at: new Date().toISOString() })
      .eq("id", accountId)
      .eq("organization_id", organizationId);
    if (error) return metaAdsJson({ error: error.message }, 500);
    return metaAdsJson({ ok: true }, 200);
  }

  if (action === "listAccessibleAdAccounts") {
    const accessToken = await getMetaAdsAccessToken(admin, organizationId);
    if (!accessToken) return metaAdsJson({ error: "Connect Meta Ads first" }, 400);
    const data = await graphGet(accessToken, "me?fields=adaccounts{name,account_id,account_status,currency}");
    const accounts = (data as { adaccounts?: { data?: Array<{ account_id?: string; name?: string; currency?: string }> } })
      ?.adaccounts?.data ?? [];
    return metaAdsJson({
      adAccounts: accounts.map((a) => ({
        account_id: a.account_id ?? "",
        name: a.name ?? "",
        currency: a.currency ?? "",
      })),
    }, 200);
  }

  if (action === "listPixels") {
    const adAccountId = digitsOnly(String(body.ad_account_id ?? ""));
    if (!adAccountId) return metaAdsJson({ error: "Missing ad_account_id" }, 400);
    const accessToken = await getMetaAdsAccessToken(admin, organizationId);
    if (!accessToken) return metaAdsJson({ error: "Connect Meta Ads first" }, 400);
    const act = metaActId(adAccountId);
    const data = await graphGet(accessToken, `${act}/adspixels?fields=id,name`);
    const pixels = (data as { data?: Array<{ id?: string; name?: string }> })?.data ?? [];
    return metaAdsJson({
      pixels: pixels.map((p) => ({ id: p.id ?? "", name: p.name ?? "" })),
    }, 200);
  }

  if (action === "syncAccessibleAccounts") {
    const accessToken = await getMetaAdsAccessToken(admin, organizationId);
    if (!accessToken) return metaAdsJson({ error: "Connect Meta Ads first" }, 400);
    const data = await graphGet(accessToken, "me?fields=adaccounts{account_id,name}");
    const remote = (data as { adaccounts?: { data?: Array<{ account_id?: string; name?: string }> } })
      ?.adaccounts?.data ?? [];

    const { data: existing } = await admin
      .from("organization_meta_ads_accounts")
      .select("ad_account_id")
      .eq("organization_id", organizationId);

    const existingIds = new Set((existing ?? []).map((r) => String((r as { ad_account_id: string }).ad_account_id)));
    let imported = 0;
    const skipped: Array<{ ad_account_id: string; reason: string }> = [];

    for (const acc of remote) {
      const id = digitsOnly(String(acc.account_id ?? ""));
      if (!id) continue;
      if (existingIds.has(id)) {
        skipped.push({ ad_account_id: id, reason: "already_exists" });
        continue;
      }
      const resolvedPixel = await resolveFirstPixelId(accessToken, id);
      const pixelId = resolvedPixel ?? "0";
      const { error } = await admin.from("organization_meta_ads_accounts").insert({
        organization_id: organizationId,
        label: acc.name?.trim() || id,
        ad_account_id: id,
        pixel_id: pixelId,
        is_default: existingIds.size === 0 && imported === 0,
        is_active: pixelId !== "0",
      });
      if (error) {
        skipped.push({ ad_account_id: id, reason: error.message });
      } else {
        imported++;
        existingIds.add(id);
      }
    }

    const pixelsResolved = await backfillMissingPixelIds(admin, organizationId, accessToken);

    const { data: accounts } = await admin
      .from("organization_meta_ads_accounts")
      .select("*")
      .eq("organization_id", organizationId);
    return metaAdsJson({ imported, skipped, pixelsResolved, accounts: accounts ?? [] }, 200);
  }

  if (action === "testConnection") {
    const accessToken = await getMetaAdsAccessToken(admin, organizationId);
    const now = new Date().toISOString();
    if (!accessToken) {
      await admin.from("organization_meta_ads_connections").update({
        last_test_at: now,
        last_test_ok: false,
        last_test_error: "Not connected",
        updated_at: now,
      }).eq("organization_id", organizationId);
      return metaAdsJson({ ok: false, error: "Not connected" }, 400);
    }

    const accountId = body.account_id != null
      ? String(body.account_id).trim()
      : null;

    let adAccountId = "";
    if (accountId) {
      const { data: acc } = await admin
        .from("organization_meta_ads_accounts")
        .select("ad_account_id")
        .eq("id", accountId)
        .eq("organization_id", organizationId)
        .maybeSingle();
      adAccountId = acc?.ad_account_id ? String(acc.ad_account_id) : "";
    } else {
      const { data: def } = await admin
        .from("organization_meta_ads_accounts")
        .select("ad_account_id")
        .eq("organization_id", organizationId)
        .eq("is_default", true)
        .maybeSingle();
      adAccountId = def?.ad_account_id ? String(def.ad_account_id) : "";
    }

    try {
      if (adAccountId) {
        await graphGet(accessToken, `${metaActId(adAccountId)}?fields=name,account_id,currency`);
      } else {
        await graphGet(accessToken, "me?fields=id");
      }
      await admin.from("organization_meta_ads_connections").update({
        last_test_at: now,
        last_test_ok: true,
        last_test_error: null,
        updated_at: now,
      }).eq("organization_id", organizationId);
      return metaAdsJson({ ok: true }, 200);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await admin.from("organization_meta_ads_connections").update({
        last_test_at: now,
        last_test_ok: false,
        last_test_error: msg,
        updated_at: now,
      }).eq("organization_id", organizationId);
      return metaAdsJson({ ok: false, error: msg }, 400);
    }
  }

  return metaAdsJson({ error: "Unknown action" }, 400);
});

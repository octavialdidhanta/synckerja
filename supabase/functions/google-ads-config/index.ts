/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encryptGoogleAdsRefreshToken } from "../_shared/googleAdsConfigCrypto.ts";
import {
  getUserFromBearer,
  googleAdsCorsHeaders,
  googleAdsJson,
  readPlatformGoogleAdsOAuth,
  requireOrgAdmin,
} from "../_shared/googleAdsAuth.ts";
import { resolveOrgGoogleAdsForUpload } from "../_shared/googleAdsOrgResolver.ts";
import {
  fetchGoogleAdsAccessToken,
  googleAdsApiVersion,
  listAccessibleCustomerIds,
  parseGoogleAdsErrorMessage,
  readGoogleAdsConfig,
  type GoogleAdsConfig,
} from "../google-ads-upload-offline-conversion/googleAdsHelpers.ts";

const LEGACY_SEED_ORG_ID = "663c9336-8cb6-4a36-9ad9-313126e70a1a";

function digitsOnly(value: string, len?: number): string {
  const d = value.replace(/\D/g, "");
  if (len != null && d.length !== len) return "";
  return d;
}

async function buildRuntimeConfig(
  admin: ReturnType<typeof createClient>,
  organizationId: string,
): Promise<GoogleAdsConfig | null> {
  const resolved = await resolveOrgGoogleAdsForUpload(admin, organizationId, null, {
    requireUploadsEnabled: false,
  });
  return resolved?.config ?? null;
}

async function gaqlSearch<T extends Record<string, unknown>>(
  config: GoogleAdsConfig,
  accessToken: string,
  customerId: string,
  query: string,
): Promise<T[]> {
  const apiVersion = googleAdsApiVersion();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "developer-token": config.developerToken,
    "Content-Type": "application/json",
  };
  if (config.loginCustomerId) headers["login-customer-id"] = config.loginCustomerId;

  const res = await fetch(
    `https://googleads.googleapis.com/${apiVersion}/customers/${customerId}/googleAds:search`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ query }),
    },
  );
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    throw new Error(parseGoogleAdsErrorMessage(json));
  }
  const results = json.results as T[] | undefined;
  return results ?? [];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: googleAdsCorsHeaders });
  }
  if (req.method !== "POST") {
    return googleAdsJson({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    return googleAdsJson({ error: "Server misconfigured" }, 500);
  }

  if (!readPlatformGoogleAdsOAuth()) {
    return googleAdsJson({ error: "Google Ads is not configured on the server" }, 503);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const userRes = await getUserFromBearer(admin, req.headers.get("Authorization"));
  if ("error" in userRes) return userRes.error;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return googleAdsJson({ error: "Invalid JSON body" }, 400);
  }

  const action = String(body.action ?? "").trim();
  const organizationId = String(body.organization_id ?? "").trim();
  if (!organizationId) {
    return googleAdsJson({ error: "Missing organization_id" }, 400);
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("active_organization_id")
    .eq("user_id", userRes.userId)
    .maybeSingle();
  const activeOrg = profile?.active_organization_id != null
    ? String(profile.active_organization_id)
    : "";
  if (!activeOrg || activeOrg !== organizationId) {
    return googleAdsJson({ error: "Forbidden" }, 403);
  }

  const forbidden = await requireOrgAdmin(admin, userRes.userId, organizationId);
  if (forbidden) return forbidden;

  if (action === "getSettings") {
    const { data: connection } = await admin
      .from("organization_google_ads_connections")
      .select(
        "organization_id, login_customer_id, is_active, oauth_connected_at, last_test_at, last_test_ok, last_test_error, updated_at",
      )
      .eq("organization_id", organizationId)
      .maybeSingle();

    const { data: accounts } = await admin
      .from("organization_google_ads_accounts")
      .select("id, label, customer_id, conversion_action_id, is_default, sort_order, is_active, created_at, updated_at")
      .eq("organization_id", organizationId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    const { data: tokenRow } = await admin
      .from("organization_google_ads_connection_tokens")
      .select("organization_id")
      .eq("organization_id", organizationId)
      .maybeSingle();

    return googleAdsJson({
      connection: connection ?? null,
      oauthConnected: Boolean(tokenRow?.organization_id),
      accounts: accounts ?? [],
    }, 200);
  }

  if (action === "disconnect") {
    await admin.from("organization_google_ads_connection_tokens").delete().eq(
      "organization_id",
      organizationId,
    );
    await admin.from("organization_google_ads_connections").upsert({
      organization_id: organizationId,
      oauth_connected_at: null,
      is_active: false,
      updated_at: new Date().toISOString(),
    }, { onConflict: "organization_id" });
    return googleAdsJson({ ok: true }, 200);
  }

  if (action === "updateConnection") {
    const hasLogin = Object.prototype.hasOwnProperty.call(body, "login_customer_id");
    const hasIsActive = Object.prototype.hasOwnProperty.call(body, "is_active");
    if (!hasLogin && !hasIsActive) {
      return googleAdsJson({ error: "Nothing to update" }, 400);
    }

    const { data: existing } = await admin
      .from("organization_google_ads_connections")
      .select("organization_id")
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (!existing?.organization_id) {
      return googleAdsJson({ error: "Connect Google Ads first" }, 400);
    }

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (hasLogin) {
      const loginCustomerId = body.login_customer_id != null
        ? digitsOnly(String(body.login_customer_id))
        : null;
      patch.login_customer_id = loginCustomerId || null;
    }
    if (hasIsActive) {
      patch.is_active = body.is_active === true;
    }

    const { error } = await admin
      .from("organization_google_ads_connections")
      .update(patch)
      .eq("organization_id", organizationId);
    if (error) return googleAdsJson({ error: error.message }, 500);
    return googleAdsJson({ ok: true }, 200);
  }

  if (action === "upsertAccount") {
    const id = body.id != null ? String(body.id).trim() : "";
    const label = String(body.label ?? "").trim();
    const customerId = digitsOnly(String(body.customer_id ?? ""), 10);
    const conversionActionId = digitsOnly(String(body.conversion_action_id ?? ""));
    const isDefault = body.is_default === true;
    const isActive = body.is_active !== false;
    const sortOrder = Number(body.sort_order ?? 0);

    if (!customerId || customerId.length !== 10) {
      return googleAdsJson({ error: "customer_id must be 10 digits" }, 400);
    }
    if (!conversionActionId) {
      return googleAdsJson({ error: "conversion_action_id is required" }, 400);
    }

    if (isDefault) {
      await admin
        .from("organization_google_ads_accounts")
        .update({ is_default: false })
        .eq("organization_id", organizationId);
    }

    const row = {
      ...(id ? { id } : {}),
      organization_id: organizationId,
      label: label || customerId,
      customer_id: customerId,
      conversion_action_id: conversionActionId,
      is_default: isDefault,
      is_active: isActive,
      sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = id
      ? await admin.from("organization_google_ads_accounts").update(row).eq("id", id).eq(
        "organization_id",
        organizationId,
      ).select().maybeSingle()
      : await admin.from("organization_google_ads_accounts").insert(row).select().maybeSingle();

    if (error) return googleAdsJson({ error: error.message }, 500);
    return googleAdsJson({ account: data }, 200);
  }

  if (action === "deleteAccount") {
    const accountId = String(body.account_id ?? "").trim();
    if (!accountId) return googleAdsJson({ error: "Missing account_id" }, 400);
    const { error } = await admin
      .from("organization_google_ads_accounts")
      .delete()
      .eq("id", accountId)
      .eq("organization_id", organizationId);
    if (error) return googleAdsJson({ error: error.message }, 500);
    return googleAdsJson({ ok: true }, 200);
  }

  if (action === "setDefaultAccount") {
    const accountId = String(body.account_id ?? "").trim();
    if (!accountId) return googleAdsJson({ error: "Missing account_id" }, 400);
    await admin
      .from("organization_google_ads_accounts")
      .update({ is_default: false })
      .eq("organization_id", organizationId);
    const { error } = await admin
      .from("organization_google_ads_accounts")
      .update({ is_default: true, updated_at: new Date().toISOString() })
      .eq("id", accountId)
      .eq("organization_id", organizationId);
    if (error) return googleAdsJson({ error: error.message }, 500);
    return googleAdsJson({ ok: true }, 200);
  }

  if (action === "listAccessibleCustomers") {
    const config = await buildRuntimeConfig(admin, organizationId);
    if (!config) return googleAdsJson({ error: "Connect Google Ads first" }, 400);
    const accessToken = await fetchGoogleAdsAccessToken(config);
    const ids = await listAccessibleCustomerIds(config, accessToken);
    return googleAdsJson({ customerIds: ids }, 200);
  }

  if (action === "listConversionActions") {
    const customerId = digitsOnly(String(body.customer_id ?? ""), 10);
    if (!customerId) return googleAdsJson({ error: "customer_id required" }, 400);
    const config = await buildRuntimeConfig(admin, organizationId);
    if (!config) return googleAdsJson({ error: "Connect Google Ads first" }, 400);
    const runtime: GoogleAdsConfig = { ...config, customerId };
    const accessToken = await fetchGoogleAdsAccessToken(runtime);
    const rows = await gaqlSearch<{ conversionAction?: { id?: string; name?: string } }>(
      runtime,
      accessToken,
      customerId,
      "SELECT conversion_action.id, conversion_action.name FROM conversion_action WHERE conversion_action.status = 'ENABLED'",
    );
    const actions = rows
      .map((r) => ({
        id: r.conversionAction?.id != null ? String(r.conversionAction.id) : "",
        name: r.conversionAction?.name != null ? String(r.conversionAction.name) : "",
      }))
      .filter((a) => a.id);
    return googleAdsJson({ conversionActions: actions }, 200);
  }

  if (action === "testConnection") {
    const accountId = body.account_id != null ? String(body.account_id).trim() : null;
    const resolved = await resolveOrgGoogleAdsForUpload(admin, organizationId, accountId, {
      requireUploadsEnabled: false,
    });
    const now = new Date().toISOString();
    if (!resolved) {
      await admin.from("organization_google_ads_connections").upsert({
        organization_id: organizationId,
        last_test_at: now,
        last_test_ok: false,
        last_test_error: "not_configured",
        updated_at: now,
      }, { onConflict: "organization_id" });
      return googleAdsJson({
        ok: false,
        error:
          "Google Ads is not fully set up. Connect with Google, add at least one account (customer + conversion action), then test again.",
      }, 200);
    }

    try {
      const accessToken = await fetchGoogleAdsAccessToken(resolved.config);
      const ids = await listAccessibleCustomerIds(resolved.config, accessToken);
      const ok = ids.includes(resolved.config.customerId);
      await admin.from("organization_google_ads_connections").upsert({
        organization_id: organizationId,
        last_test_at: now,
        last_test_ok: ok,
        last_test_error: ok ? null : `Customer ${resolved.config.customerId} not in accessible list`,
        updated_at: now,
      }, { onConflict: "organization_id" });
      const errMsg = ok
        ? undefined
        : `Customer ${resolved.config.customerId} not in accessible list`;
      return googleAdsJson({
        ok,
        error: errMsg,
        accessibleCustomerIds: ids,
        customerId: resolved.config.customerId,
      }, 200);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await admin.from("organization_google_ads_connections").upsert({
        organization_id: organizationId,
        last_test_at: now,
        last_test_ok: false,
        last_test_error: msg.slice(0, 500),
        updated_at: now,
      }, { onConflict: "organization_id" });
      return googleAdsJson({ ok: false, error: msg }, 200);
    }
  }

  if (action === "importLegacyEnvSecrets") {
    if (organizationId !== LEGACY_SEED_ORG_ID) {
      return googleAdsJson({ error: "Legacy import only allowed for seed organization" }, 403);
    }
    const legacy = readGoogleAdsConfig();
    if (!legacy?.refreshToken) {
      return googleAdsJson({ error: "Global GOOGLE_ADS_* secrets not set" }, 400);
    }
    const refreshEnc = await encryptGoogleAdsRefreshToken(legacy.refreshToken);
    const now = new Date().toISOString();
    await admin.from("organization_google_ads_connections").upsert({
      organization_id: organizationId,
      login_customer_id: legacy.loginCustomerId,
      is_active: true,
      oauth_connected_at: now,
      updated_at: now,
      created_by: userRes.userId,
    }, { onConflict: "organization_id" });
    await admin.from("organization_google_ads_connection_tokens").upsert({
      organization_id: organizationId,
      refresh_token_enc: refreshEnc,
      updated_at: now,
    }, { onConflict: "organization_id" });

    const { data: existingDefault } = await admin
      .from("organization_google_ads_accounts")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("is_default", true)
      .maybeSingle();

    if (!existingDefault?.id) {
      await admin.from("organization_google_ads_accounts").insert({
        organization_id: organizationId,
        label: "Default",
        customer_id: legacy.customerId,
        conversion_action_id: legacy.conversionActionId,
        is_default: true,
        is_active: true,
        sort_order: 0,
      });
    }
    return googleAdsJson({ ok: true }, 200);
  }

  return googleAdsJson({ error: "Unknown action" }, 400);
});

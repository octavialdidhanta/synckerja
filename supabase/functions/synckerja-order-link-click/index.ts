import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { OmnichannelApiTokenContext } from "../_shared/omnichannelPublicApi/auth.ts";
import {
  ensureAnalyticsSessionForIngest,
  mergeSessionAttributionFromPageContext,
} from "../_shared/omnichannelPublicApi/ensureAnalyticsSession.ts";
import { syncFloatingWaClickToLead } from "../_shared/omnichannelPublicApi/syncFloatingWaClickToLead.ts";
import { resolveSessionMarketingAttribution } from "../_shared/omnichannelPublicApi/urlParams.ts";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

/** Accepts "49eetd" and "sate-sultan-pik-49eetd". */
function publicCodeFromInput(raw: unknown): string {
  const value = String(raw ?? "").trim().toLowerCase();
  if (/^[a-z0-9]{6}$/.test(value)) return value;
  const match = /^[a-z0-9]+(?:-[a-z0-9]+)*-([a-z0-9]{6})$/.exec(value);
  return match?.[1] ?? "";
}

type OutletRow = {
  organization_id: string;
  outlet_id: string;
  public_code: string;
  outlet_name: string;
};

async function resolveOutlet(admin: SupabaseClient, code: string): Promise<OutletRow | null> {
  const { data, error } = await admin.rpc("_synckerja_order_resolve_outlet", { p_code: code });
  if (error) {
    console.warn("synckerja-order-link-click resolve:", error.message);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.organization_id || !row?.outlet_id || !row?.public_code) return null;
  return {
    organization_id: String(row.organization_id),
    outlet_id: String(row.outlet_id),
    public_code: String(row.public_code),
    outlet_name: row.outlet_name != null ? String(row.outlet_name) : "",
  };
}

/** analytics_sessions.web_id must already exist as properties.slug. */
async function ensureOrderProperty(
  admin: SupabaseClient,
  orgId: string,
  webId: string,
  outletName: string,
): Promise<boolean> {
  if (!webId.startsWith("order-")) return true;
  const { data: existing, error: readErr } = await admin
    .from("properties")
    .select("slug")
    .eq("slug", webId)
    .maybeSingle();
  if (readErr) {
    console.warn("synckerja-order-link-click property lookup:", readErr.message);
    return false;
  }
  if (existing?.slug) return true;

  const { error } = await admin.from("properties").insert({
    slug: webId,
    display_name: outletName.trim() || webId,
    organization_id: orgId,
    primary_domains: [],
    metadata: { source: "synckerja_order_link" },
    updated_at: new Date().toISOString(),
  });
  if (error && error.code !== "23505") {
    console.warn("synckerja-order-link-click property insert:", error.message);
    return false;
  }
  return true;
}

/**
 * Reuse a web_id already mapped to this WhatsApp account.
 * Otherwise create order-{public_code} without touching another site's web_id.
 */
async function resolveOrderWebId(
  admin: SupabaseClient,
  orgId: string,
  accountId: string,
  publicCode: string,
): Promise<string | null> {
  const { data: existing, error: existingErr } = await admin
    .from("organization_whatsapp_web_id_accounts")
    .select("web_id")
    .eq("organization_id", orgId)
    .eq("whatsapp_account_id", accountId)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingErr) {
    console.warn("synckerja-order-link-click web_id lookup:", existingErr.message);
    return null;
  }
  const mapped = existing?.web_id != null ? String(existing.web_id).trim().toLowerCase() : "";
  if (mapped) return mapped;

  const webId = `order-${publicCode}`;
  const now = new Date().toISOString();
  const { error } = await admin.from("organization_whatsapp_web_id_accounts").upsert(
    {
      organization_id: orgId,
      web_id: webId,
      whatsapp_account_id: accountId,
      is_active: true,
      updated_at: now,
    },
    { onConflict: "organization_id,web_id" },
  );
  if (error) {
    console.warn("synckerja-order-link-click web_id upsert:", error.message);
    return null;
  }
  return webId;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json(405, { ok: false, error: "method_not_allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceKey) return json(500, { ok: false, error: "server_misconfigured" });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(400, { ok: false, error: "invalid_json" });
  }

  const code = publicCodeFromInput(body.code);
  const sessionId = String(body.session_id ?? "").trim();
  const visitorId = String(body.visitor_id ?? "").trim();
  if (!code || !UUID_RE.test(sessionId) || !UUID_RE.test(visitorId)) {
    return json(422, { ok: false, error: "invalid_click" });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const outlet = await resolveOutlet(admin, code);
  if (!outlet) return json(404, { ok: false, error: "store_not_found" });

  const { data: settings, error: settingsErr } = await admin
    .from("synckerja_order_outlet_settings")
    .select("whatsapp_account_id, whatsapp_button_enabled")
    .eq("organization_id", outlet.organization_id)
    .eq("outlet_id", outlet.outlet_id)
    .maybeSingle();
  if (settingsErr) return json(500, { ok: false, error: "settings_failed" });

  const accountId = settings?.whatsapp_account_id ? String(settings.whatsapp_account_id) : "";
  if (!accountId || settings?.whatsapp_button_enabled === false) {
    return json(200, { ok: false, error: "whatsapp_disabled" });
  }

  const webId = await resolveOrderWebId(admin, outlet.organization_id, accountId, outlet.public_code);
  if (!webId) return json(500, { ok: false, error: "web_id_failed" });
  const propertyReady = await ensureOrderProperty(
    admin,
    outlet.organization_id,
    webId,
    outlet.outlet_name,
  );
  if (!propertyReady) return json(500, { ok: false, error: "web_id_failed" });

  const ctx: OmnichannelApiTokenContext = {
    tokenId: "00000000-0000-0000-0000-000000000000",
    organizationId: outlet.organization_id,
    webId,
    allowedOrigins: [],
    whatsappInvoiceTemplateName: null,
    whatsappLeadTemplateName: null,
    tokenType: "sdk",
  };

  const pageUrl = body.page_url != null ? String(body.page_url).trim() : "";
  const referrer = body.referrer != null ? String(body.referrer).trim() : null;
  const path = body.path != null ? String(body.path).trim() || "/" : "/";
  const targetUrl = body.target_url != null ? String(body.target_url).trim() : null;
  const targetPhone = body.target_phone != null ? String(body.target_phone).trim() : null;

  const ensured = await ensureAnalyticsSessionForIngest(admin, ctx, {
    sessionId,
    visitorId,
    pageUrl: pageUrl || null,
    referrer,
  });
  if (!ensured.ok) return json(500, { ok: false, error: "session_failed" });

  const merged = await mergeSessionAttributionFromPageContext(admin, webId, {
    sessionId,
    visitorId,
    pageUrl: pageUrl || null,
    referrer,
    body,
  });
  const session = merged ?? ensured.session;
  const marketing = resolveSessionMarketingAttribution(sessionId, webId, session);

  const waClickId = crypto.randomUUID();
  const { error: clickErr } = await admin.from("analytics_wa_clicks").insert({
    id: waClickId,
    web_id: webId,
    session_id: sessionId,
    path,
    target_url: targetUrl,
    phone_number: targetPhone || null,
    gclid: marketing.gclid,
    attribution: {
      ...marketing.attribution,
      path,
      target_url: targetUrl,
      visitor_id: visitorId,
    },
    created_at: new Date().toISOString(),
  });
  if (clickErr) {
    console.warn("synckerja-order-link-click insert:", clickErr.message);
    return json(500, { ok: false, error: "click_failed" });
  }

  const sync = await syncFloatingWaClickToLead(admin, ctx, {
    sessionId,
    visitorId,
    path,
    targetUrl,
    targetPhone,
    waClickId,
  });
  if (!sync.ok) {
    console.warn("synckerja-order-link-click lead:", sync.error);
    return json(500, { ok: false, error: "lead_failed" });
  }

  return json(201, { ok: true, lead_id: sync.leadId, web_id: webId });
});

/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const META_API_BASE = "https://graph.facebook.com/v18.0";
/** Max stringified flow_json size sent to Meta (defense in depth). */
const MAX_FLOW_JSON_BYTES = 256 * 1024;

const ALLOWED_CATEGORIES = new Set([
  "SIGN_UP",
  "SIGN_IN",
  "APPOINTMENT_BOOKING",
  "LEAD_GENERATION",
  "CONTACT_US",
  "CUSTOMER_SUPPORT",
  "SURVEY",
  "OTHER",
]);

type GraphContext = {
  orgId: string;
  wabaId: string;
  accessToken: string;
};

async function fetchWabaIdFromPhoneNumberId(phoneNumberId: string, accessToken: string): Promise<string | null> {
  const fields = encodeURIComponent("whatsapp_business_account{id}");
  const url = `${META_API_BASE}/${encodeURIComponent(phoneNumberId)}?fields=${fields}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const json = await res.json().catch(() => ({}));
  const waba = json?.whatsapp_business_account?.id;
  if (waba != null && String(waba).trim()) return String(waba).trim();
  return null;
}

async function resolveGraphContext(
  supabaseAdmin: ReturnType<typeof createClient>,
  _userId: string,
  activeOrgId: string | null,
): Promise<GraphContext | null> {
  if (!activeOrgId) return null;

  const { data: meta } = await supabaseAdmin
    .from("organization_meta_config")
    .select("whatsapp_business_account_id, meta_access_token")
    .eq("organization_id", activeOrgId)
    .maybeSingle();
  const { data: accRow } = await supabaseAdmin
    .from("organization_whatsapp_accounts")
    .select("meta_access_token, whatsapp_business_account_id, phone_number_id")
    .eq("organization_id", activeOrgId)
    .or("is_active.eq.true,is_active.is.null")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  let wabaId =
    (meta?.whatsapp_business_account_id ?? "").toString().trim() ||
    (accRow?.whatsapp_business_account_id ?? "").toString().trim();
  let accessToken = (meta?.meta_access_token ?? "").toString().trim();
  if (!accessToken) accessToken = (accRow?.meta_access_token ?? "").toString().trim();
  if (!accessToken) return null;
  const phoneNumberId = (accRow?.phone_number_id ?? "").toString().trim();
  if (!wabaId && phoneNumberId) {
    wabaId = (await fetchWabaIdFromPhoneNumberId(phoneNumberId, accessToken)) ?? "";
  }
  if (!wabaId) return null;
  return { orgId: activeOrgId, wabaId, accessToken };
}

function normalizeFlowJsonString(raw: unknown): { ok: true; flowJsonString: string } | { ok: false; error: string } {
  if (raw === null || raw === undefined) {
    return { ok: false, error: "flow_json is required" };
  }
  let s: string;
  if (typeof raw === "string") {
    s = raw.trim();
    if (!s) return { ok: false, error: "flow_json must be non-empty" };
    try {
      JSON.parse(s);
    } catch {
      return { ok: false, error: "flow_json string must be valid JSON" };
    }
  } else if (typeof raw === "object" && !Array.isArray(raw)) {
    s = JSON.stringify(raw);
  } else {
    return { ok: false, error: "flow_json must be an object or JSON string" };
  }
  const bytes = new TextEncoder().encode(s).length;
  if (bytes > MAX_FLOW_JSON_BYTES) {
    return { ok: false, error: `flow_json exceeds maximum size (${MAX_FLOW_JSON_BYTES} bytes)` };
  }
  return { ok: true, flowJsonString: s };
}

function normalizeCategories(raw: unknown): { ok: true; categories: string[] } | { ok: false; error: string } {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { ok: false, error: "categories must be a non-empty array" };
  }
  const out: string[] = [];
  for (const c of raw) {
    const u = String(c ?? "").trim().toUpperCase();
    if (!ALLOWED_CATEGORIES.has(u)) {
      return { ok: false, error: `Invalid category: ${u}` };
    }
    out.push(u);
  }
  return { ok: true, categories: out };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const jwt = authHeader.replace("Bearer ", "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseWithUser = createClient(supabaseUrl, serviceRoleKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: { user }, error: userError } = await supabaseWithUser.auth.getUser(jwt);
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
    const ctx = await resolveGraphContext(supabaseAdmin, user.id, orgId);
    if (!ctx) {
      return new Response(
        JSON.stringify({
          error:
            "WhatsApp Business Account not configured or missing access token. Connect WhatsApp in Operations → Consultant.",
          code: "WHATSAPP_NOT_CONFIGURED",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (req.method === "GET") {
      const urlObj = new URL(req.url);
      const fields = urlObj.searchParams.get("fields")?.trim() || "id,name,status,categories";
      const graphUrl = `${META_API_BASE}/${encodeURIComponent(ctx.wabaId)}/flows?fields=${encodeURIComponent(fields)}`;
      const res = await fetch(graphUrl, {
        headers: { Authorization: `Bearer ${ctx.accessToken}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = json?.error?.message ?? json?.error_message ?? "Meta API error";
        return new Response(JSON.stringify({ error: String(msg), details: json }), {
          status: res.status >= 400 && res.status < 600 ? res.status : 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ data: json?.data ?? json }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST — create flow or publish existing
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const action = body.action != null ? String(body.action).trim().toLowerCase() : "";

    if (action === "publish") {
      const flowId = body.flow_id != null ? String(body.flow_id).trim() : "";
      if (!flowId) {
        return new Response(JSON.stringify({ error: "flow_id is required", code: "INVALID_BODY" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const publishUrl = `${META_API_BASE}/${encodeURIComponent(flowId)}/publish`;
      const res = await fetch(publishUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${ctx.accessToken}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = json?.error?.message ?? json?.error_message ?? "Meta API error";
        return new Response(JSON.stringify({ error: String(msg), details: json }), {
          status: res.status >= 400 && res.status < 600 ? res.status : 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true, result: json }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const name = body.name != null ? String(body.name).trim() : "";
    const categoriesRaw = body.categories;
    const publish = Boolean(body.publish);
    const endpointUri = body.endpoint_uri != null ? String(body.endpoint_uri).trim() : "";

    if (!name || !/^[a-z0-9_]{1,128}$/.test(name)) {
      return new Response(
        JSON.stringify({
          error: "Invalid name (lowercase letters, numbers, underscores only, max 128)",
          code: "INVALID_NAME",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const catResult = normalizeCategories(categoriesRaw);
    if (!catResult.ok) {
      return new Response(JSON.stringify({ error: catResult.error, code: "INVALID_CATEGORIES" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fj = normalizeFlowJsonString(body.flow_json);
    if (!fj.ok) {
      return new Response(JSON.stringify({ error: fj.error, code: "INVALID_FLOW_JSON" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const graphBody: Record<string, unknown> = {
      name,
      categories: catResult.categories,
      flow_json: fj.flowJsonString,
    };
    if (publish) graphBody.publish = true;
    if (endpointUri) graphBody.endpoint_uri = endpointUri;

    const createUrl = `${META_API_BASE}/${encodeURIComponent(ctx.wabaId)}/flows`;
    const res = await fetch(createUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ctx.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(graphBody),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = json?.error?.message ?? json?.error_message ?? "Meta API error";
      return new Response(JSON.stringify({ error: String(msg), details: json }), {
        status: res.status >= 400 && res.status < 600 ? res.status : 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, result: json }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

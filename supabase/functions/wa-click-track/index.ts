// @ts-nocheck
// supabase/functions-src/wa-click-track/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// supabase/functions/_shared/resolveWebId.ts
var CACHE_TTL_MS = 6e4;
var cache = /* @__PURE__ */ new Map();
function cacheKey(raw) {
  return raw.trim().toLowerCase();
}
async function resolveActiveProperty(admin, rawWebId) {
  if (typeof rawWebId !== "string") {
    return { ok: false, status: 404, error: "unknown_web_id" };
  }
  const trimmed = rawWebId.trim();
  if (trimmed.length < 3 || trimmed.length > 64) {
    return { ok: false, status: 404, error: "unknown_web_id" };
  }
  const key = cacheKey(trimmed);
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.at < CACHE_TTL_MS) {
    if (!hit.value) return { ok: false, status: 404, error: "unknown_web_id" };
    if (!hit.value.is_active) return { ok: false, status: 403, error: "property_inactive" };
    return { ok: true, property: hit.value };
  }
  const { data: aliasRow } = await admin.from("property_web_id_aliases").select("canonical_slug").eq("alias", trimmed.toLowerCase()).maybeSingle();
  const slug = (aliasRow?.canonical_slug ?? trimmed).toLowerCase();
  const { data: prop, error } = await admin.from("properties").select("slug, organization_id, is_active, display_name").eq("slug", slug).maybeSingle();
  if (error || !prop) {
    cache.set(key, { at: now, value: null });
    return { ok: false, status: 404, error: "unknown_web_id" };
  }
  const resolved = {
    slug: String(prop.slug),
    organization_id: String(prop.organization_id),
    is_active: Boolean(prop.is_active),
    display_name: String(prop.display_name ?? prop.slug)
  };
  cache.set(key, { at: now, value: resolved });
  if (!resolved.is_active) {
    return { ok: false, status: 403, error: "property_inactive" };
  }
  return { ok: true, property: resolved };
}

// supabase/functions/_shared/gclid.ts
var MAX_GCLID_LEN = 500;
function normalizeGclid(raw) {
  if (raw === void 0 || raw === null) return null;
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t) return null;
  return t.length <= MAX_GCLID_LEN ? t : t.slice(0, MAX_GCLID_LEN);
}
async function resolveSessionGclid(admin, sessionId) {
  const id = sessionId.trim();
  if (!id) return null;
  const { data, error } = await admin.from("analytics_sessions").select("gclid").eq("id", id).maybeSingle();
  if (error) {
    console.warn("resolveSessionGclid:", error.message);
    return null;
  }
  return normalizeGclid(data?.gclid);
}
async function resolveGclidForEvent(admin, sessionId, bodyGclid) {
  return normalizeGclid(bodyGclid) ?? await resolveSessionGclid(admin, sessionId);
}

// supabase/functions/_shared/propertyCreatedByName.ts
function propertyCreatedByName(displayName, webId) {
  const fromDisplay = typeof displayName === "string" ? displayName.trim() : "";
  if (fromDisplay) return fromDisplay.slice(0, 200);
  const slug = typeof webId === "string" ? webId.trim() : "";
  if (slug) {
    return slug.split(/[-_]+/).filter((p) => p.length > 0).map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(" ").slice(0, 200);
  }
  return "Website";
}

// supabase/functions/_shared/waFloatingClickHub.ts
var FORM_ID = "contact-main";
var PACKAGE_LABEL_CLICK = "WhatsApp (klik)";
var WA_FLOATING_STUB_CLIENT = "\u2014";
function buildWaFloatingFunnelKey(webId) {
  return `wa-floating:${webId}`.slice(0, 200);
}
function mergeFormDataFloating(existing, path, targetUrl) {
  const base = existing && typeof existing === "object" && !Array.isArray(existing) ? { ...existing } : {};
  return {
    ...base,
    source: "floating_whatsapp",
    path,
    ...targetUrl ? { target_url: targetUrl } : {}
  };
}
function submissionHasPii(row) {
  if (!row) return false;
  const name = row.name != null ? String(row.name).trim() : "";
  const phone = row.phone_number != null ? String(row.phone_number).trim() : "";
  const email = row.email != null ? String(row.email).trim() : "";
  return Boolean(name && phone && email);
}
async function syncWaFloatingClickToHub(args) {
  const sessionId = args.analyticsSessionId.trim();
  if (!sessionId) return { ok: false, error: "analytics_session_id required" };
  const { data: formDef, error: formErr } = await args.admin.from("form_definitions").select("version").eq("web_id", args.webId).eq("form_id", FORM_ID).eq("is_active", true).maybeSingle();
  if (formErr) return { ok: false, error: formErr.message };
  if (!formDef) {
    console.warn("syncWaFloatingClickToHub: hub_sync_skipped no contact-main", {
      web_id: args.webId
    });
    return { ok: false, error: "form_definitions missing", skipped: true };
  }
  const formVersion = args.formVersion ?? (Number(formDef.version) || 1);
  const funnelKey = buildWaFloatingFunnelKey(args.webId);
  const pkgLabel = (args.packageLabel ?? PACKAGE_LABEL_CLICK).trim() || PACKAGE_LABEL_CLICK;
  const { data: existingSub } = await args.admin.from("lead_submissions").select("id, lead_id, name, phone_number, email, form_data, package_label").eq("web_id", args.webId).eq("organization_id", args.organizationId).eq("analytics_session_id", sessionId).eq("form_id", FORM_ID).eq("status", "draft").maybeSingle();
  const hasPii = submissionHasPii(existingSub);
  const mergedFormData = mergeFormDataFloating(
    existingSub?.form_data,
    args.path,
    args.targetUrl
  );
  let leadId = existingSub?.lead_id != null && String(existingSub.lead_id).trim() ? String(existingSub.lead_id).trim() : null;
  if (!leadId) {
    const leadPayload = {
      client: WA_FLOATING_STUB_CLIENT,
      title: "WhatsApp floating",
      category: "WhatsApp floating",
      created_by: args.systemUserId,
      created_by_name: propertyCreatedByName(args.propertyDisplayName, args.webId),
      assignee: "",
      followup: 0,
      organization_id: args.organizationId,
      source: "WhatsApp floating click",
      web_id: args.webId,
      funnel_key: funnelKey,
      analytics_session_id: sessionId,
      ...args.attribution ? { attribution: args.attribution } : {},
      ...args.gclid ? { gclid: args.gclid } : {}
    };
    const { data: lead, error: leadErr } = await args.admin.from("leads").upsert(leadPayload, { onConflict: "organization_id,dedupe_key" }).select("id").single();
    if (leadErr || !lead?.id) {
      return { ok: false, error: leadErr?.message ?? "Failed to upsert lead" };
    }
    leadId = String(lead.id);
  } else {
    const patch = { updated_at: (/* @__PURE__ */ new Date()).toISOString() };
    if (args.attribution) patch.attribution = args.attribution;
    if (args.gclid) patch.gclid = args.gclid;
    patch.analytics_session_id = sessionId;
    patch.web_id = args.webId;
    const { error: patchErr } = await args.admin.from("leads").update(patch).eq("id", leadId);
    if (patchErr) {
      return { ok: false, error: patchErr.message };
    }
  }
  const submissionPatch = {
    web_id: args.webId,
    form_id: FORM_ID,
    form_version: formVersion,
    step: 1,
    status: "draft",
    form_data: mergedFormData,
    organization_id: args.organizationId,
    lead_id: leadId,
    analytics_session_id: sessionId,
    attribution: args.attribution,
    ...args.gclid ? { gclid: args.gclid } : {}
  };
  if (!hasPii) {
    submissionPatch.package_label = pkgLabel;
  }
  let submissionId = existingSub?.id != null ? String(existingSub.id) : null;
  if (submissionId) {
    const { error: subUpdErr } = await args.admin.from("lead_submissions").update(submissionPatch).eq("id", submissionId);
    if (subUpdErr) {
      return { ok: false, error: subUpdErr.message };
    }
  } else {
    const { data: sub, error: subErr } = await args.admin.from("lead_submissions").insert(submissionPatch).select("id").single();
    if (subErr || !sub?.id) {
      return { ok: false, error: subErr?.message ?? "Failed to insert lead_submissions" };
    }
    submissionId = String(sub.id);
  }
  if (!submissionId) {
    return { ok: false, error: "Failed to persist lead_submissions" };
  }
  console.log("syncWaFloatingClickToHub: hub_sync_ok", {
    web_id: args.webId,
    lead_id: leadId,
    submission_id: submissionId
  });
  return { ok: true, lead_id: leadId, submission_id: submissionId };
}

// supabase/functions-src/wa-click-track/index.ts
var MAX_PATH_LEN = 512;
var MAX_URL_LEN = 2e3;
var MAX_UTM_LEN = 200;
var MAX_LANDING_URL_LEN = 1e3;
function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
      "access-control-allow-methods": "POST, OPTIONS",
      ...init.headers ?? {}
    }
  });
}
function corsHeaders(origin) {
  const allowed = Deno.env.get("ALLOWED_ORIGINS") ?? "";
  const list = allowed.split(",").map((s) => s.trim()).filter(Boolean);
  const o = origin?.trim() ?? "";
  if (list.length === 0) {
    return { "access-control-allow-origin": "*" };
  }
  if (o && list.includes(o)) {
    return {
      "access-control-allow-origin": o,
      "access-control-allow-credentials": "true",
      Vary: "Origin"
    };
  }
  return {};
}
function corsPreflightHeaders(origin) {
  const h = {
    "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-max-age": "86400"
  };
  const extra = corsHeaders(origin);
  for (const [k, v] of Object.entries(extra)) {
    if (v != null && v !== "") h[k] = v;
  }
  return h;
}
function badRequest(message, origin) {
  return json({ error: message }, { status: 400, headers: corsHeaders(origin) });
}
function mustGetEnv(name) {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}
function getEnvOptional(name) {
  const v = Deno.env.get(name);
  return v && v.trim().length ? v.trim() : null;
}
function isUuid(v) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}
function validPath(p) {
  if (typeof p !== "string" || p.length === 0 || p.length > MAX_PATH_LEN) return false;
  if (!p.startsWith("/")) return false;
  if (p.startsWith("/admin")) return false;
  return true;
}
function clipText(raw, max) {
  if (typeof raw !== "string") return "";
  const s = raw.trim();
  if (!s) return "";
  return s.length <= max ? s : s.slice(0, max);
}
function toIpHash(ip) {
  let h = 0;
  for (let i = 0; i < ip.length; i++) {
    h = Math.imul(31, h) + ip.charCodeAt(i) | 0;
  }
  return String(h);
}
var rateState = /* @__PURE__ */ new Map();
function rateOk(ip) {
  const minute = Math.floor(Date.now() / 6e4);
  const cur = rateState.get(ip);
  if (!cur || cur.minute !== minute) {
    rateState.set(ip, { minute, count: 1 });
    return true;
  }
  cur.count += 1;
  return cur.count <= 120;
}
function waToDigitsForGraphApi(e164) {
  return e164.replace(/^\+/, "").replace(/[^\d]/g, "");
}
function parseCsvList(raw) {
  if (!raw) return [];
  if (/^__none__$/i.test(raw.trim())) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}
var WA_ORG_LINE_DIGITS = {
  "vialdi-wedding": "6281281714855"
};
function digitsOnly(s) {
  if (typeof s !== "string") return "";
  return s.replace(/\D/g, "");
}
function normalizeIndonesiaMarketingDigits(raw) {
  const d = digitsOnly(raw);
  if (!d) return "";
  if (d.startsWith("62")) return d;
  if (d.startsWith("0")) return `62${d.slice(1)}`;
  if (d.startsWith("8")) return `62${d}`;
  return d;
}
function pickPhoneNumberIdFromAccountRow(row) {
  for (const k of ["phone_number_id", "whatsapp_phone_number_id", "meta_phone_number_id"]) {
    const v = row[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}
function orgWhatsappRowIsActive(row) {
  const a = row["is_active"];
  return a === null || a === void 0 || a === true;
}
async function resolveWhatsappPhoneNumberIdFromOrgTable(admin, organizationId, webId) {
  const wid = String(webId).trim();
  const targetDigits = wid ? WA_ORG_LINE_DIGITS[wid] : null;
  if (!targetDigits) return null;
  try {
    const { data: rows, error } = await admin.from("organization_whatsapp_accounts").select("phone_number_id, display_phone_number, is_active").eq("organization_id", organizationId);
    if (error) {
      console.warn("wa-click-track: organization_whatsapp_accounts lookup failed", error.message);
      return null;
    }
    if (!Array.isArray(rows)) return null;
    for (const raw of rows) {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
      const row = raw;
      if (!orgWhatsappRowIsActive(row)) continue;
      const disp = normalizeIndonesiaMarketingDigits(String(row["display_phone_number"] ?? ""));
      const pid = pickPhoneNumberIdFromAccountRow(row);
      if (!pid || !disp) continue;
      if (disp === targetDigits) return pid;
    }
  } catch (e) {
    console.warn("wa-click-track: organization_whatsapp_accounts exception", e);
  }
  return null;
}
function parseOwnerTemplateConfig(graphPhoneNumberId) {
  const token = getEnvOptional("WHATSAPP_ACCESS_TOKEN");
  const phoneNumberId = (graphPhoneNumberId?.trim() || getEnvOptional("WHATSAPP_PHONE_NUMBER_ID") || "").trim();
  const toE164 = getEnvOptional("WHATSAPP_OWNER_TO_E164");
  const templateName = getEnvOptional("WHATSAPP_OWNER_TEMPLATE_NAME") ?? getEnvOptional("WHATSAPP_TEMPLATE_NAME");
  if (!token || !phoneNumberId || !toE164 || !templateName) {
    return null;
  }
  const language = getEnvOptional("WHATSAPP_OWNER_TEMPLATE_LANGUAGE") ?? getEnvOptional("WHATSAPP_TEMPLATE_LANGUAGE") ?? "id";
  const graphVersion = getEnvOptional("WHATSAPP_GRAPH_VERSION") ?? "v21.0";
  const bodyKeys = parseCsvList(
    getEnvOptional("WHATSAPP_OWNER_TEMPLATE_BODY_KEYS") ?? getEnvOptional("WHATSAPP_TEMPLATE_BODY_KEYS")
  );
  const bodyParamNamesRaw = parseCsvList(
    getEnvOptional("WHATSAPP_OWNER_TEMPLATE_BODY_PARAMETER_NAMES") ?? getEnvOptional("WHATSAPP_TEMPLATE_BODY_PARAMETER_NAMES")
  );
  const bodyParamNames = bodyParamNamesRaw.length === bodyKeys.length ? bodyParamNamesRaw : null;
  return {
    token,
    phoneNumberId,
    toE164,
    templateName,
    language,
    graphVersion,
    bodyKeys,
    bodyParamNames
  };
}
function extractAttributionForDb(raw) {
  const obj = raw && typeof raw === "object" ? raw : null;
  const allow = /* @__PURE__ */ new Set([
    "landing_url",
    "referrer",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
    "meta_campaign_name",
    "meta_adset_name",
    "meta_ad_name",
    "has_gclid",
    "has_fbclid",
    "has_msclkid",
    "has_gbraid",
    "has_wbraid"
  ]);
  const out = {};
  if (!obj) return out;
  for (const [k, v] of Object.entries(obj)) {
    if (!allow.has(k)) continue;
    if (typeof v === "boolean") {
      if (v) out[k] = "true";
      continue;
    }
    if (typeof v !== "string") continue;
    const max = k === "landing_url" ? MAX_LANDING_URL_LEN : MAX_UTM_LEN;
    const clipped = clipText(v, max);
    if (clipped) out[k] = clipped;
  }
  return out;
}
function ownerTemplateCtxFromBody(body) {
  const a = body.attribution ?? {};
  const s = (x, max) => clipText(x, max);
  const utmSource = s(a["utm_source"], 200);
  const utmMedium = s(a["utm_medium"], 200);
  const utmCampaign = s(a["utm_campaign"], 200);
  const landingUrl = s(a["landing_url"], 300);
  const path = s(body.path, 200);
  const compatNeeds = [utmSource && `source=${utmSource}`, utmMedium && `medium=${utmMedium}`, utmCampaign && `campaign=${utmCampaign}`].filter(Boolean).join(" | ");
  return {
    web_id: s(body.web_id, 32),
    path,
    target_url: s(body.target_url ?? "", 300),
    landing_url: landingUrl,
    utm_source: utmSource,
    utm_medium: utmMedium,
    utm_campaign: utmCampaign,
    utm_content: s(a["utm_content"], 200),
    utm_term: s(a["utm_term"], 200),
    meta_campaign_name: s(a["meta_campaign_name"], 200),
    meta_adset_name: s(a["meta_adset_name"], 200),
    meta_ad_name: s(a["meta_ad_name"], 200),
    session_id: s(body.session_id, 36),
    ts: s(body.ts ?? (/* @__PURE__ */ new Date()).toISOString(), 32),
    // Common keys used by existing customer template(s)
    name: "WA Click (Tracking)",
    phone_number: "",
    email: "",
    needs: compatNeeds || "Klik tombol WhatsApp",
    job_title: `Path: ${path}`.slice(0, 120),
    industry: utmCampaign || utmSource || "Website",
    business_type: "B2C"
  };
}
async function sendOwnerTemplate(config, ctx) {
  const toDigits = waToDigitsForGraphApi(config.toE164);
  if (!toDigits) {
    return { ok: false, error: "Invalid WHATSAPP_OWNER_TO_E164" };
  }
  const parameters = config.bodyKeys.map((k, i) => {
    const text2 = (ctx[k] ?? "").trim().slice(0, 1024) || "\u2014";
    const p = { type: "text", text: text2 };
    if (config.bodyParamNames?.[i]) {
      p.parameter_name = config.bodyParamNames[i];
    }
    return p;
  });
  const template = {
    name: config.templateName,
    language: { code: config.language }
  };
  if (parameters.length > 0) {
    template.components = [{ type: "body", parameters }];
  }
  const url = `https://graph.facebook.com/${config.graphVersion}/${config.phoneNumberId}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.token}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: toDigits,
      type: "template",
      template
    })
  });
  const text = await res.text();
  if (!res.ok) {
    console.error("wa-click-track: owner WhatsApp notify failed", {
      status: res.status,
      template: config.templateName,
      preview: text.slice(0, 400)
    });
    return { ok: false, error: `WhatsApp API error (${res.status}): ${text.slice(0, 500)}` };
  }
  return { ok: true };
}
Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsPreflightHeaders(origin) });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders(origin) });
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateOk(ip)) {
    return json({ error: "rate limit" }, { status: 429, headers: corsHeaders(origin) });
  }
  let body;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON", origin);
  }
  if (!body?.session_id || !isUuid(body.session_id)) {
    return badRequest("Invalid session_id", origin);
  }
  if (!validPath(body.path)) {
    return badRequest("Invalid path", origin);
  }
  const targetUrl = body.target_url ? clipText(body.target_url, MAX_URL_LEN) : "";
  const uaHash = body.ua_hash ? clipText(body.ua_hash, 64) : "";
  let supabaseUrl;
  let serviceRoleKey;
  try {
    supabaseUrl = mustGetEnv("SUPABASE_URL");
    serviceRoleKey = mustGetEnv("SUPABASE_SERVICE_ROLE_KEY");
  } catch (e) {
    return json({ error: e.message }, { status: 500, headers: corsHeaders(origin) });
  }
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const resolved = await resolveActiveProperty(admin, body.web_id);
  if (!resolved.ok) {
    return json(
      { error: resolved.error },
      { status: resolved.status === 403 ? 403 : 400, headers: corsHeaders(origin) }
    );
  }
  const webId = resolved.property.slug;
  const orgId = resolved.property.organization_id;
  const propertyDisplayName = resolved.property.display_name;
  const graphPhoneNumberId = await resolveWhatsappPhoneNumberIdFromOrgTable(admin, orgId, webId);
  const attribution = extractAttributionForDb(body.attribution ?? null);
  const resolvedGclid = await resolveGclidForEvent(admin, body.session_id, body.gclid);
  const ipHash = ip !== "unknown" ? toIpHash(ip) : null;
  const { error: insErr } = await admin.from("analytics_wa_clicks").insert({
    web_id: webId,
    session_id: body.session_id,
    path: body.path,
    target_url: targetUrl || null,
    attribution: Object.keys(attribution).length ? attribution : null,
    gclid: resolvedGclid,
    phone_number: null,
    ua_hash: uaHash || null,
    ip_hash: ipHash
  });
  if (insErr) {
    console.error("wa-click-track: insert failed", insErr);
    return json({ error: "persist failed" }, { status: 500, headers: corsHeaders(origin) });
  }
  let hubSync = {};
  try {
    const systemUserId = mustGetEnv("SYSTEM_USER_ID");
    const hubResult = await syncWaFloatingClickToHub({
      admin,
      organizationId: orgId,
      webId,
      systemUserId,
      analyticsSessionId: body.session_id,
      attribution: Object.keys(attribution).length ? attribution : null,
      gclid: resolvedGclid,
      path: body.path,
      targetUrl: targetUrl || null,
      propertyDisplayName
    });
    if (hubResult.ok) {
      hubSync = { lead_id: hubResult.lead_id, submission_id: hubResult.submission_id };
    } else if (!hubResult.skipped) {
      console.warn("wa-click-track: hub_sync_error", hubResult.error);
      hubSync = { hub_sync_error: hubResult.error };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("wa-click-track: hub_sync_error", e);
    hubSync = { hub_sync_error: msg };
  }
  const cfg = parseOwnerTemplateConfig(graphPhoneNumberId);
  let owner_notify = { ok: true, skipped: true };
  if (cfg) {
    const ctx = ownerTemplateCtxFromBody({
      ...body,
      web_id: webId,
      target_url: targetUrl || null,
      ua_hash: uaHash || null
    });
    const sent = await sendOwnerTemplate(cfg, ctx);
    owner_notify = sent.ok ? { ok: true } : { ok: false, error: sent.error };
  }
  return json(
    { ok: true, owner_notify, ...hubSync },
    {
      headers: corsHeaders(origin)
    }
  );
});

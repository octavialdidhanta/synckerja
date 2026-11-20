// @ts-nocheck
// supabase/functions-src/analytics-ingest/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// supabase/functions/_shared/gclid.ts
var MAX_GCLID_LEN = 500;
function normalizeGclid(raw) {
  if (raw === void 0 || raw === null) return null;
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t) return null;
  return t.length <= MAX_GCLID_LEN ? t : t.slice(0, MAX_GCLID_LEN);
}

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

// supabase/functions-src/analytics-ingest/index.ts
var MAX_EVENTS = 50;
var MAX_PATH_LEN = 512;
var MAX_LABEL_LEN = 200;
var MAX_URL_LEN = 2e3;
var MAX_TRACK_KEY_LEN = 80;
var MAX_LANDING_URL_LEN = 1e3;
var MAX_UTM_LEN = 200;
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
    if (v != null && v !== "") {
      h[k] = v;
    }
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
var rateState = /* @__PURE__ */ new Map();
function rateOk(ip) {
  const minute = Math.floor(Date.now() / 6e4);
  const cur = rateState.get(ip);
  if (!cur || cur.minute !== minute) {
    rateState.set(ip, { minute, count: 1 });
    return true;
  }
  cur.count += 1;
  return cur.count <= 400;
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
  if (s.length === 0) return "";
  return s.length <= max ? s : s.slice(0, max);
}
function looksMetaUtmSource(raw) {
  const s = raw.trim().toLowerCase();
  if (!s) return false;
  const exact = /* @__PURE__ */ new Set([
    "fb",
    "ig",
    "msg",
    "an",
    "facebook",
    "instagram",
    "messenger",
    "fbinstagram",
    "audience_network",
    "audnetwork"
  ]);
  if (exact.has(s)) return true;
  if (s.includes("facebook") || s.includes("instagram")) return true;
  return false;
}
async function closeOpenPageViews(supabase, sessionId, webId) {
  await supabase.from("analytics_page_views").update({ ended_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("session_id", sessionId).eq("web_id", webId).is("ended_at", null);
}
async function applyActivePing(supabase, sessionId, path, delta, scrollMaxPct, webId) {
  if (delta <= 0 || delta > 12e4) return;
  const { data: row } = await supabase.from("analytics_page_views").select("id, active_ms, path, scroll_max_pct").eq("session_id", sessionId).eq("web_id", webId).is("ended_at", null).order("started_at", { ascending: false }).limit(1).maybeSingle();
  if (!row?.id || row.path !== path) return;
  const incoming = typeof scrollMaxPct === "number" && Number.isFinite(scrollMaxPct) ? scrollMaxPct : null;
  const clipped = incoming == null ? null : Math.max(0, Math.min(100, Math.floor(incoming)));
  const prev = typeof row.scroll_max_pct === "number" ? row.scroll_max_pct : 0;
  const nextScroll = clipped == null ? prev : Math.max(prev, clipped);
  await supabase.from("analytics_page_views").update({ active_ms: (row.active_ms ?? 0) + delta, scroll_max_pct: nextScroll }).eq("id", row.id);
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
  if (!Array.isArray(body.events) || body.events.length === 0 || body.events.length > MAX_EVENTS) {
    return badRequest("Invalid events", origin);
  }
  const url = mustGetEnv("SUPABASE_URL");
  const key = mustGetEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const resolved = await resolveActiveProperty(supabase, body.web_id);
  if (!resolved.ok) {
    return json(
      { error: resolved.error },
      { status: resolved.status, headers: corsHeaders(origin) }
    );
  }
  const webId = resolved.property.slug;
  let mergedRef = null;
  let mergedUa = null;
  let mergedAuth = body.auth_user_id && isUuid(body.auth_user_id) ? body.auth_user_id : null;
  let mergedLanding = "";
  let mergedUtmSource = "";
  let mergedUtmMedium = "";
  let mergedUtmCampaign = "";
  let mergedUtmContent = "";
  let mergedUtmTerm = "";
  let mergedMetaCampaign = "";
  let mergedMetaAdset = "";
  let mergedMetaAd = "";
  let mergedGclid = "";
  let mergedHasGclid = false;
  let mergedHasFbclid = false;
  let mergedHasMsclkid = false;
  let mergedHasGbraid = false;
  let mergedHasWbraid = false;
  for (const ev of body.events) {
    if (ev?.type === "session_touch") {
      const st = ev;
      if (st.referrer) mergedRef = st.referrer.slice(0, 500);
      if (st.ua_hash) mergedUa = st.ua_hash.slice(0, 64);
      if (st.auth_user_id && isUuid(st.auth_user_id)) mergedAuth = st.auth_user_id;
      const lu = clipText(st.landing_url, MAX_LANDING_URL_LEN);
      if (lu && !mergedLanding) mergedLanding = lu;
      const us = clipText(st.utm_source, MAX_UTM_LEN);
      if (us && !mergedUtmSource) mergedUtmSource = us;
      const um = clipText(st.utm_medium, MAX_UTM_LEN);
      if (um && !mergedUtmMedium) mergedUtmMedium = um;
      const uc = clipText(st.utm_campaign, MAX_UTM_LEN);
      if (uc && !mergedUtmCampaign) mergedUtmCampaign = uc;
      const uco = clipText(st.utm_content, MAX_UTM_LEN);
      if (uco && !mergedUtmContent) mergedUtmContent = uco;
      const ut = clipText(st.utm_term, MAX_UTM_LEN);
      if (ut && !mergedUtmTerm) mergedUtmTerm = ut;
      const mc = clipText(st.meta_campaign_name, MAX_UTM_LEN);
      if (mc && !mergedMetaCampaign) mergedMetaCampaign = mc;
      const mas = clipText(st.meta_adset_name, MAX_UTM_LEN);
      if (mas && !mergedMetaAdset) mergedMetaAdset = mas;
      const mad = clipText(st.meta_ad_name, MAX_UTM_LEN);
      if (mad && !mergedMetaAd) mergedMetaAd = mad;
      const gc = normalizeGclid(st.gclid);
      if (gc && !mergedGclid) mergedGclid = gc;
      mergedHasGclid = mergedHasGclid || Boolean(st.has_gclid) || Boolean(gc);
      mergedHasFbclid = mergedHasFbclid || Boolean(st.has_fbclid);
      mergedHasMsclkid = mergedHasMsclkid || Boolean(st.has_msclkid);
      mergedHasGbraid = mergedHasGbraid || Boolean(st.has_gbraid);
      mergedHasWbraid = mergedHasWbraid || Boolean(st.has_wbraid);
    }
  }
  const hasExplicitMeta = mergedMetaCampaign.length > 0 || mergedMetaAdset.length > 0 || mergedMetaAd.length > 0;
  if (!hasExplicitMeta && (mergedHasFbclid || looksMetaUtmSource(mergedUtmSource))) {
    if (mergedUtmCampaign.length > 0) mergedMetaCampaign = mergedUtmCampaign;
    if (mergedUtmMedium.length > 0) mergedMetaAdset = mergedUtmMedium;
    if (mergedUtmContent.length > 0) mergedMetaAd = mergedUtmContent;
  }
  const visitorRaw = typeof body.visitor_id === "string" && body.visitor_id.trim().length > 0 ? body.visitor_id.trim() : body.session_id;
  const pVisitorId = visitorRaw.length > 64 ? visitorRaw.slice(0, 64) : visitorRaw;
  const { error: touchErr } = await supabase.rpc("analytics_session_touch", {
    p_session: body.session_id,
    p_web_id: webId,
    p_referrer: mergedRef ?? "",
    p_ua_hash: mergedUa ?? "",
    p_auth: mergedAuth,
    p_landing_url: mergedLanding,
    p_utm_source: mergedUtmSource,
    p_utm_medium: mergedUtmMedium,
    p_utm_campaign: mergedUtmCampaign,
    p_utm_content: mergedUtmContent,
    p_utm_term: mergedUtmTerm,
    p_meta_campaign_name: mergedMetaCampaign,
    p_meta_adset_name: mergedMetaAdset,
    p_meta_ad_name: mergedMetaAd,
    p_has_gclid: mergedHasGclid,
    p_has_fbclid: mergedHasFbclid,
    p_has_msclkid: mergedHasMsclkid,
    p_has_gbraid: mergedHasGbraid,
    p_has_wbraid: mergedHasWbraid,
    p_visitor_id: pVisitorId,
    p_gclid: mergedGclid || null
  });
  if (touchErr) {
    console.error("analytics_session_touch", touchErr);
    return json({ error: "persist failed" }, { status: 500, headers: corsHeaders(origin) });
  }
  for (const ev of body.events) {
    if (!ev || typeof ev !== "object" || !("type" in ev)) {
      return badRequest("Invalid event", origin);
    }
    switch (ev.type) {
      case "session_touch":
        break;
      case "page_view": {
        if (!validPath(ev.path)) return badRequest("Invalid path", origin);
        await closeOpenPageViews(supabase, body.session_id, webId);
        const { error } = await supabase.from("analytics_page_views").insert({
          session_id: body.session_id,
          web_id: webId,
          path: ev.path,
          started_at: (/* @__PURE__ */ new Date()).toISOString(),
          active_ms: 0
        });
        if (error) console.error("page_view", error);
        break;
      }
      case "active_ping": {
        if (!validPath(ev.path)) return badRequest("Invalid path", origin);
        const d = Math.floor(Number(ev.delta_ms));
        const smp = typeof ev.scroll_max_pct === "number" ? Number(ev.scroll_max_pct) : null;
        await applyActivePing(supabase, body.session_id, ev.path, d, smp, webId);
        break;
      }
      case "page_end": {
        if (!validPath(ev.path)) return badRequest("Invalid path", origin);
        const incoming = typeof ev.scroll_max_pct === "number" ? Number(ev.scroll_max_pct) : null;
        const clipped = incoming == null || !Number.isFinite(incoming) ? null : Math.max(0, Math.min(100, Math.floor(incoming)));
        const { data: row } = await supabase.from("analytics_page_views").select("id, scroll_max_pct").eq("session_id", body.session_id).eq("web_id", webId).eq("path", ev.path).is("ended_at", null).order("started_at", { ascending: false }).limit(1).maybeSingle();
        if (row?.id) {
          const prev = typeof row.scroll_max_pct === "number" ? row.scroll_max_pct : 0;
          const nextScroll = clipped == null ? prev : Math.max(prev, clipped);
          await supabase.from("analytics_page_views").update({ ended_at: (/* @__PURE__ */ new Date()).toISOString(), scroll_max_pct: nextScroll }).eq("id", row.id);
        }
        break;
      }
      case "click": {
        if (!validPath(ev.path)) return badRequest("Invalid path", origin);
        const label = (ev.element_label ?? "").toString().slice(0, MAX_LABEL_LEN);
        const et = (ev.element_type ?? "unknown").toString().slice(0, 40);
        const rawTk = ev.track_key ? String(ev.track_key).trim() : "";
        const tk = rawTk.length > 0 ? rawTk.slice(0, MAX_TRACK_KEY_LEN) : `${label || "unknown"}_${et === "a" ? "link" : "cta"}`.toLowerCase().replace(/[^a-z0-9_:\\-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, MAX_TRACK_KEY_LEN);
        const tu = ev.target_url ? String(ev.target_url).slice(0, MAX_URL_LEN) : null;
        const { error } = await supabase.from("analytics_click_events").insert({
          session_id: body.session_id,
          web_id: webId,
          path: ev.path,
          track_key: tk,
          element_type: et,
          element_label: label,
          target_url: tu,
          is_internal: Boolean(ev.is_internal)
        });
        if (error) console.error("click", error);
        break;
      }
      default:
        return badRequest("Unknown event type", origin);
    }
  }
  return json({ ok: true }, { headers: corsHeaders(origin) });
});

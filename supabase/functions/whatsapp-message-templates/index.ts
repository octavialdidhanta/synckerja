/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const META_API_BASE = "https://graph.facebook.com/v18.0";

type GraphContext = {
  orgId: string;
  wabaId: string;
  accessToken: string;
};

type MetaGraphErrorBody = {
  error?: {
    message?: string;
    error_user_msg?: string;
    error_user_title?: string;
    code?: number;
    error_subcode?: number;
    type?: string;
  };
};

function metaGraphErrorMessage(json: unknown, fallback = "Meta API error"): string {
  const err = (json as MetaGraphErrorBody)?.error;
  const userMsg = (err?.error_user_msg ?? "").trim();
  if (userMsg) return userMsg;
  const msg = (err?.message ?? "").trim();
  if (msg) return msg;
  return fallback;
}

function metaGraphErrorCode(json: unknown): string | null {
  const err = (json as MetaGraphErrorBody)?.error;
  const code = err?.code;
  const sub = err?.error_subcode;
  if (code == null && sub == null) return null;
  return sub != null ? `META_${code}_${sub}` : `META_${code}`;
}

type MetaDeleteResult =
  | { ok: true; result: unknown }
  | { ok: false; status: number; json: unknown };

type TemplateAnalyticsTotals = { delivered: number; read: number };

/** Sum DELIVERED/READ from Meta `/{waba-id}/template_analytics` (last 30 days). */
function parseTemplateAnalyticsResponse(json: unknown): Map<string, TemplateAnalyticsTotals> {
  const map = new Map<string, TemplateAnalyticsTotals>();
  const blocks = (json as { data?: unknown })?.data;
  if (!Array.isArray(blocks)) return map;
  for (const block of blocks) {
    const points = (block as { data_points?: unknown })?.data_points;
    if (!Array.isArray(points)) continue;
    for (const pt of points) {
      const templateId = String((pt as { template_id?: string }).template_id ?? "").trim();
      if (!templateId) continue;
      const delivered = Number((pt as { delivered?: number }).delivered ?? 0);
      const read = Number((pt as { read?: number }).read ?? 0);
      const prev = map.get(templateId) ?? { delivered: 0, read: 0 };
      map.set(templateId, {
        delivered: prev.delivered + (Number.isFinite(delivered) ? delivered : 0),
        read: prev.read + (Number.isFinite(read) ? read : 0),
      });
    }
  }
  return map;
}

async function fetchTemplateAnalyticsTotals(
  ctx: GraphContext,
  templateIds: string[],
): Promise<Map<string, TemplateAnalyticsTotals>> {
  const ids = [...new Set(templateIds.map((id) => String(id).trim()).filter(Boolean))].slice(0, 50);
  if (ids.length === 0) return new Map();

  const end = Math.floor(Date.now() / 1000);
  const start = end - 30 * 86400;
  const params = new URLSearchParams({
    start: String(start),
    end: String(end),
    granularity: "DAILY",
    metric_types: "SENT,DELIVERED,READ",
    template_ids: JSON.stringify(ids),
  });
  const url =
    `${META_API_BASE}/${encodeURIComponent(ctx.wabaId)}/template_analytics?${params.toString()}`;
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${ctx.accessToken}` } });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return new Map();
    return parseTemplateAnalyticsResponse(json);
  } catch {
    return new Map();
  }
}

function mergeAnalyticsIntoTemplates(
  templates: Array<Record<string, unknown>>,
  totals: Map<string, TemplateAnalyticsTotals>,
): void {
  for (const t of templates) {
    const id = String(t.id ?? "").trim();
    const stats = totals.get(id);
    if (!stats) continue;
    t._template_analytics = {
      messages_delivered: stats.delivered,
      messages_read: stats.read,
    };
  }
}

/** DELETE template — primary: hsm_id+name; fallback: hsm_ids=[id] per Meta batch delete. */
async function deleteMessageTemplateOnMeta(
  ctx: GraphContext,
  hsmId: string,
  templateName: string,
): Promise<MetaDeleteResult> {
  const authHeaders = { Authorization: `Bearer ${ctx.accessToken}` };

  const byIdUrl =
    `${META_API_BASE}/${encodeURIComponent(ctx.wabaId)}/message_templates?hsm_id=${encodeURIComponent(hsmId)}&name=${encodeURIComponent(templateName)}`;
  const res = await fetch(byIdUrl, { method: "DELETE", headers: authHeaders });
  const json = await res.json().catch(() => ({}));

  if (res.ok) {
    return { ok: true as const, result: json };
  }

  const byIdsUrl =
    `${META_API_BASE}/${encodeURIComponent(ctx.wabaId)}/message_templates?hsm_ids=[${encodeURIComponent(hsmId)}]`;
  const res2 = await fetch(byIdsUrl, { method: "DELETE", headers: authHeaders });
  const json2 = await res2.json().catch(() => ({}));
  if (res2.ok) {
    return { ok: true as const, result: json2 };
  }

  const status = res2.status >= 400 ? res2.status : res.status;
  const merged = (json2 as MetaGraphErrorBody)?.error ? json2 : json;
  return { ok: false as const, status, json: merged };
}

/** When DB has no WABA but live send works (phone_number_id + token), resolve WABA via Graph. */
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
  /** `organization_whatsapp_accounts.id` — when set, use that row (org-scoped); otherwise first active account + meta fallback. */
  whatsappAccountId: string | null,
): Promise<GraphContext | null> {
  /** Templates are scoped to the user's active organization only (no cross-org fallback). */
  if (!activeOrgId) return null;

  const tryOrg = async (oid: string): Promise<GraphContext | null> => {
    const accId = (whatsappAccountId ?? "").trim();

    if (accId) {
      const { data: row } = await supabaseAdmin
        .from("organization_whatsapp_accounts")
        .select("meta_access_token, whatsapp_business_account_id, phone_number_id")
        .eq("organization_id", oid)
        .eq("id", accId)
        .maybeSingle();
      if (!row) return null;
      let accessToken = (row.meta_access_token ?? "").toString().trim();
      if (!accessToken) {
        const { data: metaOnly } = await supabaseAdmin
          .from("organization_meta_config")
          .select("meta_access_token")
          .eq("organization_id", oid)
          .maybeSingle();
        accessToken = (metaOnly?.meta_access_token ?? "").toString().trim();
      }
      if (!accessToken) return null;
      let wabaId = (row.whatsapp_business_account_id ?? "").toString().trim();
      const phoneNumberId = (row.phone_number_id ?? "").toString().trim();
      if (!wabaId && phoneNumberId) {
        wabaId = (await fetchWabaIdFromPhoneNumberId(phoneNumberId, accessToken)) ?? "";
      }
      if (!wabaId) return null;
      return { orgId: oid, wabaId, accessToken };
    }

    const { data: meta } = await supabaseAdmin
      .from("organization_meta_config")
      .select("whatsapp_business_account_id, meta_access_token")
      .eq("organization_id", oid)
      .maybeSingle();
    const { data: accRow } = await supabaseAdmin
      .from("organization_whatsapp_accounts")
      .select("meta_access_token, whatsapp_business_account_id, phone_number_id")
      .eq("organization_id", oid)
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
    return { orgId: oid, wabaId, accessToken };
  };

  return await tryOrg(activeOrgId);
}

type SanitizeResult =
  | { ok: true; components: Record<string, unknown>[] }
  | { ok: false; code: string; error: string };

const MAX_BUTTONS = 10;
const BTN_TEXT_MAX = 25;
const URL_MAX = 2000;
const COPY_CODE_EXAMPLE_MAX = 25;

function quickReplyIndices(buttons: Record<string, unknown>[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < buttons.length; i++) {
    if (String(buttons[i]?.type ?? "").toUpperCase() === "QUICK_REPLY") out.push(i);
  }
  return out;
}

function validateQuickReplyGrouping(buttons: Record<string, unknown>[]): string | null {
  const idx = quickReplyIndices(buttons);
  if (idx.length === 0) return null;
  const first = idx[0];
  const last = idx[idx.length - 1];
  for (let i = first; i <= last; i++) {
    if (String(buttons[i]?.type ?? "").toUpperCase() !== "QUICK_REPLY") {
      return "Invalid button order: quick replies must be contiguous";
    }
  }
  if (first !== 0 && last !== buttons.length - 1) {
    return "Invalid button order: quick replies must be all at start or all at end";
  }
  return null;
}

function normalizeUrlButtonExample(raw: unknown): unknown[] | null {
  if (raw === undefined || raw === null) return null;
  if (Array.isArray(raw)) {
    const s = raw.map((x) => String(x ?? "").trim()).filter(Boolean);
    return s.length ? s : null;
  }
  const one = String(raw).trim();
  return one ? [one] : null;
}

/** Validates and normalizes template `components` before POST to Graph (defense in depth). */
function sanitizeTemplateComponentsForCreate(raw: unknown): SanitizeResult {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { ok: false, code: "MISSING_COMPONENTS", error: "Missing components array" };
  }
  const out: Record<string, unknown>[] = [];
  let hasBody = false;

  for (const item of raw) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) {
      return { ok: false, code: "INVALID_COMPONENT", error: "Each component must be an object" };
    }
    const c = item as Record<string, unknown>;
    const type = String(c.type ?? "").toUpperCase();

    if (type === "HEADER") {
      const fmt = String(c.format ?? "TEXT").toUpperCase();
      if (fmt === "TEXT") {
        const text = String(c.text ?? "").trim();
        if (!text) return { ok: false, code: "INVALID_HEADER", error: "HEADER TEXT requires non-empty text" };
        const row: Record<string, unknown> = { type: "HEADER", format: "TEXT", text };
        if (c.example !== undefined && typeof c.example === "object") row.example = c.example;
        out.push(row);
        continue;
      }
      if (fmt === "IMAGE" || fmt === "VIDEO" || fmt === "DOCUMENT") {
        const ex = c.example as Record<string, unknown> | undefined;
        const handles = ex?.header_handle;
        if (!Array.isArray(handles) || typeof handles[0] !== "string" || !String(handles[0]).trim()) {
          return { ok: false, code: "INVALID_HEADER", error: `HEADER ${fmt} requires example.header_handle[0]` };
        }
        out.push({
          type: "HEADER",
          format: fmt,
          example: { header_handle: [String(handles[0]).trim()] },
        });
        continue;
      }
      return { ok: false, code: "INVALID_HEADER", error: `Unsupported HEADER format: ${fmt}` };
    }

    if (type === "BODY") {
      const text = String(c.text ?? "").trim();
      if (!text) return { ok: false, code: "INVALID_BODY", error: "BODY requires non-empty text" };
      const row: Record<string, unknown> = { type: "BODY", text };
      if (c.example !== undefined && typeof c.example === "object") row.example = c.example;
      out.push(row);
      hasBody = true;
      continue;
    }

    if (type === "FOOTER") {
      const text = String(c.text ?? "").trim();
      if (!text) return { ok: false, code: "INVALID_FOOTER", error: "FOOTER requires non-empty text" };
      out.push({ type: "FOOTER", text: text.slice(0, 60) });
      continue;
    }

    if (type === "BUTTONS") {
      const buttons = c.buttons;
      if (!Array.isArray(buttons) || buttons.length === 0) {
        return { ok: false, code: "INVALID_BUTTONS", error: "BUTTONS requires non-empty buttons array" };
      }
      if (buttons.length > MAX_BUTTONS) {
        return { ok: false, code: "INVALID_BUTTONS", error: `Too many buttons (max ${MAX_BUTTONS})` };
      }
      const rawBtnObjs: Record<string, unknown>[] = [];
      for (const b of buttons) {
        if (b === null || typeof b !== "object" || Array.isArray(b)) {
          return { ok: false, code: "INVALID_BUTTONS", error: "Invalid button entry" };
        }
        rawBtnObjs.push(b as Record<string, unknown>);
      }
      const qrErr = validateQuickReplyGrouping(rawBtnObjs);
      if (qrErr) return { ok: false, code: "INVALID_BUTTONS", error: qrErr };

      let urlCount = 0;
      let phoneCount = 0;
      let copyCount = 0;
      let flowCount = 0;
      let voiceCount = 0;
      for (const bt of rawBtnObjs) {
        const k = String(bt.type ?? "").toUpperCase();
        if (k === "URL") urlCount++;
        else if (k === "PHONE_NUMBER") phoneCount++;
        else if (k === "COPY_CODE") copyCount++;
        else if (k === "FLOW") flowCount++;
        else if (k === "VOICE_CALL") voiceCount++;
      }
      if (urlCount > 2) return { ok: false, code: "INVALID_BUTTONS", error: "Too many URL buttons (max 2)" };
      if (phoneCount > 1) return { ok: false, code: "INVALID_BUTTONS", error: "Too many PHONE_NUMBER buttons (max 1)" };
      if (copyCount > 1) return { ok: false, code: "INVALID_BUTTONS", error: "Too many COPY_CODE buttons (max 1)" };
      if (flowCount > 1) return { ok: false, code: "INVALID_BUTTONS", error: "Too many FLOW buttons (max 1)" };
      if (voiceCount > 1) return { ok: false, code: "INVALID_BUTTONS", error: "Too many VOICE_CALL buttons (max 1)" };

      const cleanBtns: Record<string, unknown>[] = [];
      for (const b of buttons) {
        if (b === null || typeof b !== "object" || Array.isArray(b)) {
          return { ok: false, code: "INVALID_BUTTONS", error: "Invalid button entry" };
        }
        const bt = b as Record<string, unknown>;
        const btType = String(bt.type ?? "").toUpperCase();
        if (btType === "QUICK_REPLY") {
          const t = String(bt.text ?? "").trim();
          if (!t || t.length > BTN_TEXT_MAX) return { ok: false, code: "INVALID_BUTTONS", error: "QUICK_REPLY text invalid" };
          cleanBtns.push({ type: "QUICK_REPLY", text: t });
          continue;
        }
        if (btType === "URL") {
          const t = String(bt.text ?? "").trim();
          const url = String(bt.url ?? "").trim();
          if (!t || t.length > BTN_TEXT_MAX || !/^https?:\/\//i.test(url) || url.length > URL_MAX) {
            return { ok: false, code: "INVALID_BUTTONS", error: "URL button text or url invalid" };
          }
          const row: Record<string, unknown> = { type: "URL", text: t, url };
          const hasVar = /\{\{1\}\}/.test(url);
          if (hasVar) {
            const ex = normalizeUrlButtonExample(bt.example);
            if (!ex || !ex[0]) {
              return { ok: false, code: "INVALID_BUTTONS", error: "URL with {{1}} requires example" };
            }
            row.example = ex;
          } else if (bt.example !== undefined) {
            const ex = normalizeUrlButtonExample(bt.example);
            if (ex) row.example = ex;
          }
          cleanBtns.push(row);
          continue;
        }
        if (btType === "PHONE_NUMBER") {
          const t = String(bt.text ?? "").trim();
          const phone = String(bt.phone_number ?? "").trim();
          if (!t || t.length > BTN_TEXT_MAX || !/^\+[1-9]\d{6,14}$/.test(phone)) {
            return { ok: false, code: "INVALID_BUTTONS", error: "PHONE_NUMBER button invalid" };
          }
          cleanBtns.push({ type: "PHONE_NUMBER", text: t, phone_number: phone });
          continue;
        }
        if (btType === "COPY_CODE") {
          let sample = "";
          const ex = bt.example;
          if (Array.isArray(ex) && typeof ex[0] === "string") sample = String(ex[0]).trim();
          else if (typeof ex === "string") sample = ex.trim();
          if (!sample) return { ok: false, code: "INVALID_BUTTONS", error: "COPY_CODE requires example" };
          if (sample.length > COPY_CODE_EXAMPLE_MAX) {
            return { ok: false, code: "INVALID_BUTTONS", error: "COPY_CODE example too long" };
          }
          cleanBtns.push({ type: "COPY_CODE", example: [sample] });
          continue;
        }
        if (btType === "FLOW") {
          const t = String(bt.text ?? "").trim();
          const flowId = String(bt.flow_id ?? "").trim();
          if (!t || t.length > BTN_TEXT_MAX || !flowId) {
            return { ok: false, code: "INVALID_BUTTONS", error: "FLOW button text or flow_id invalid" };
          }
          let fa = String(bt.flow_action ?? "navigate").trim().toLowerCase().replace(/-/g, "_");
          if (fa !== "navigate" && fa !== "data_exchange") {
            return { ok: false, code: "INVALID_BUTTONS", error: "FLOW flow_action must be navigate or data_exchange" };
          }
          const row: Record<string, unknown> = { type: "FLOW", text: t, flow_id: flowId, flow_action: fa };
          if (fa === "navigate") {
            const nav = String(bt.navigate_screen ?? "").trim();
            if (!nav) return { ok: false, code: "INVALID_BUTTONS", error: "FLOW navigate_screen required when flow_action is navigate" };
            row.navigate_screen = nav;
          }
          const icon = String(bt.icon ?? "").trim().toUpperCase();
          if (icon && icon !== "DEFAULT") {
            if (!["DOCUMENT", "PROMOTION", "REVIEW"].includes(icon)) {
              return { ok: false, code: "INVALID_BUTTONS", error: "FLOW icon must be DOCUMENT, PROMOTION, or REVIEW" };
            }
            row.icon = icon;
          }
          cleanBtns.push(row);
          continue;
        }
        if (btType === "VOICE_CALL") {
          const t = String(bt.text ?? "").trim();
          if (!t || t.length > BTN_TEXT_MAX) return { ok: false, code: "INVALID_BUTTONS", error: "VOICE_CALL text invalid" };
          cleanBtns.push({ type: "VOICE_CALL", text: t });
          continue;
        }
        return { ok: false, code: "INVALID_BUTTONS", error: `Unsupported button type: ${btType}` };
      }
      out.push({ type: "BUTTONS", buttons: cleanBtns });
      continue;
    }

    return { ok: false, code: "INVALID_COMPONENT", error: `Unsupported component type: ${type}` };
  }

  if (!hasBody) return { ok: false, code: "INVALID_COMPONENTS", error: "BODY component required" };
  return { ok: true, components: out };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  if (req.method !== "GET" && req.method !== "POST" && req.method !== "DELETE") {
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

    const FIELDS_LIST =
      "id,name,status,category,language,rejected_reason,last_updated_time,created_time,quality_score{score,date},components";
    /** Single-template read: ask Meta for nested `example` + button fields (matches Manager preview data). */
    const FIELDS_DETAIL =
      "id,name,status,category,language,rejected_reason,last_updated_time,created_time,quality_score{score,date},components{type,format,text,example,buttons{type,text,url,phone_number,example}}";

    if (req.method === "GET") {
      const urlObj = new URL(req.url);
      const waAcc = urlObj.searchParams.get("whatsapp_account_id")?.trim() || null;
      const hsmId = urlObj.searchParams.get("hsm_id")?.trim() || "";
      const ctx = await resolveGraphContext(supabaseAdmin, user.id, orgId, waAcc);
      if (!ctx) {
        return new Response(
          JSON.stringify({
            error:
              waAcc
                ? "WhatsApp account not found for this organization, or missing token / WABA. Pick another account or reconnect in Operations → Consultant."
                : "WhatsApp Business Account not configured or missing access token. Connect WhatsApp in Operations → Consultant.",
            code: "WHATSAPP_NOT_CONFIGURED",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const fields = hsmId ? FIELDS_DETAIL : FIELDS_LIST;
      let graphUrl: string;
      if (hsmId) {
        graphUrl =
          `${META_API_BASE}/${encodeURIComponent(ctx.wabaId)}/message_templates?hsm_id=${encodeURIComponent(hsmId)}&fields=${encodeURIComponent(fields)}`;
      } else {
        const limit = Math.min(100, Math.max(1, parseInt(urlObj.searchParams.get("limit") ?? "50", 10) || 50));
        const after = urlObj.searchParams.get("after")?.trim() || "";
        graphUrl =
          `${META_API_BASE}/${encodeURIComponent(ctx.wabaId)}/message_templates?fields=${encodeURIComponent(fields)}&limit=${limit}`;
        if (after) graphUrl += `&after=${encodeURIComponent(after)}`;
      }

      let res = await fetch(graphUrl, {
        headers: { Authorization: `Bearer ${ctx.accessToken}` },
      });
      let json = await res.json().catch(() => ({}));
      if (!res.ok && hsmId) {
        const fallbackUrl =
          `${META_API_BASE}/${encodeURIComponent(ctx.wabaId)}/message_templates?hsm_id=${encodeURIComponent(hsmId)}&fields=${encodeURIComponent(FIELDS_LIST)}`;
        const res2 = await fetch(fallbackUrl, { headers: { Authorization: `Bearer ${ctx.accessToken}` } });
        const json2 = await res2.json().catch(() => ({}));
        if (res2.ok) {
          res = res2;
          json = json2;
        }
      }
      if (!res.ok) {
        const msg = json?.error?.message ?? json?.error_message ?? "Meta API error";
        return new Response(JSON.stringify({ error: String(msg), details: json }), {
          status: res.status >= 400 && res.status < 600 ? res.status : 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const rawData = json?.data;
      const data = Array.isArray(rawData) ? rawData : rawData != null ? [rawData] : [];

      if (!hsmId && data.length > 0) {
        const templateIds = data
          .map((t) => String((t as { id?: string }).id ?? "").trim())
          .filter(Boolean);
        const totals = await fetchTemplateAnalyticsTotals(ctx, templateIds);
        mergeAnalyticsIntoTemplates(data as Array<Record<string, unknown>>, totals);
      }

      return new Response(JSON.stringify({ data, paging: json?.paging ?? null }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "DELETE") {
      const urlObj = new URL(req.url);
      const waAcc = urlObj.searchParams.get("whatsapp_account_id")?.trim() || null;
      const hsmId = urlObj.searchParams.get("hsm_id")?.trim() || "";
      const templateName = urlObj.searchParams.get("name")?.trim() || "";
      if (!hsmId && !templateName) {
        return new Response(
          JSON.stringify({ error: "Missing hsm_id or name (Meta template id or name)", code: "MISSING_TEMPLATE_ID" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      /** Meta requires both `hsm_id` and `name` when deleting by id (see template-management docs). */
      if (hsmId && !templateName) {
        return new Response(
          JSON.stringify({
            error: "Missing name (template name required with hsm_id for Meta delete)",
            code: "MISSING_TEMPLATE_NAME",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const ctx = await resolveGraphContext(supabaseAdmin, user.id, orgId, waAcc);
      if (!ctx) {
        return new Response(
          JSON.stringify({
            error:
              waAcc
                ? "WhatsApp account not found for this organization, or missing token / WABA. Pick another account or reconnect in Operations → Consultant."
                : "WhatsApp Business Account not configured or missing access token. Connect WhatsApp in Operations → Consultant.",
            code: "WHATSAPP_NOT_CONFIGURED",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const del = await deleteMessageTemplateOnMeta(ctx, hsmId, templateName);
      if (del.ok === true) {
        return new Response(JSON.stringify({ success: true, result: del.result }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const msg = metaGraphErrorMessage(del.json);
      const code = metaGraphErrorCode(del.json);
      const errObj = (del.json as MetaGraphErrorBody)?.error;
      const hint =
        errObj?.code === 10 || errObj?.code === 200
          ? "Pastikan token Meta punya izin whatsapp_business_management (hubungkan ulang di Operations → Consultant)."
          : undefined;
      return new Response(
        JSON.stringify({
          error: msg,
          code: code ?? "META_DELETE_FAILED",
          hint,
          details: del.json,
        }),
        {
          status: del.status >= 400 && del.status < 600 ? del.status : 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST — create template
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const waAccPost = body.whatsapp_account_id != null ? String(body.whatsapp_account_id).trim() : "";
    const ctx = await resolveGraphContext(supabaseAdmin, user.id, orgId, waAccPost || null);
    if (!ctx) {
      return new Response(
        JSON.stringify({
          error:
            waAccPost
              ? "WhatsApp account not found for this organization, or missing token / WABA. Pick another account or reconnect in Operations → Consultant."
              : "WhatsApp Business Account not configured or missing access token. Connect WhatsApp in Operations → Consultant.",
          code: "WHATSAPP_NOT_CONFIGURED",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const name = body.name != null ? String(body.name).trim().toLowerCase() : "";
    const language = body.language != null ? String(body.language).trim() : "";
    const category = body.category != null ? String(body.category).trim().toUpperCase() : "";
    const components = body.components;

    if (!name || !/^[a-z0-9_]+$/.test(name)) {
      return new Response(
        JSON.stringify({ error: "Invalid template name (lowercase letters, numbers, underscores only)", code: "INVALID_NAME" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!language) {
      return new Response(JSON.stringify({ error: "Missing language", code: "MISSING_LANGUAGE" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!["MARKETING", "UTILITY", "AUTHENTICATION"].includes(category)) {
      return new Response(JSON.stringify({ error: "Invalid category", code: "INVALID_CATEGORY" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!Array.isArray(components) || components.length === 0) {
      return new Response(JSON.stringify({ error: "Missing components array", code: "MISSING_COMPONENTS" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sanitized = sanitizeTemplateComponentsForCreate(components);
    if (sanitized.ok === false) {
      return new Response(JSON.stringify({ error: sanitized.error, code: sanitized.code }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const createUrl = `${META_API_BASE}/${encodeURIComponent(ctx.wabaId)}/message_templates`;
    const res = await fetch(createUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ctx.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, language, category, components: sanitized.components }),
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

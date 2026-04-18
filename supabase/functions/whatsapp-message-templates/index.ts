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

type GraphContext = {
  orgId: string;
  wabaId: string;
  accessToken: string;
};

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
): Promise<GraphContext | null> {
  /** Templates are scoped to the user's active organization only (no cross-org fallback). */
  if (!activeOrgId) return null;

  const tryOrg = async (oid: string): Promise<GraphContext | null> => {
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

    // Keep fields compatible with Graph v18 message_templates node (avoid unknown field errors).
    const fields = "id,name,status,category,language,components,rejected_reason";

    if (req.method === "GET") {
      const urlObj = new URL(req.url);
      const limit = Math.min(100, Math.max(1, parseInt(urlObj.searchParams.get("limit") ?? "50", 10) || 50));
      const after = urlObj.searchParams.get("after")?.trim() || "";

      let graphUrl =
        `${META_API_BASE}/${encodeURIComponent(ctx.wabaId)}/message_templates?fields=${encodeURIComponent(fields)}&limit=${limit}`;
      if (after) graphUrl += `&after=${encodeURIComponent(after)}`;

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
      return new Response(JSON.stringify({ data: json?.data ?? [], paging: json?.paging ?? null }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST — create template
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
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
    if (!sanitized.ok) {
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

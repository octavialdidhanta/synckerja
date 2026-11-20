// Supabase Edge Function: wedding-package-lead
// 2-step lead capture from wedding package cards → `leads_vialdi_wedding` + sync `leads` + `lead_client_profiles`.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// --- Lead attribution (inlined: Supabase deploy bundles entry file only) ---
const _LEAD_UTM_MAX = 200;
const _LEAD_URL_MAX = 2000;
const _LEAD_ALLOWED_KEYS = [
  "landing_url",
  "referrer",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;
type LeadAttributionSanitized = Record<(typeof _LEAD_ALLOWED_KEYS)[number], string | null>;

function _leadClip(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return t.slice(0, max);
}
function _leadMaxForKey(key: string): number {
  if (key === "landing_url" || key === "referrer") return _LEAD_URL_MAX;
  return _LEAD_UTM_MAX;
}
function _computeAttributionLabel(a: LeadAttributionSanitized): string {
  const campaign = a.utm_campaign?.trim();
  const src = a.utm_source?.trim();
  const med = a.utm_medium?.trim();
  const parts: string[] = [];
  if (campaign) {
    parts.push(campaign);
    if (src || med) {
      const tail = [src, med].filter(Boolean).join(" / ");
      if (tail) parts.push(`(${tail})`);
    }
    return parts.join(" ").slice(0, 500);
  }
  if (src || med) {
    const head = [src, med].filter(Boolean).join(" / ");
    if (head) return head.slice(0, 500);
  }
  const land = a.landing_url?.trim();
  if (land) {
    const short = land.length > 120 ? `${land.slice(0, 117)}...` : land;
    return `Landing: ${short}`.slice(0, 500);
  }
  const ref = a.referrer?.trim();
  if (ref) {
    const short = ref.length > 100 ? `${ref.slice(0, 97)}...` : ref;
    return `Referrer: ${short}`.slice(0, 500);
  }
  const term = a.utm_term?.trim();
  if (term) return `Term: ${term}`.slice(0, 500);
  const content = a.utm_content?.trim();
  if (content) return `Content: ${content}`.slice(0, 500);
  return "Direct / unknown";
}
function parseLeadAttribution(raw: unknown): {
  attribution: LeadAttributionSanitized;
  label: string;
} | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const out: LeadAttributionSanitized = {
    landing_url: null,
    referrer: null,
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    utm_content: null,
    utm_term: null,
  };
  for (const key of _LEAD_ALLOWED_KEYS) {
    const v = obj[key];
    if (v === undefined || v === null) continue;
    if (typeof v !== "string") return null;
    const clipped = _leadClip(v, _leadMaxForKey(key));
    out[key] = clipped.length > 0 ? clipped : null;
  }
  const hasAny = _LEAD_ALLOWED_KEYS.some((k) => out[k] != null && out[k] !== "");
  if (!hasAny) return null;
  return { attribution: out, label: _computeAttributionLabel(out) };
}
function attributionToJsonb(a: LeadAttributionSanitized): Record<string, string> {
  const o: Record<string, string> = {};
  for (const k of _LEAD_ALLOWED_KEYS) {
    const v = a[k];
    if (v != null && v !== "") o[k] = v;
  }
  return o;
}
// --- end lead attribution ---

type WeddingStep = 1 | 2;

type Payload =
  | {
      step: 1;
      name: string;
      phone_number: string;
      email: string;
      package_label: string;
      /** Jika ada: perbarui baris step 1 yang sama (autosave), jangan buat lead ganda. */
      id?: string;
      /** Link ke public.analytics_sessions.id (anonymous session). */
      analytics_session_id?: string;
    }
  | {
      step: 2;
      id: string;
      event_date: string;
      event_time: string;
      event_address: string;
      analytics_session_id?: string;
    };

const ORG_ID = "663c9336-8cb6-4a36-9ad9-313126e70a1a";
const TITLE = "Lead Website";
const CATEGORY = "Wedding package card";
const SOURCE = "Website";
const CREATED_BY_NAME = "Vialdi Wedding";
const ASSIGNEE = "Unassigned";

/**
 * Hard-bind template WhatsApp untuk semua lead dari website.
 * Source of truth: `public.organization_whatsapp_templates`.
 */
const ORG_WHATSAPP_TEMPLATE_ID = "06043eb4-e183-4c55-a9a3-89ec389bbd62";

const REPEAT_TTL_MS = 30 * 1000;

/** Satu-satunya tabel staging paket untuk situs ini (tanpa `leads_vialdiid`). */
const PACKAGE_LEAD_TABLE = "leads_vialdi_wedding" as const;

function makeFunnelKey(args: { edgeFn: string; webId: string | null; code: string }) {
  const w = (args.webId ?? "unknown").trim() || "unknown";
  const c = args.code.trim() || "default";
  return `${args.edgeFn}:${w}:${c}`.slice(0, 200);
}

function json(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
      "access-control-allow-methods": "POST, OPTIONS",
      ...(init.headers ?? {}),
    },
  });
}

function badRequest(message: string) {
  return json({ error: message }, { status: 400 });
}

function mustGetEnv(name: string) {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function normalizePhone(v: string) {
  const trimmed = v.trim();
  // Remove common separators/spaces
  const compact = trimmed.replace(/[\s().-]/g, "");

  // Already E.164
  if (compact.startsWith("+")) {
    const digits = compact.slice(1).replace(/[^\d]/g, "");
    return `+${digits}`;
  }

  // Indonesia local format: 08xxxxxxxxxx / 8xxxxxxxxxx -> +628xxxxxxxxxx
  const digitsOnly = compact.replace(/[^\d]/g, "");
  if (/^(0?8\d{8,13})$/.test(digitsOnly)) {
    const national = digitsOnly.startsWith("0") ? digitsOnly.slice(1) : digitsOnly; // 8xxxxxxxxxx
    return `+62${national}`; // +628xxxxxxxxxx
  }

  // Fallback: digits only with optional leading +
  const digits = compact.replace(/[^\d]/g, "");
  return digits.length ? `+${digits}` : "";
}

function isPhone(v: string) {
  const normalized = normalizePhone(v);
  const digits = normalized.replace(/[^\d]/g, "");
  return normalized.startsWith("+") && digits.length >= 9 && digits.length <= 15;
}

async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Peta analytics `web_id` → digit internasional 62… untuk cocok dengan `display_phone_number` di
 * `organization_whatsapp_accounts` (tabel ini tidak punya kolom `web_id`).
 */
const WA_ORG_LINE_DIGITS: Record<string, string> = {
  "vialdi-wedding": "6281281714855",
};

function digitsOnly(s: unknown): string {
  if (typeof s !== "string") return "";
  return s.replace(/\D/g, "");
}

function normalizeIndonesiaMarketingDigits(raw: string): string {
  const d = digitsOnly(raw);
  if (!d) return "";
  if (d.startsWith("62")) return d;
  if (d.startsWith("0")) return `62${d.slice(1)}`;
  if (d.startsWith("8")) return `62${d}`;
  return d;
}

function pickPhoneNumberIdFromAccountRow(row: Record<string, unknown>): string {
  for (const k of ["phone_number_id", "whatsapp_phone_number_id", "meta_phone_number_id"] as const) {
    const v = row[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function orgWhatsappRowIsActive(row: Record<string, unknown>): boolean {
  const a = row["is_active"];
  return a === null || a === undefined || a === true;
}

async function resolveWhatsappPhoneNumberIdFromOrgTable(
  admin: ReturnType<typeof createClient>,
  organizationId: string,
  webId: string | null,
): Promise<string | null> {
  const wid = webId && String(webId).trim() ? String(webId).trim() : null;
  const targetDigits = wid ? WA_ORG_LINE_DIGITS[wid] : null;
  if (!targetDigits) return null;

  try {
    const { data: rows, error } = await admin
      .from("organization_whatsapp_accounts")
      .select("phone_number_id, display_phone_number, is_active")
      .eq("organization_id", organizationId);
    if (error) {
      console.warn("wedding-package-lead: organization_whatsapp_accounts lookup failed", error.message);
      return null;
    }
    if (!Array.isArray(rows)) return null;
    for (const raw of rows) {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
      const row = raw as Record<string, unknown>;
      if (!orgWhatsappRowIsActive(row)) continue;
      const disp = normalizeIndonesiaMarketingDigits(String(row["display_phone_number"] ?? ""));
      const pid = pickPhoneNumberIdFromAccountRow(row);
      if (!pid || !disp) continue;
      if (disp === targetDigits) return pid;
    }
  } catch (e) {
    console.warn("wedding-package-lead: organization_whatsapp_accounts exception", e);
  }
  return null;
}

type WhatsappSendResult =
  | { ok: true; skipped?: boolean; skip_reason?: string; message_id?: string; response_text?: string }
  | { ok: false; skipped?: boolean; error: string; skip_reason?: string };

function getEnvOptional(name: string) {
  const v = Deno.env.get(name);
  return v && v.trim().length ? v.trim() : null;
}

/** `web_id` → suffix untuk env opsional `BASIS__SUFFIX` (mis. `WHATSAPP_TEMPLATE_NAME__VIALDI_WEDDING`). */
function webIdToEnvSuffix(webId: string): string {
  return webId
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Resolves `BASIS__SUFFIX` then `BASIS`; jika `webId` kosong hanya global (perilaku lama). */
function getWhatsappTemplateEnvForWeb(baseName: string, webId: string | null): string | null {
  const wid = webId && String(webId).trim() ? String(webId).trim() : null;
  if (!wid) return getEnvOptional(baseName);
  const suffix = webIdToEnvSuffix(wid);
  if (!suffix) return getEnvOptional(baseName);
  const specific = getEnvOptional(`${baseName}__${suffix}`);
  if (specific) return specific;
  return getEnvOptional(baseName);
}

type ResolvedWhatsappTemplateEnv = {
  templateName: string;
  templateLanguage: string;
  bodyKeysRaw: string | null;
  parameterNamesRaw: string | null;
  componentsJsonRaw: string | null;
};

function resolveWhatsappTemplateEnv(webId: string | null): ResolvedWhatsappTemplateEnv {
  const name = getWhatsappTemplateEnvForWeb("WHATSAPP_TEMPLATE_NAME", webId) ?? "hello_world";
  const lang = getWhatsappTemplateEnvForWeb("WHATSAPP_TEMPLATE_LANGUAGE", webId) ?? "en_US";
  return {
    templateName: name.trim(),
    templateLanguage: lang.trim(),
    bodyKeysRaw: getWhatsappTemplateEnvForWeb("WHATSAPP_TEMPLATE_BODY_KEYS", webId),
    parameterNamesRaw: getWhatsappTemplateEnvForWeb("WHATSAPP_TEMPLATE_BODY_PARAMETER_NAMES", webId),
    componentsJsonRaw: getWhatsappTemplateEnvForWeb("WHATSAPP_TEMPLATE_COMPONENTS_JSON", webId),
  };
}

/** Kolom DB non-kosong mengganti field env yang sesuai; tanpa baris DB = hanya env. */
function mergeResolvedWhatsappTemplateEnv(
  db: Partial<ResolvedWhatsappTemplateEnv> | null,
  env: ResolvedWhatsappTemplateEnv,
): ResolvedWhatsappTemplateEnv {
  if (!db) return env;
  const pick = (dbVal: string | undefined, fallback: string) => {
    const t = typeof dbVal === "string" ? dbVal.trim() : "";
    return t.length > 0 ? t : fallback;
  };
  const pickNull = (dbVal: string | null | undefined, fallback: string | null) => {
    if (dbVal === undefined || dbVal === null) return fallback;
    const t = String(dbVal).trim();
    return t.length > 0 ? t : fallback;
  };
  return {
    templateName: pick(db.templateName, env.templateName),
    templateLanguage: pick(db.templateLanguage, env.templateLanguage),
    bodyKeysRaw: pickNull(db.bodyKeysRaw, env.bodyKeysRaw),
    parameterNamesRaw: pickNull(db.parameterNamesRaw, env.parameterNamesRaw),
    componentsJsonRaw: pickNull(db.componentsJsonRaw, env.componentsJsonRaw),
  };
}

async function loadOrganizationWhatsappTemplateFromDb(
  admin: ReturnType<typeof createClient>,
  organizationId: string,
  webId: string,
): Promise<Partial<ResolvedWhatsappTemplateEnv> | null> {
  try {
    // 1) Preferred: fixed template row id (no ambiguity across web_id).
    const fixed = await admin
      .from("organization_whatsapp_templates")
      .select("template_name,template_language,body_keys,body_parameter_names,components_json")
      .eq("organization_id", organizationId)
      .eq("id", ORG_WHATSAPP_TEMPLATE_ID)
      .eq("is_active", true)
      .maybeSingle();

    let data: unknown = fixed.data;
    let error: { message?: string } | null = fixed.error as unknown as { message?: string } | null;

    // 2) Fallback: old behavior (per web_id) if fixed row missing.
    if (!data && !error) {
      const byWeb = await admin
        .from("organization_whatsapp_templates")
        .select("template_name,template_language,body_keys,body_parameter_names,components_json")
        .eq("organization_id", organizationId)
        .eq("web_id", webId)
        .eq("is_active", true)
        .maybeSingle();
      data = byWeb.data;
      error = byWeb.error as unknown as { message?: string } | null;
    }

    if (error) {
      console.warn("wedding-package-lead: organization_whatsapp_templates read failed", error.message);
      return null;
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) return null;
    const d = data as Record<string, unknown>;
    const out: Partial<ResolvedWhatsappTemplateEnv> = {};
    if (typeof d.template_name === "string" && d.template_name.trim()) out.templateName = d.template_name.trim();
    if (typeof d.template_language === "string" && d.template_language.trim()) {
      out.templateLanguage = d.template_language.trim();
    }
    if (typeof d.body_keys === "string" && d.body_keys.trim()) out.bodyKeysRaw = d.body_keys.trim();
    if (typeof d.body_parameter_names === "string" && d.body_parameter_names.trim()) {
      out.parameterNamesRaw = d.body_parameter_names.trim();
    }
    if (typeof d.components_json === "string" && d.components_json.trim()) {
      out.componentsJsonRaw = d.components_json.trim();
    }
    return Object.keys(out).length > 0 ? out : null;
  } catch (e) {
    console.warn("wedding-package-lead: organization_whatsapp_templates exception", e);
    return null;
  }
}

async function resolveWhatsappTemplateEnvWithDb(
  admin: ReturnType<typeof createClient> | null | undefined,
  organizationId: string | null | undefined,
  webId: string | null,
): Promise<ResolvedWhatsappTemplateEnv> {
  const env = resolveWhatsappTemplateEnv(webId);
  const org = organizationId?.trim();
  const wid = webId?.trim();
  if (!admin || !org || !wid) return env;
  const partial = await loadOrganizationWhatsappTemplateFromDb(admin, org, wid);
  return mergeResolvedWhatsappTemplateEnv(partial, env);
}

function parseTemplateBodyKeysFromResolved(resolved: ResolvedWhatsappTemplateEnv): string[] {
  const raw = resolved.bodyKeysRaw;
  if (!raw) {
    const name = resolved.templateName.trim().toLowerCase();
    // `hello_world` (Meta sample) has no body placeholders — sending default `["name"]` triggers (#100).
    if (name === "hello_world") return [];
    // Default project template expects:
    // 1) greeting name, 2) Nama, 3) Tanggal Acara, 4) Jam Acara, 5) Paket
    return ["name", "name", "event_date", "event_time", "package_label"];
  }
  if (/^__none__$/i.test(raw.trim())) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

type WaTemplateComponent = {
  type: string;
  sub_type?: string;
  index?: string | number;
  parameters?: Array<Record<string, unknown>>;
  [k: string]: unknown;
};

function safeJsonParseArray(raw: string): unknown[] | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function interpolateTemplateString(input: string, ctx: Record<string, string>): string {
  // Replace tokens like {{name}} with ctx[name]. Unknown keys become an em dash.
  return input.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key) => {
    const v = ctx[String(key)];
    return nonEmptyTemplateParamText(typeof v === "string" ? v : "");
  });
}

function deepInterpolateTemplateJson(value: unknown, ctx: Record<string, string>): unknown {
  if (typeof value === "string") return interpolateTemplateString(value, ctx);
  if (Array.isArray(value)) return value.map((v) => deepInterpolateTemplateJson(v, ctx));
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) out[k] = deepInterpolateTemplateJson(v, ctx);
    return out;
  }
  return value;
}

/**
 * Optional override for template `components` to support header/button placeholders.
 * Set `WHATSAPP_TEMPLATE_COMPONENTS_JSON` to a JSON array compatible with Meta Graph API.
 * You may use tokens like `{{name}}` and they'll be replaced from ctx.
 *
 * Example:
 * [
 *   {"type":"header","parameters":[{"type":"text","text":"{{package_label}}"}]},
 *   {"type":"body","parameters":[{"type":"text","text":"{{name}}"}, ...]},
 *   {"type":"button","sub_type":"url","index":"0","parameters":[{"type":"text","text":"{{lead_id}}"}]}
 * ]
 */
function buildWhatsappTemplateComponentsFromEnv(
  ctx: Record<string, string>,
  resolved: ResolvedWhatsappTemplateEnv,
): WaTemplateComponent[] | null {
  const raw = resolved.componentsJsonRaw;
  if (!raw) return null;
  if (/^__none__$/i.test(raw.trim())) return [];

  const arr = safeJsonParseArray(raw);
  if (!arr) {
    console.warn("wedding-package-lead: invalid WHATSAPP_TEMPLATE_COMPONENTS_JSON (not a JSON array)");
    return null;
  }
  const interpolated = deepInterpolateTemplateJson(arr, ctx);
  if (!Array.isArray(interpolated)) return null;
  // Very light validation: ensure each element is an object with a type.
  const out: WaTemplateComponent[] = [];
  for (const item of interpolated) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const obj = item as Record<string, unknown>;
    if (typeof obj.type !== "string" || !obj.type.trim()) continue;
    out.push(obj as WaTemplateComponent);
  }
  return out;
}

/**
 * Template WhatsApp baru (Meta) memakai parameter **bernama** di body; Graph API membutuhkan
 * `parameter_name` per entri. Daftar ini harus sejajar urutannya dengan `WHATSAPP_TEMPLATE_BODY_KEYS`.
 * Contoh: KEYS=name,email NAMES=nama_klien,email_klien
 */
function parseTemplateBodyParameterNamesFromResolved(
  expectedCount: number,
  resolved: ResolvedWhatsappTemplateEnv,
): string[] | null {
  const raw = resolved.parameterNamesRaw;
  if (!raw) return null;
  const names = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (names.length !== expectedCount) {
    console.warn(
      `wedding-package-lead: WHATSAPP_TEMPLATE_BODY_PARAMETER_NAMES count (${names.length}) != KEYS (${expectedCount}) — pakai format posisional`,
    );
    return null;
  }
  return names;
}

/** Meta (#131008) menolak parameter body berteks kosong — wajib ada nilai. */
function nonEmptyTemplateParamText(value: string): string {
  const t = value.trim().slice(0, 1024);
  return t.length > 0 ? t : "\u2014";
}

function getLeadField(ctx: Record<string, string>, key: string) {
  const v = ctx[key];
  return typeof v === "string" ? v : "";
}

/** Meta Cloud API expects `to` as international digits without leading +. */
function waToDigitsForGraphApi(e164: string) {
  return e164.replace(/^\+/, "").replace(/[^\d]/g, "");
}

function extractWaMessageIdFromGraphResponse(parsed: unknown): string | undefined {
  if (!parsed || typeof parsed !== "object") return undefined;
  const root = parsed as Record<string, unknown>;
  const messages = root.messages;
  if (Array.isArray(messages) && messages.length > 0) {
    const first = messages[0];
    if (first && typeof first === "object") {
      const id = (first as Record<string, unknown>).id;
      if (typeof id === "string" && id.trim()) return id.trim();
    }
  }
  const message = root.message;
  if (message && typeof message === "object") {
    const id = (message as Record<string, unknown>).id;
    if (typeof id === "string" && id.trim()) return id.trim();
  }
  return undefined;
}

/** Fallback when JSON shape differs but body still contains a Graph wamid. */
function extractWaMessageIdFromRawText(text: string): string | undefined {
  const quoted = text.match(/"id"\s*:\s*"(wamid\.[^"]+)"/);
  if (quoted?.[1]) return quoted[1];
  const loose = text.match(/(wamid\.[A-Za-z0-9+/=_-]{12,})/);
  if (loose?.[1]) return loose[1];
  return undefined;
}

/** Readable preview for inbox / `whatsapp_messages.body` (template + variable lines). */
function formatTemplateMessageBody(args: {
  templateName: string;
  keys: string[];
  ctx: Record<string, string>;
}) {
  const lines = args.keys
    .map((k) => {
      const v = getLeadField(args.ctx, k).trim();
      return v ? `${k}: ${v}` : "";
    })
    .filter(Boolean);
  const header = `[Template: ${args.templateName}]`;
  const body = lines.length ? `${header}\n${lines.join("\n")}` : header;
  return body.slice(0, 8000);
}

async function sendWhatsappTemplateToClient(args: {
  toE164: string;
  ctx: Record<string, string>;
  /** Dari `public.organization_whatsapp_accounts`; jika kosong dipakai secret `WHATSAPP_PHONE_NUMBER_ID`. */
  graphPhoneNumberId?: string | null;
  /** Untuk env opsional `WHATSAPP_TEMPLATE_*__SUFFIX`; jika null hanya secret global (perilaku lama). */
  webId?: string | null;
  /** Jika ada: merge `public.organization_whatsapp_templates` di atas env. */
  admin?: ReturnType<typeof createClient> | null;
  organizationId?: string | null;
}): Promise<WhatsappSendResult> {
  const resolved = await resolveWhatsappTemplateEnvWithDb(
    args.admin ?? null,
    args.organizationId ?? null,
    args.webId ?? null,
  );
  const token = getEnvOptional("WHATSAPP_ACCESS_TOKEN");
  const phoneNumberId = (args.graphPhoneNumberId?.trim() || getEnvOptional("WHATSAPP_PHONE_NUMBER_ID") || "").trim();
  const templateName = resolved.templateName;
  const templateLanguage = resolved.templateLanguage;
  const graphVersion = getEnvOptional("WHATSAPP_GRAPH_VERSION") ?? "v21.0";

  if (!token || !phoneNumberId) {
    const skip_reason = !token && !phoneNumberId
      ? "missing_WHATSAPP_ACCESS_TOKEN_and_WHATSAPP_PHONE_NUMBER_ID_or_org_whatsapp_account"
      : !token
        ? "missing_WHATSAPP_ACCESS_TOKEN"
        : "missing_WHATSAPP_PHONE_NUMBER_ID_or_org_whatsapp_account";
    console.warn(`wedding-package-lead: WhatsApp API not called — ${skip_reason}`);
    return { ok: true, skipped: true, skip_reason };
  }

  const toDigits = waToDigitsForGraphApi(args.toE164);
  if (!toDigits) {
    return { ok: false, error: "Invalid phone for WhatsApp (empty after normalization)" };
  }

  const keys = parseTemplateBodyKeysFromResolved(resolved);
  const paramNames = parseTemplateBodyParameterNamesFromResolved(keys.length, resolved);
  const parameters = keys.map((k, i) => {
    const p: Record<string, unknown> = {
      type: "text",
      text: nonEmptyTemplateParamText(getLeadField(args.ctx, k)),
    };
    if (paramNames?.[i]) {
      p.parameter_name = paramNames[i];
    }
    return p;
  });

  const url = `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`;
  /** Jangan kirim `components: []` — Meta (#100) jika template tanpa variabel body. */
  const template: Record<string, unknown> = {
    name: templateName,
    language: { code: templateLanguage },
  };
  const envComponents = buildWhatsappTemplateComponentsFromEnv(args.ctx, resolved);
  if (envComponents && envComponents.length > 0) {
    template.components = envComponents;
  } else if (parameters.length > 0) {
    template.components = [{ type: "body", parameters }];
  }

  const body = {
    messaging_product: "whatsapp",
    to: toDigits,
    type: "template",
    template,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    // Return a user-friendly error upstream (UI), keep full details in server logs.
    // Meta error payloads can be huge and very technical; leaking them to users is noisy.
    const isTemplateParamMismatch = /(#132000|localizable_params|expected number of params)/i.test(text);
    const safeError = isTemplateParamMismatch
      ? "WhatsApp template param mismatch (jumlah variabel tidak sesuai template)."
      : `WhatsApp API error (${res.status}).`;

    const usesNamed = Boolean(paramNames && paramNames.length === parameters.length);
    console.error("wedding-package-lead: WhatsApp Graph request failed", {
      status: res.status,
      template: templateName,
      language: templateLanguage,
      body_key_count: keys.length,
      body_uses_parameter_name: usesNamed,
      components_override: Boolean(envComponents),
      graph_error_preview: text.slice(0, 400),
    });
    return { ok: false, error: safeError };
  }

  const responseSnippet = text.slice(0, 8000);
  try {
    const parsed: unknown = JSON.parse(text);
    let messageId = extractWaMessageIdFromGraphResponse(parsed);
    if (!messageId) messageId = extractWaMessageIdFromRawText(text);
    return { ok: true, message_id: messageId, response_text: responseSnippet };
  } catch {
    const messageId = extractWaMessageIdFromRawText(text);
    return { ok: true, message_id: messageId, response_text: responseSnippet };
  }
}

type AdminClient = ReturnType<typeof createClient>;

type WhatsappDbOkForSync = { conversation_id: string; message_id: string | null };
type WhatsappDbResultForSync = WhatsappDbOkForSync | { error: string };

const _ALLOWED_CLIENT_WEB_IDS = new Set(["vialdi-wedding"]);

/** `vialdi` (slug lama) dipetakan ke Vialdi Wedding. */
function canonicalClientWebId(raw: string | null | undefined): string | null {
  const w = (raw ?? "").trim();
  if (w === "vialdi") return "vialdi-wedding";
  if (_ALLOWED_CLIENT_WEB_IDS.has(w)) return w;
  return null;
}

async function loadWeddingPackageLeadRowById(args: {
  admin: AdminClient;
  id: string;
}): Promise<{ ok: true; row: Record<string, unknown> } | { ok: false; error: string }> {
  const { data: wRow, error: wErr } = await args.admin
    .from(PACKAGE_LEAD_TABLE)
    .select("*")
    .eq("id", args.id)
    .maybeSingle();
  if (wErr) return { ok: false, error: wErr.message };
  if (wRow && typeof wRow === "object") return { ok: true, row: wRow as Record<string, unknown> };
  return { ok: false, error: "Lead not found" };
}

async function ensureWeddingLeadMapping(args: {
  admin: AdminClient;
  systemUserId: string;
  resolvedWebId: string | null;
  weddingRow: any;
  incoming: {
    name: string;
    phone_number: string;
    email: string;
    package_label: string;
    analytics_session_id?: string;
  };
  attrUpdate: Record<string, unknown> | null;
}): Promise<{ ok: true; leadId: string } | { ok: false; error: string }> {
  const row = args.weddingRow as Record<string, unknown>;
  const existingLeadId = row?.lead_id;
  if (typeof existingLeadId === "string" && existingLeadId.trim()) {
    return { ok: true, leadId: existingLeadId.trim() };
  }

  const identityHash =
    typeof row?.identity_hash === "string" && String(row.identity_hash).trim()
      ? String(row.identity_hash).trim()
      : await sha256Hex(`${args.incoming.phone_number}|${args.incoming.email.toLowerCase()}`);

  const baseFunnelKey = makeFunnelKey({
    edgeFn: "wedding-package-lead",
    webId: args.resolvedWebId,
    code: "package",
  });
  const funnel_key = `${baseFunnelKey}:${identityHash.slice(0, 16)}`.slice(0, 200);
  const crm = { title: TITLE, category: CATEGORY, created_by_name: CREATED_BY_NAME };

  const { data: lead, error: leadErr } = await args.admin
    .from("leads")
    .upsert(
      {
        client: args.incoming.name,
        title: crm.title,
        category: crm.category,
        created_by: args.systemUserId,
        created_by_name: crm.created_by_name,
        assignee: ASSIGNEE,
        organization_id: ORG_ID,
        phone_number: args.incoming.phone_number,
        email: args.incoming.email,
        source: SOURCE,
        services: args.incoming.package_label,
        web_id: args.resolvedWebId,
        funnel_key,
        ...(args.incoming.analytics_session_id ? { analytics_session_id: args.incoming.analytics_session_id } : {}),
        ...(args.attrUpdate ?? {}),
      },
      { onConflict: "organization_id,dedupe_key" },
    )
    .select("id")
    .single();

  if (leadErr || !lead?.id) return { ok: false, error: leadErr?.message ?? "Failed to create lead" };
  const leadId = String(lead.id);

  const { error: profileErr } = await args.admin.from("lead_client_profiles").insert({
    lead_id: leadId,
    name: args.incoming.name,
    organization_id: ORG_ID,
    created_by: args.systemUserId,
    contact_person: args.incoming.name,
    contact_email: args.incoming.email,
    contact_phone: args.incoming.phone_number,
    phone_number: args.incoming.phone_number,
    email: args.incoming.email,
  });

  // If profile already exists (e.g. previous partial success), continue.
  if (profileErr) {
    const code = (profileErr as unknown as { code?: string })?.code;
    const dup = code === "23505" || /duplicate key|unique constraint/i.test(profileErr.message);
    if (!dup) return { ok: false, error: profileErr.message };
  }

  const weddingId = typeof row?.id === "string" ? String(row.id) : "";
  if (!weddingId) return { ok: false, error: "Wedding lead row missing id" };

  const { error: linkErr } = await args.admin
    .from(PACKAGE_LEAD_TABLE)
    .update({ lead_id: leadId, identity_hash: identityHash })
    .eq("id", weddingId);

  if (linkErr) return { ok: false, error: linkErr.message };
  return { ok: true, leadId };
}

/** Same ticket string as `public.whatsapp_conversations.ticket_id` (generated) and Leads "Open Chat". */
function waTicketIdFromConversationUuid(convId: string): string {
  return "WA-" + String(convId).replace(/-/g, "").slice(0, 8).toUpperCase();
}

/**
 * Sets `leads.ticket_id` to match the WA conversation ticket and removes other leads with that ticket
 * (e.g. duplicates from whatsapp-webhook). Inlined here so deploy bundles a single `index.ts` entry.
 */
async function syncLeadTicketAfterOutboundConversation(
  admin: AdminClient,
  organizationId: string,
  leadId: string,
  whatsappDb: WhatsappDbResultForSync | null,
  customerWaDigits?: string | null,
): Promise<{ ok: boolean; ticket_id?: string; error?: string }> {
  if (whatsappDb === null || "error" in whatsappDb) return { ok: false, error: "skip" };
  const convId = whatsappDb.conversation_id;
  if (!convId) return { ok: false, error: "no conversation_id" };

  const waTicket = waTicketIdFromConversationUuid(convId);
  const now = new Date().toISOString();

  const { error: delErr } = await admin
    .from("leads")
    .delete()
    .eq("organization_id", organizationId)
    .eq("ticket_id", waTicket)
    .neq("id", leadId);

  if (delErr) {
    console.error("syncLeadTicketAfterOutboundConversation: delete duplicate leads failed", delErr);
    return { ok: false, error: delErr.message };
  }

  const patch: Record<string, unknown> = { ticket_id: waTicket, updated_at: now };
  const digits = String(customerWaDigits ?? "").replace(/\D/g, "").trim();
  if (digits.length >= 9) patch.phone_number = digits;

  const { error: upErr } = await admin
    .from("leads")
    .update(patch)
    .eq("id", leadId)
    .eq("organization_id", organizationId);

  if (upErr) {
    console.error("syncLeadTicketAfterOutboundConversation: update lead failed", upErr);
    return { ok: false, error: upErr.message };
  }

  return { ok: true, ticket_id: waTicket };
}

/** Digits-only WhatsApp identity (no leading +). */
function customerWaIdFromE164(e164: string) {
  return e164.replace(/^\+/, "").replace(/[^\d]/g, "");
}

/** Open preferred, else Unread — same defaults as whatsapp-webhook for new conversations. */
async function fetchDefaultWhatsappConversationLeadStatusId(
  admin: AdminClient,
  organizationId: string,
): Promise<string | null> {
  const orgOrGlobal = `organization_id.eq.${organizationId},organization_id.is.null`;
  const { data: openStatus } = await admin
    .from("lead_statuses")
    .select("id")
    .or(orgOrGlobal)
    .eq("name", "Open")
    .maybeSingle();
  if (openStatus?.id) return openStatus.id as string;
  const { data: unreadStatus } = await admin
    .from("lead_statuses")
    .select("id")
    .or(orgOrGlobal)
    .eq("name", "Unread")
    .maybeSingle();
  return (unreadStatus?.id as string) ?? null;
}

/** Match conversation row even if `customer_wa_id` was stored in a different string shape (digits must match). */
async function findWhatsappConversationIdLax(
  admin: AdminClient,
  organizationId: string,
  phoneNumberId: string,
  customerDigits: string,
): Promise<string | null> {
  const { data: rows, error } = await admin
    .from("whatsapp_conversations")
    .select("id, customer_wa_id, lead_status_id, created_at")
    .eq("organization_id", organizationId)
    .eq("channel", "whatsapp")
    .eq("phone_number_id", phoneNumberId)
    .order("created_at", { ascending: true })
    .limit(100);
  if (error || !rows?.length) return null;
  const matches = rows.filter((r: { customer_wa_id?: unknown }) =>
    customerWaIdFromE164(String(r.customer_wa_id ?? "")) === customerDigits,
  );
  if (!matches.length) return null;
  matches.sort(
    (
      a: { lead_status_id?: unknown; created_at?: unknown },
      b: { lead_status_id?: unknown; created_at?: unknown },
    ) => {
    const aNull = a.lead_status_id == null ? 1 : 0;
    const bNull = b.lead_status_id == null ? 1 : 0;
    if (aNull !== bNull) return aNull - bNull;
    return String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""));
  });
  return (matches[0]?.id as string) ?? null;
}

/**
 * After a successful outbound template send: ensure conversation (select → update | insert;
 * avoids PostgREST `.upsert(onConflict)` which often fails against partial unique indexes),
 * then insert one outbound row in whatsapp_messages for every successful template send:
 * idempotent by `wa_message_id` when present, else by `raw_metadata.idempotency_key`.
 */
async function upsertConversationAndInsertOutboundMessage(args: {
  admin: AdminClient;
  organizationId: string;
  customerE164: string;
  customerName: string;
  phoneNumberId: string;
  waMessageId: string;
  messageBody: string;
  idempotencyKey: string;
  lastMessageBody: string;
  rawMetadata: Record<string, unknown>;
}): Promise<
  { conversation_id: string; message_id: string | null } | { error: string }
> {
  const customerWaId = customerWaIdFromE164(args.customerE164);
  if (!customerWaId) {
    return { error: "Invalid customer phone for WhatsApp logging" };
  }

  const now = new Date().toISOString();

  const { data: existingRows, error: selErr } = await args.admin
    .from("whatsapp_conversations")
    .select("id")
    .eq("organization_id", args.organizationId)
    .eq("customer_wa_id", customerWaId)
    .eq("phone_number_id", args.phoneNumberId)
    .eq("channel", "whatsapp")
    .limit(1);

  if (selErr) return { error: selErr.message };

  let conversationId = existingRows?.[0]?.id as string | undefined;
  if (!conversationId) {
    conversationId = (await findWhatsappConversationIdLax(
      args.admin,
      args.organizationId,
      args.phoneNumberId,
      customerWaId,
    )) ?? undefined;
  }

  if (conversationId) {
    const { error: upErr } = await args.admin
      .from("whatsapp_conversations")
      .update({
        customer_name: args.customerName,
        customer_wa_id: customerWaId,
        customer_external_id: customerWaId,
        last_message_at: now,
        last_message_body: args.lastMessageBody,
        updated_at: now,
      })
      .eq("id", conversationId);
    if (upErr) return { error: upErr.message };
  } else {
    const defaultLeadStatusId = await fetchDefaultWhatsappConversationLeadStatusId(
      args.admin,
      args.organizationId,
    );
    const insertRow: Record<string, unknown> = {
      organization_id: args.organizationId,
      customer_wa_id: customerWaId,
      customer_external_id: customerWaId,
      channel: "whatsapp",
      phone_number_id: args.phoneNumberId,
      customer_name: args.customerName,
      last_message_at: now,
      last_message_body: args.lastMessageBody,
      updated_at: now,
    };
    if (defaultLeadStatusId) insertRow.lead_status_id = defaultLeadStatusId;

    const { data: inserted, error: insErr } = await args.admin
      .from("whatsapp_conversations")
      .insert(insertRow)
      .select("id")
      .single();

    if (insErr) {
      const dup =
        (insErr as { code?: string }).code === "23505" ||
        /duplicate key|unique constraint/i.test(insErr.message);
      if (dup) {
        const racedId =
          (await findWhatsappConversationIdLax(
            args.admin,
            args.organizationId,
            args.phoneNumberId,
            customerWaId,
          )) ?? undefined;
        if (racedId) {
          conversationId = racedId;
        } else {
          const { data: racedRows, error: racedErr } = await args.admin
            .from("whatsapp_conversations")
            .select("id")
            .eq("organization_id", args.organizationId)
            .eq("customer_wa_id", customerWaId)
            .eq("phone_number_id", args.phoneNumberId)
            .eq("channel", "whatsapp")
            .limit(1);
          if (racedErr) return { error: racedErr.message };
          conversationId = racedRows?.[0]?.id as string | undefined;
        }
      } else {
        return { error: insErr.message };
      }
    } else {
      conversationId = inserted?.id as string | undefined;
    }
  }

  if (!conversationId) return { error: "Conversation ensure returned no id" };

  const meta = { ...args.rawMetadata, idempotency_key: args.idempotencyKey };
  const waMid = args.waMessageId.trim();
  const bodyText = args.messageBody.trim() || args.lastMessageBody;

  if (waMid) {
    const { data: existingMsg, error: existingErr } = await args.admin
      .from("whatsapp_messages")
      .select("id")
      .eq("wa_message_id", waMid)
      .maybeSingle();

    if (existingErr) return { error: existingErr.message };
    if (existingMsg?.id) {
      return { conversation_id: conversationId, message_id: existingMsg.id as string };
    }
  } else {
    const { data: existingByKey, error: keyErr } = await args.admin
      .from("whatsapp_messages")
      .select("id")
      .eq("conversation_id", conversationId)
      .contains("raw_metadata", { idempotency_key: args.idempotencyKey })
      .limit(1)
      .maybeSingle();

    if (keyErr) return { error: keyErr.message };
    if (existingByKey?.id) {
      return { conversation_id: conversationId, message_id: existingByKey.id as string };
    }
  }

  const { data: msg, error: msgErr } = await args.admin
    .from("whatsapp_messages")
    .insert({
      conversation_id: conversationId,
      direction: "outbound",
      wa_message_id: waMid || null,
      platform_message_id: waMid || null,
      message_type: "template",
      body: bodyText,
      raw_metadata: meta,
      status: "accepted",
      status_updated_at: now,
      channel: "whatsapp",
    })
    .select("id")
    .single();

  if (msgErr) {
    const dup =
      (msgErr as { code?: string }).code === "23505" ||
      /duplicate key|unique constraint/i.test(msgErr.message);
    if (dup && waMid) {
      const { data: raced, error: racedErr } = await args.admin
        .from("whatsapp_messages")
        .select("id")
        .eq("wa_message_id", waMid)
        .maybeSingle();
      if (!racedErr && raced?.id) {
        return { conversation_id: conversationId, message_id: raced.id as string };
      }
    }
    if (dup && !waMid) {
      const { data: racedKey, error: racedKeyErr } = await args.admin
        .from("whatsapp_messages")
        .select("id")
        .eq("conversation_id", conversationId)
        .contains("raw_metadata", { idempotency_key: args.idempotencyKey })
        .limit(1)
        .maybeSingle();
      if (!racedKeyErr && racedKey?.id) {
        return { conversation_id: conversationId, message_id: racedKey.id as string };
      }
    }
    return { error: msgErr.message };
  }
  const messageId = msg?.id as string;
  if (!messageId) return { error: "Message insert returned no id" };

  return { conversation_id: conversationId, message_id: messageId };
}

function asWeddingStep(n: unknown): WeddingStep | null {
  if (n === 1 || n === 2) return n;
  return null;
}

function isIsoDateOnly(v: string) {
  const s = v.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const t = Date.parse(`${s}T12:00:00.000Z`);
  return !Number.isNaN(t);
}

function nonEmpty(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v.trim());
}

function okPayload(body: any): Payload | null {
  const step = asWeddingStep(body?.step);
  if (!step) return null;

  if (step === 1) {
    if (!nonEmpty(body?.name)) return null;
    if (!nonEmpty(body?.phone_number) || !isPhone(body.phone_number)) return null;
    if (!nonEmpty(body?.email) || !isEmail(body.email)) return null;
    if (!nonEmpty(body?.package_label)) return null;
    const idRaw = body?.id;
    const id =
      typeof idRaw === "string" && idRaw.trim().length > 0 && isUuid(idRaw.trim()) ? idRaw.trim() : undefined;
    const sidRaw = body?.analytics_session_id;
    const analytics_session_id =
      typeof sidRaw === "string" && sidRaw.trim().length > 0 && isUuid(sidRaw.trim()) ? sidRaw.trim() : undefined;
    return {
      step: 1,
      name: body.name.trim(),
      phone_number: normalizePhone(body.phone_number),
      email: body.email.trim(),
      package_label: body.package_label.trim().slice(0, 500),
      ...(id ? { id } : {}),
      ...(analytics_session_id ? { analytics_session_id } : {}),
    };
  }

  if (step === 2) {
    if (!nonEmpty(body?.id)) return null;
    if (!nonEmpty(body?.event_date) || !isIsoDateOnly(body.event_date)) return null;
    if (!nonEmpty(body?.event_time)) return null;
    if (!nonEmpty(body?.event_address)) return null;
    const sidRaw = body?.analytics_session_id;
    const analytics_session_id =
      typeof sidRaw === "string" && sidRaw.trim().length > 0 && isUuid(sidRaw.trim()) ? sidRaw.trim() : undefined;
    return {
      step: 2,
      id: body.id.trim(),
      event_date: body.event_date.trim(),
      event_time: body.event_time.trim().slice(0, 200),
      event_address: body.event_address.trim().slice(0, 8000),
      ...(analytics_session_id ? { analytics_session_id } : {}),
    };
  }

  return null;
}

function validateWeddingPayload(body: any): { ok: true; payload: Payload } | { ok: false; error: string } {
  const step = asWeddingStep(body?.step);
  if (!step) return { ok: false, error: "Invalid step (expected 1 or 2)" };

  if (step === 1) {
    if (!nonEmpty(body?.name)) return { ok: false, error: "Missing name" };
    if (!nonEmpty(body?.phone_number)) return { ok: false, error: "Missing phone_number" };
    if (!isPhone(body.phone_number)) return { ok: false, error: "Invalid phone_number format" };
    if (!nonEmpty(body?.email)) return { ok: false, error: "Missing email" };
    if (!isEmail(body.email)) return { ok: false, error: "Invalid email format" };
    if (!nonEmpty(body?.package_label)) return { ok: false, error: "Missing package_label" };
  }

  if (step === 2) {
    if (!nonEmpty(body?.id)) return { ok: false, error: "Missing id" };
    if (!nonEmpty(body?.event_date)) return { ok: false, error: "Missing event_date (expected YYYY-MM-DD)" };
    if (!isIsoDateOnly(body.event_date))
      return { ok: false, error: "Invalid event_date (expected YYYY-MM-DD)" };
    if (!nonEmpty(body?.event_time)) return { ok: false, error: "Missing event_time" };
    if (!nonEmpty(body?.event_address)) return { ok: false, error: "Missing event_address" };
  }

  const payload = okPayload(body);
  if (!payload) return { ok: false, error: "Invalid payload for step (schema mismatch)" };
  return { ok: true, payload };
}

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") return json({ ok: true });
    if (req.method !== "POST") return json({ error: "Method not allowed" }, { status: 405 });

    let payloadRaw: unknown;
    try {
      payloadRaw = await req.json();
    } catch {
      return badRequest("Invalid JSON body");
    }

    const checked = validateWeddingPayload(payloadRaw);
    if (!checked.ok) return badRequest(checked.error);
    const payload = checked.payload;

  const rawPayload = payloadRaw as Record<string, unknown>;
  const leadAttr = parseLeadAttribution(rawPayload["attribution"]);
  const attrUpdate =
    leadAttr !== null
      ? {
          attribution: attributionToJsonb(leadAttr.attribution),
          attribution_label: leadAttr.label,
        }
      : null;

  let supabaseUrl: string;
  let serviceRoleKey: string;
  let systemUserId: string;
  try {
    supabaseUrl = mustGetEnv("SUPABASE_URL");
    serviceRoleKey = mustGetEnv("SUPABASE_SERVICE_ROLE_KEY");
    systemUserId = mustGetEnv("SYSTEM_USER_ID");
  } catch (e) {
    return json({ error: (e as Error).message }, { status: 500 });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // Resolve web_id from analytics_sessions (server-trust) to build a stable funnel_key for dedupe in `public.leads`.
  let resolvedWebId: string | null = null;
  const sid =
    payload.step === 1
      ? payload.analytics_session_id
      : payload.step === 2
        ? payload.analytics_session_id
        : undefined;
  if (sid) {
    const { data: sess, error: sessErr } = await admin
      .from("analytics_sessions")
      .select("web_id")
      .eq("id", sid)
      .maybeSingle();
    if (!sessErr && sess?.web_id) resolvedWebId = canonicalClientWebId(String(sess.web_id));
  }

  // Fallback routing when the session row isn't available yet (should be rare):
  // the browser still sends `web_id` alongside the payload for observability.
  if (!resolvedWebId) {
    const rawWeb = rawPayload["web_id"];
    if (typeof rawWeb === "string") {
      const c = canonicalClientWebId(rawWeb.trim());
      if (c) resolvedWebId = c;
    }
  }

  // Step 1: insert — atau perbarui baris + leads + profile jika `id` (autosave),
  // atau satu baris step 1 per `analytics_session_id` (atomic via unique index + upsert).
  if (payload.step === 1) {
    let weddingRowId: string | undefined =
      "id" in payload && payload.id && String(payload.id).trim().length > 0
        ? String(payload.id).trim()
        : undefined;

    if (weddingRowId) {
      const p1 = { ...payload, id: weddingRowId };
      const { data: row, error: rowErr } = await admin
        .from(PACKAGE_LEAD_TABLE)
        .select("*")
        .eq("id", p1.id)
        .single();

      if (rowErr || !row) return badRequest("Lead tidak ditemukan");
      if (String(row.organization_id) !== ORG_ID) return badRequest("Lead tidak valid");

      const prevStep = Number(row.step);
      const prevSubmittedAt = row.submitted_at ? new Date(String(row.submitted_at)).getTime() : null;
      const nowMs = Date.now();

      const incomingIdentity = await sha256Hex(`${p1.phone_number}|${p1.email.toLowerCase()}`);
      const existingIdentity = typeof row.identity_hash === "string" ? String(row.identity_hash).trim() : "";
      const identityChanged = existingIdentity.length > 0 && existingIdentity !== incomingIdentity;

      // If already submitted, allow resubmitting immediately ONLY when identity stays the same.
      // If identity changes, reject (we never create a new row for the same id).
      if (prevStep >= 2 || prevSubmittedAt !== null) {
        if (identityChanged) {
          return badRequest(
            "Lead sudah terkirim. Untuk mengubah nomor/email, silakan mulai lead baru (tidak bisa update lead lama).",
          );
        } else {
          const baseReset = {
            step: 1,
            submitted_at: null,
            event_time: null,
            event_address: null,
            event_date: null,
          };
          const { error: resetErr } = await admin
            .from(PACKAGE_LEAD_TABLE)
            .update(baseReset)
            .eq("id", p1.id);
          if (resetErr) return json({ error: resetErr.message }, { status: 500 });
        }
      }

      if (!weddingRowId) {
        // Continue to create-new-row logic below.
      } else {
      const ensured = await ensureWeddingLeadMapping({
        admin,
        systemUserId,
        resolvedWebId,
        weddingRow: row,
        incoming: {
          name: p1.name,
          phone_number: p1.phone_number,
          email: p1.email,
          package_label: p1.package_label,
          ...(p1.analytics_session_id ? { analytics_session_id: p1.analytics_session_id } : {}),
        },
        attrUpdate,
      });
      if (!ensured.ok) return json({ error: ensured.error }, { status: 500 });
      const leadId = ensured.leadId;

      const { error: wUp } = await admin
        .from(PACKAGE_LEAD_TABLE)
        .update({
          name: p1.name,
          phone_number: p1.phone_number,
          email: p1.email,
          identity_hash: incomingIdentity,
          package_label: p1.package_label,
          ...(p1.analytics_session_id ? { analytics_session_id: p1.analytics_session_id } : {}),
          ...(attrUpdate ?? {}),
        })
        .eq("id", p1.id);
      if (wUp) return json({ error: wUp.message }, { status: 500 });

      const { error: lUp } = await admin
        .from("leads")
        .update({
          client: p1.name,
          phone_number: p1.phone_number,
          email: p1.email,
          services: p1.package_label,
          ...(p1.analytics_session_id ? { analytics_session_id: p1.analytics_session_id } : {}),
          ...(attrUpdate ?? {}),
        })
        .eq("id", leadId);
      if (lUp) return json({ error: lUp.message }, { status: 500 });

      const { error: pUp } = await admin
        .from("lead_client_profiles")
        .update({
          name: p1.name,
          contact_person: p1.name,
          contact_email: p1.email,
          contact_phone: p1.phone_number,
          phone_number: p1.phone_number,
          email: p1.email,
        })
        .eq("lead_id", leadId);
      if (pUp) return json({ error: pUp.message }, { status: 500 });

      // Enrich from the latest WhatsApp click for the same analytics session.
      // This allows propagating sender `phone_number` + attribution into CRM leads.
      if (payload.analytics_session_id && resolvedWebId) {
        const { data: latestWaClick, error: waSelErr } = await admin
          .from("analytics_wa_clicks")
          .select("id, attribution")
          .eq("session_id", payload.analytics_session_id)
          .eq("web_id", resolvedWebId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!waSelErr && latestWaClick?.id) {
          const waPhone = payload.phone_number;

          const { error: waPhoneUpdErr } = await admin
            .from("analytics_wa_clicks")
            .update({ phone_number: waPhone })
            .eq("id", latestWaClick.id);
          if (waPhoneUpdErr) {
            console.warn("wedding-package-lead: analytics_wa_clicks phone_number update failed", waPhoneUpdErr.message);
          }

          const waLeadAttr = parseLeadAttribution(latestWaClick.attribution);
          const waAttrUpdate =
            waLeadAttr !== null
              ? {
                  attribution: attributionToJsonb(waLeadAttr.attribution),
                  attribution_label: waLeadAttr.label,
                }
              : null;

          const leadPatch = {
            phone_number: waPhone,
            ...(waAttrUpdate ?? {}),
          };

          const { error: leadsUpdErr } = await admin.from("leads").update(leadPatch).eq("id", leadId);
          if (leadsUpdErr) console.warn("wedding-package-lead: leads update from wa-click failed", leadsUpdErr.message);

          const { error: pkgUpdErr } = await admin
            .from(PACKAGE_LEAD_TABLE)
            .update(leadPatch)
            .eq("id", p1.id);
          if (pkgUpdErr) console.warn("wedding-package-lead: package leads update from wa-click failed", pkgUpdErr.message);
        } else if (waSelErr) {
          console.warn("wedding-package-lead: analytics_wa_clicks lookup failed", waSelErr.message);
        }
      }

      return json({ id: p1.id, lead_id: leadId });
      }
    }

    // When we have analytics_session_id, enforce single draft per session with atomic upsert.
    const canSessionUpsert = Boolean(payload.analytics_session_id && String(payload.analytics_session_id).trim());
    const identityHash = await sha256Hex(`${payload.phone_number}|${payload.email.toLowerCase()}`);

    const weddingWrite = canSessionUpsert
      ? await admin
          .from(PACKAGE_LEAD_TABLE)
          .upsert(
            {
              organization_id: ORG_ID,
              name: payload.name,
              phone_number: payload.phone_number,
              email: payload.email,
              identity_hash: identityHash,
              package_label: payload.package_label,
              analytics_session_id: payload.analytics_session_id,
              step: 1,
              source: SOURCE,
              ...(attrUpdate ?? {}),
            },
            // Uses generated column `step1_dedupe_key` (computed from analytics_session_id + step=1).
            { onConflict: "organization_id,step1_dedupe_key" },
          )
          .select("*")
          .single()
      : await admin
          .from(PACKAGE_LEAD_TABLE)
          .insert({
            organization_id: ORG_ID,
            name: payload.name,
            phone_number: payload.phone_number,
            email: payload.email,
            identity_hash: identityHash,
            package_label: payload.package_label,
            ...(payload.analytics_session_id ? { analytics_session_id: payload.analytics_session_id } : {}),
            step: 1,
            source: SOURCE,
            ...(attrUpdate ?? {}),
          })
          .select("*")
          .single();

    const { data: weddingLead, error: weddingErr } = weddingWrite;

    if (weddingErr) return json({ error: weddingErr.message }, { status: 500 });

    // If the draft row is already linked to a CRM lead, just return it.
    const existingLeadId = (weddingLead as Record<string, unknown>)?.lead_id;
    if (typeof existingLeadId === "string" && existingLeadId.trim()) {
      const leadId = existingLeadId.trim();

      // Best-effort enrichment (same logic as the "new lead" path).
      if (payload.analytics_session_id && resolvedWebId) {
        const { data: latestWaClick, error: waSelErr } = await admin
          .from("analytics_wa_clicks")
          .select("id, attribution")
          .eq("session_id", payload.analytics_session_id)
          .eq("web_id", resolvedWebId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!waSelErr && latestWaClick?.id) {
          const waPhone = payload.phone_number;

          const { error: waPhoneUpdErr } = await admin
            .from("analytics_wa_clicks")
            .update({ phone_number: waPhone })
            .eq("id", latestWaClick.id);
          if (waPhoneUpdErr) {
            console.warn("wedding-package-lead: analytics_wa_clicks phone_number update failed", waPhoneUpdErr.message);
          }

          const waLeadAttr = parseLeadAttribution(latestWaClick.attribution);
          const waAttrUpdate =
            waLeadAttr !== null
              ? {
                  attribution: attributionToJsonb(waLeadAttr.attribution),
                  attribution_label: waLeadAttr.label,
                }
              : null;

          const leadPatch = {
            phone_number: waPhone,
            ...(waAttrUpdate ?? {}),
          };

          const { error: leadsUpdErr } = await admin.from("leads").update(leadPatch).eq("id", leadId);
          if (leadsUpdErr) console.warn("wedding-package-lead: leads update from wa-click failed", leadsUpdErr.message);

          const { error: pkgUpdErr } = await admin
            .from(PACKAGE_LEAD_TABLE)
            .update(leadPatch)
            .eq("id", weddingLead.id);
          if (pkgUpdErr)
            console.warn("wedding-package-lead: package leads update from wa-click failed", pkgUpdErr.message);
        } else if (waSelErr) {
          console.warn("wedding-package-lead: analytics_wa_clicks lookup failed", waSelErr.message);
        }
      }

      return json({ id: weddingLead.id, lead_id: leadId });
    }

    // Otherwise create the CRM lead + profile once, then link it.
    const baseFunnelKey = makeFunnelKey({
      edgeFn: "wedding-package-lead",
      webId: resolvedWebId,
      code: "package",
    });
    const funnel_key = `${baseFunnelKey}:${identityHash.slice(0, 16)}`.slice(0, 200);
    const crm = { title: TITLE, category: CATEGORY, created_by_name: CREATED_BY_NAME };
    const { data: lead, error: leadErr } = await admin
      .from("leads")
      .upsert(
        {
        client: payload.name,
        title: crm.title,
        category: crm.category,
        created_by: systemUserId,
        created_by_name: crm.created_by_name,
        assignee: ASSIGNEE,
        organization_id: ORG_ID,
        phone_number: payload.phone_number,
        email: payload.email,
        source: SOURCE,
        services: payload.package_label,
        web_id: resolvedWebId,
        funnel_key,
        ...(payload.analytics_session_id ? { analytics_session_id: payload.analytics_session_id } : {}),
        ...(attrUpdate ?? {}),
      },
        { onConflict: "organization_id,dedupe_key" },
      )
      .select("id")
      .single();

    if (leadErr) return json({ error: leadErr.message }, { status: 500 });

    const leadId = lead.id as string;

    const { error: profileErr } = await admin.from("lead_client_profiles").insert({
      lead_id: leadId,
      name: payload.name,
      organization_id: ORG_ID,
      created_by: systemUserId,
      contact_person: payload.name,
      contact_email: payload.email,
      contact_phone: payload.phone_number,
      phone_number: payload.phone_number,
      email: payload.email,
    });

    if (profileErr) return json({ error: profileErr.message }, { status: 500 });

    const { error: linkErr } = await admin
      .from(PACKAGE_LEAD_TABLE)
      .update({ lead_id: leadId })
      .eq("id", weddingLead.id);

    if (linkErr) return json({ error: linkErr.message }, { status: 500 });

    // Enrich from the latest WhatsApp click for the same analytics session.
    if (payload.analytics_session_id && resolvedWebId) {
      const { data: latestWaClick, error: waSelErr } = await admin
        .from("analytics_wa_clicks")
        .select("id, attribution")
        .eq("session_id", payload.analytics_session_id)
        .eq("web_id", resolvedWebId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!waSelErr && latestWaClick?.id) {
        const waPhone = payload.phone_number;

        const { error: waPhoneUpdErr } = await admin
          .from("analytics_wa_clicks")
          .update({ phone_number: waPhone })
          .eq("id", latestWaClick.id);
        if (waPhoneUpdErr) {
          console.warn("wedding-package-lead: analytics_wa_clicks phone_number update failed", waPhoneUpdErr.message);
        }

        const waLeadAttr = parseLeadAttribution(latestWaClick.attribution);
        const waAttrUpdate =
          waLeadAttr !== null
            ? {
                attribution: attributionToJsonb(waLeadAttr.attribution),
                attribution_label: waLeadAttr.label,
              }
            : null;

        const leadPatch = {
          phone_number: waPhone,
          ...(waAttrUpdate ?? {}),
        };

        const { error: leadsUpdErr } = await admin.from("leads").update(leadPatch).eq("id", leadId);
        if (leadsUpdErr) console.warn("wedding-package-lead: leads update from wa-click failed", leadsUpdErr.message);

        const { error: pkgUpdErr } = await admin
          .from(PACKAGE_LEAD_TABLE)
          .update(leadPatch)
          .eq("id", weddingLead.id);
        if (pkgUpdErr)
          console.warn("wedding-package-lead: package leads update from wa-click failed", pkgUpdErr.message);
      } else if (waSelErr) {
        console.warn("wedding-package-lead: analytics_wa_clicks lookup failed", waSelErr.message);
      }
    }

    return json({ id: weddingLead.id, lead_id: leadId });
  }

  // Step 2 (final): detail acara + WhatsApp / tiket
  const p2 = payload;

  const located = await loadWeddingPackageLeadRowById({ admin, id: p2.id });
  if (!located.ok) return badRequest(located.error === "Lead not found" ? "Lead tidak ditemukan" : located.error);
  const existing = located.row;

  // If the client didn't send a session id on step 2, recover web_id from the stored session for CRM consistency.
  if (!resolvedWebId) {
    const sidMaybe =
      typeof existing.analytics_session_id === "string" && isUuid(String(existing.analytics_session_id))
        ? String(existing.analytics_session_id)
        : undefined;
    if (sidMaybe) {
      const { data: sess, error: sessErr } = await admin
        .from("analytics_sessions")
        .select("web_id")
        .eq("id", sidMaybe)
        .maybeSingle();
      if (!sessErr && sess?.web_id) resolvedWebId = canonicalClientWebId(String(sess.web_id));
    }
  }

  const ensured = await ensureWeddingLeadMapping({
    admin,
    systemUserId,
    resolvedWebId,
    weddingRow: existing,
    incoming: {
      name: String(existing?.name ?? ""),
      phone_number: normalizePhone(String(existing?.phone_number ?? "")),
      email: String(existing?.email ?? ""),
      package_label: String(existing?.package_label ?? ""),
      ...(existing?.analytics_session_id ? { analytics_session_id: String(existing.analytics_session_id) } : {}),
    },
    attrUpdate,
  });
  if (!ensured.ok) return json({ error: ensured.error }, { status: 500 });
  const leadId = ensured.leadId;

  const effectiveSessionId = (p2.analytics_session_id ?? (existing.analytics_session_id as string | null) ?? undefined) as
    | string
    | undefined;

  // If a final lead already exists for this session+identity, stop early (DB unique index will also enforce this).
  if (effectiveSessionId) {
    const thisIdentity = typeof existing.identity_hash === "string" ? String(existing.identity_hash).trim() : "";
    const { data: otherFinal, error: otherFinalErr } = await admin
      .from(PACKAGE_LEAD_TABLE)
      .select("id")
      .eq("organization_id", ORG_ID)
      .eq("analytics_session_id", effectiveSessionId)
      .eq("identity_hash", thisIdentity)
      .not("submitted_at", "is", null)
      .neq("id", p2.id)
      .limit(1)
      .maybeSingle();
    if (otherFinalErr) return json({ error: otherFinalErr.message }, { status: 500 });
    if (otherFinal?.id) return badRequest("Lead sudah pernah dikirim untuk session ini");
  }

  const pkg = String(existing.package_label ?? "").trim();
  const p2EventDateWedding = typeof p2.event_date === "string" ? p2.event_date.trim() : "";
  const servicesLine = `${pkg} — tanggal ${p2EventDateWedding}, jam ${p2.event_time}`;
  const notesBlock =
    `Paket: ${pkg}\n` +
    `Tanggal acara: ${p2EventDateWedding}\n` +
    `Jam acara: ${p2.event_time}\n` +
    `Alamat lengkap:\n${p2.event_address}`;

  const weddingDateUpdate =
    typeof p2.event_date === "string" && isIsoDateOnly(p2.event_date) ? { event_date: p2.event_date.trim() } : {};

  const { error: upErr } = await admin
    .from(PACKAGE_LEAD_TABLE)
    .update({
      ...weddingDateUpdate,
      event_time: p2.event_time,
      event_address: p2.event_address,
      ...(effectiveSessionId ? { analytics_session_id: effectiveSessionId } : {}),
      step: 2,
      submitted_at: new Date().toISOString(),
      ...(attrUpdate ?? {}),
    })
    .eq("id", p2.id);
  if (upErr) {
    // Unique violation: session already has a final row (enforced by uq_leads_vialdi_wedding_final_dedupe).
    const anyErr = upErr as unknown as { code?: string; message: string };
    if (anyErr?.code === "23505") return badRequest("Lead sudah pernah dikirim untuk session ini");
    return json({ error: upErr.message }, { status: 500 });
  }

  const { error: leadUpErr } = await admin
    .from("leads")
    .update({
      services: servicesLine,
      ...(effectiveSessionId ? { analytics_session_id: effectiveSessionId } : {}),
      ...(attrUpdate ?? {}),
    })
    .eq("id", leadId);
  if (leadUpErr) return json({ error: leadUpErr.message }, { status: 500 });

  const { error: profileUpErr } = await admin
    .from("lead_client_profiles")
    .update({
      occupation: `Acara: ${p2EventDateWedding} (${p2.event_time})`,
      notes: notesBlock,
    })
    .eq("lead_id", leadId);
  if (profileUpErr) return json({ error: profileUpErr.message }, { status: 500 });

  const { data: finalRow, error: finalErr } = await admin
    .from(PACKAGE_LEAD_TABLE)
    .select("*")
    .eq("id", p2.id)
    .single();
  if (finalErr) return json({ error: finalErr.message }, { status: 500 });

  const to = normalizePhone(String(finalRow?.phone_number ?? ""));
  const pkgLabel = String(finalRow?.package_label ?? "").trim();
  const evDateWedding = String((finalRow as Record<string, unknown>)?.event_date ?? "").trim();
  const evTime = String(finalRow?.event_time ?? "").trim();
  const evAddr = String(finalRow?.event_address ?? "").trim();
  const jobLine = [evDateWedding && `Tanggal ${evDateWedding}`, evTime && `Jam ${evTime}`].filter(Boolean).join(" · ");

  // Kunci ctx mengikuti template WhatsApp di DB (nama variabel bisa berisi `lead_vialdiid_id` dari migrasi lama).
  const ctx: Record<string, string> = {
    name: String(finalRow?.name ?? ""),
    email: String(finalRow?.email ?? ""),
    phone_number: String(finalRow?.phone_number ?? ""),
    industry: pkgLabel || "Wedding",
    business_type: "B2C",
    job_title: jobLine || "Calon pengantin",
    needs: pkgLabel || "Konsultasi paket wedding",
    office_address: evAddr || "\u2014",
    lead_id: String(leadId),
    lead_vialdiid_id: String(p2.id),
    package_label: pkgLabel,
    event_date: evDateWedding,
    event_time: evTime,
    event_address: evAddr,
    leads_vialdi_wedding_id: String(p2.id),
    ringkasan_kebutuhan: String((finalRow as Record<string, unknown>)?.ringkasan_kebutuhan ?? "").trim(),
  };

  const graphPhoneNumberId = await resolveWhatsappPhoneNumberIdFromOrgTable(admin, ORG_ID, resolvedWebId);
  const wa = await sendWhatsappTemplateToClient({
    toE164: to,
    ctx,
    graphPhoneNumberId,
    webId: resolvedWebId,
    admin,
    organizationId: ORG_ID,
  });
  if (wa.ok && wa.skipped && "skip_reason" in wa && wa.skip_reason) {
    console.warn(`wedding-package-lead: lead ${leadId} saved; WhatsApp skipped: ${wa.skip_reason}`);
  }
  if (!wa.ok) {
    console.error(`wedding-package-lead: WhatsApp API error for lead ${leadId}:`, wa.error);
  }

  const waTemplateResolved = await resolveWhatsappTemplateEnvWithDb(admin, ORG_ID, resolvedWebId);
  const templateName = waTemplateResolved.templateName;
  const templateLanguage = waTemplateResolved.templateLanguage;
  const phoneNumberId = (graphPhoneNumberId?.trim() || getEnvOptional("WHATSAPP_PHONE_NUMBER_ID") || "").trim();

  let whatsapp_db:
    | { conversation_id: string; message_id: string | null }
    | { error: string }
    | null = null;

  if (wa.ok && !wa.skipped && phoneNumberId) {
    const keys = parseTemplateBodyKeysFromResolved(waTemplateResolved);
    const messagePreview = formatTemplateMessageBody({
      templateName,
      keys,
      ctx,
    });
    const lastMessageBody = messagePreview.slice(0, 1024);

    const responseText = wa.ok && "response_text" in wa ? (wa.response_text ?? "") : "";
    const effectiveWamid = (
      (typeof wa.message_id === "string" && wa.message_id.trim()) ||
      extractWaMessageIdFromRawText(responseText) ||
      ""
    ).trim();

    const rawMetadata: Record<string, unknown> = {
      source: "wedding-package-lead",
      template: { name: templateName, language: templateLanguage },
      template_body_keys: keys,
      lead_id: leadId,
      package_lead_table: PACKAGE_LEAD_TABLE,
      leads_vialdi_wedding_id: p2.id,
      customer_e164: to,
      graph_wamid: effectiveWamid || null,
      parameters: Object.fromEntries(keys.map((k) => [k, getLeadField(ctx, k)])),
      graph_response_snippet: responseText.slice(0, 2000),
    };

    whatsapp_db = await upsertConversationAndInsertOutboundMessage({
      admin,
      organizationId: ORG_ID,
      customerE164: to,
      customerName: String(finalRow?.name ?? ""),
      phoneNumberId,
      waMessageId: effectiveWamid,
      messageBody: messagePreview,
      idempotencyKey: `wedding-package-lead:step2:${p2.id}`,
      lastMessageBody,
      rawMetadata,
    });
  }

  let lead_ticket_sync: { ok: boolean; ticket_id?: string; error?: string } | null = null;
  if (whatsapp_db && !("error" in whatsapp_db)) {
    lead_ticket_sync = await syncLeadTicketAfterOutboundConversation(
      admin,
      ORG_ID,
      leadId,
      whatsapp_db,
      customerWaIdFromE164(to),
    );
  }

  const whatsappPayload = wa.ok
    ? {
        sent: !wa.skipped,
        skipped: Boolean(wa.skipped),
        message_id: wa.message_id ?? null,
        ...(wa.skipped && "skip_reason" in wa && typeof wa.skip_reason === "string"
          ? { skip_reason: wa.skip_reason }
          : {}),
      }
    : { sent: false as const, error: wa.error };

  return json({
    id: p2.id,
    lead_id: leadId,
    whatsapp: whatsappPayload,
    ...(whatsapp_db !== null ? { whatsapp_db } : {}),
    ...(lead_ticket_sync !== null ? { lead_ticket_sync } : {}),
  });
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    console.error("wedding-package-lead: unhandled exception", {
      name: err.name,
      message: err.message,
      stack: String(err.stack ?? "").slice(0, 1200),
    });
    return json({ error: "Internal error", detail: err.message }, { status: 500 });
  }
});


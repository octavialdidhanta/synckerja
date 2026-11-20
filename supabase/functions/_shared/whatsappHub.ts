import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export const ORG_WHATSAPP_TEMPLATE_ID = "06043eb4-e183-4c55-a9a3-89ec389bbd62";

export type WhatsappSendResult =
  | { ok: true; skipped?: boolean; skip_reason?: string; message_id?: string; response_text?: string }
  | { ok: false; skipped?: boolean; error: string; skip_reason?: string };

type AdminClient = SupabaseClient;
type WhatsappDbOkForSync = { conversation_id: string; message_id: string | null };
type WhatsappDbResultForSync = WhatsappDbOkForSync | { error: string };

export function normalizePhoneE164(v: string): string {
  const trimmed = v.trim();
  const compact = trimmed.replace(/[\s().-]/g, "");
  if (compact.startsWith("+")) {
    const digits = compact.slice(1).replace(/[^\d]/g, "");
    return `+${digits}`;
  }
  const digitsOnly = compact.replace(/[^\d]/g, "");
  if (/^(0?8\d{8,13})$/.test(digitsOnly)) {
    const national = digitsOnly.startsWith("0") ? digitsOnly.slice(1) : digitsOnly;
    return `+62${national}`;
  }
  const digits = compact.replace(/[^\d]/g, "");
  return digits.length ? `+${digits}` : "";
}

export async function sha256Hex(input: string): Promise<string> {
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

export async function resolveWhatsappPhoneNumberIdFromOrgTable(
  admin: SupabaseClient,
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
      console.warn("contact-submit: organization_whatsapp_accounts lookup failed", error.message);
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
    console.warn("contact-submit: organization_whatsapp_accounts exception", e);
  }
  return null;
}



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
  admin: SupabaseClient,
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
      console.warn("contact-submit: organization_whatsapp_templates read failed", error.message);
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
    console.warn("contact-submit: organization_whatsapp_templates exception", e);
    return null;
  }
}

export async function resolveWhatsappTemplateEnvWithDb(
  admin: SupabaseClient | null | undefined,
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

export function parseTemplateBodyKeysFromResolved(resolved: ResolvedWhatsappTemplateEnv): string[] {
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
    console.warn("contact-submit: invalid WHATSAPP_TEMPLATE_COMPONENTS_JSON (not a JSON array)");
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
      `contact-submit: WHATSAPP_TEMPLATE_BODY_PARAMETER_NAMES count (${names.length}) != KEYS (${expectedCount}) — pakai format posisional`,
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
export function extractWaMessageIdFromRawText(text: string): string | undefined {
  const quoted = text.match(/"id"\s*:\s*"(wamid\.[^"]+)"/);
  if (quoted?.[1]) return quoted[1];
  const loose = text.match(/(wamid\.[A-Za-z0-9+/=_-]{12,})/);
  if (loose?.[1]) return loose[1];
  return undefined;
}

/** Readable preview for inbox / `whatsapp_messages.body` (template + variable lines). */
export function formatTemplateMessageBody(args: {
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

export async function sendWhatsappTemplateToClient(args: {
  toE164: string;
  ctx: Record<string, string>;
  /** Dari `public.organization_whatsapp_accounts`; jika kosong dipakai secret `WHATSAPP_PHONE_NUMBER_ID`. */
  graphPhoneNumberId?: string | null;
  /** Untuk env opsional `WHATSAPP_TEMPLATE_*__SUFFIX`; jika null hanya secret global (perilaku lama). */
  webId?: string | null;
  /** Jika ada: merge `public.organization_whatsapp_templates` di atas env. */
  admin?: SupabaseClient | null;
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
    console.warn(`contact-submit: WhatsApp API not called — ${skip_reason}`);
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
    console.error("contact-submit: WhatsApp Graph request failed", {
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

/** Same ticket string as `public.whatsapp_conversations.ticket_id` (generated) and Leads "Open Chat". */
function waTicketIdFromConversationUuid(convId: string): string {
  return "WA-" + String(convId).replace(/-/g, "").slice(0, 8).toUpperCase();
}

/**
 * Sets `leads.ticket_id` to match the WA conversation ticket and removes other leads with that ticket
 * (e.g. duplicates from whatsapp-webhook). Inlined here so deploy bundles a single `index.ts` entry.
 */
export async function syncLeadTicketAfterOutboundConversation(
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
export async function upsertConversationAndInsertOutboundMessage(args: {
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

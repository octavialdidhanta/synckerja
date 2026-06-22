import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const META_API_BASE = "https://graph.facebook.com/v21.0";
const MEDIA_HEADER_FORMATS = new Set(["IMAGE", "VIDEO", "DOCUMENT"]);
const EMPTY_PARAM = "-";

function countPlaceholders(text: string): number {
  return (text.match(/\{\{[^}]+\}\}/g) ?? []).length;
}

function normalizeParamValue(raw: unknown): string {
  const s = String(raw ?? "").trim();
  return s.length > 0 ? s.slice(0, 1024) : EMPTY_PARAM;
}

/** Filled template text for livechat storage (no `[Template: name]` prefix — UI already shows badge). */
export function renderFilledTemplateBody(
  templateComponents: unknown[] | null | undefined,
  parameterValues: string[],
): string {
  const params = parameterValues.map((x) => normalizeParamValue(x));
  let idx = 0;
  const parts: string[] = [];
  if (!Array.isArray(templateComponents)) {
    const fallback = params.filter((p) => p !== EMPTY_PARAM).join(" · ");
    return fallback.slice(0, 4090);
  }

  for (const raw of templateComponents) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const c = raw as Record<string, unknown>;
    const type = String(c.type ?? "").toUpperCase();
    if (type === "HEADER") {
      const fmt = String(c.format ?? "TEXT").toUpperCase();
      if (MEDIA_HEADER_FORMATS.has(fmt)) {
        const n = countPlaceholders(String(c.text ?? ""));
        for (let i = 0; i < n; i++) idx++;
        continue;
      }
      let text = String(c.text ?? "");
      const n = countPlaceholders(text);
      for (let i = 0; i < n; i++) {
        text = text.replace(/\{\{[^}]+\}\}/, params[idx++] ?? EMPTY_PARAM);
      }
      if (text.trim()) parts.push(text.trim());
    } else if (type === "BODY") {
      let text = String(c.text ?? "");
      const n = countPlaceholders(text);
      for (let i = 0; i < n; i++) {
        text = text.replace(/\{\{[^}]+\}\}/, params[idx++] ?? EMPTY_PARAM);
      }
      if (text.trim()) parts.push(text.trim());
    } else if (type === "BUTTONS") {
      const buttons = c.buttons;
      if (!Array.isArray(buttons)) continue;
      for (const btn of buttons) {
        if (!btn || typeof btn !== "object") continue;
        const b = btn as Record<string, unknown>;
        if (String(b.type ?? "").toUpperCase() !== "URL") continue;
        const n = countPlaceholders(String(b.url ?? ""));
        for (let i = 0; i < n; i++) idx++;
      }
    }
  }

  if (parts.length === 0) {
    const fallback = params.filter((p) => p !== EMPTY_PARAM).join(" · ");
    return fallback.slice(0, 4090);
  }
  return parts.join("\n\n").slice(0, 4090);
}

/** Fill BODY placeholders only — matches WhatsApp API body `parameters` (not header). */
export function renderFilledBodyTemplateText(
  templateComponents: unknown[] | null | undefined,
  bodyParams: string[],
): string {
  const params = bodyParams.map((x) => normalizeParamValue(x));
  if (!Array.isArray(templateComponents)) {
    const fallback = params.filter((p) => p !== EMPTY_PARAM).join(" · ");
    return fallback.slice(0, 4090);
  }

  for (const raw of templateComponents) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const c = raw as Record<string, unknown>;
    if (String(c.type ?? "").toUpperCase() !== "BODY") continue;
    let text = String(c.text ?? "");
    const n = countPlaceholders(text);
    for (let i = 0; i < n; i++) {
      text = text.replace(/\{\{[^}]+\}\}/, params[i] ?? EMPTY_PARAM);
    }
    return text.trim().slice(0, 4090);
  }

  const fallback = params.filter((p) => p !== EMPTY_PARAM).join(" · ");
  return fallback.slice(0, 4090);
}

async function fetchWabaIdFromPhoneNumberId(phoneNumberId: string, accessToken: string): Promise<string | null> {
  const fields = encodeURIComponent("whatsapp_business_account{id}");
  const url = `${META_API_BASE}/${encodeURIComponent(phoneNumberId)}?fields=${fields}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const wabaObj = json.whatsapp_business_account as { id?: string } | undefined;
  const waba = wabaObj?.id != null ? String(wabaObj.id).trim() : "";
  return waba || null;
}

async function resolveWabaId(
  admin: SupabaseClient,
  organizationId: string,
  whatsappAccountId: string,
  phoneNumberId: string,
  accessToken: string,
): Promise<string | null> {
  const { data: acc } = await admin
    .from("organization_whatsapp_accounts")
    .select("whatsapp_business_account_id")
    .eq("id", whatsappAccountId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  let wabaId = String(acc?.whatsapp_business_account_id ?? "").trim();
  if (!wabaId) {
    const { data: meta } = await admin
      .from("organization_meta_config")
      .select("whatsapp_business_account_id")
      .eq("organization_id", organizationId)
      .maybeSingle();
    wabaId = String(meta?.whatsapp_business_account_id ?? "").trim();
  }
  if (!wabaId && phoneNumberId) {
    wabaId = (await fetchWabaIdFromPhoneNumberId(phoneNumberId, accessToken)) ?? "";
  }
  return wabaId || null;
}

function templateLanguageCode(row: Record<string, unknown>): string {
  const lang = row.language;
  if (typeof lang === "string") return lang.trim().toLowerCase();
  if (lang && typeof lang === "object" && !Array.isArray(lang)) {
    const code = (lang as { code?: string }).code;
    if (code) return String(code).trim().toLowerCase();
  }
  return "";
}

export async function fetchMetaTemplateComponents(
  wabaId: string,
  accessToken: string,
  templateName: string,
  templateLanguage: string,
): Promise<unknown[] | null> {
  const fields = encodeURIComponent("name,language,status,components");
  const url =
    `${META_API_BASE}/${encodeURIComponent(wabaId)}/message_templates` +
    `?name=${encodeURIComponent(templateName)}&fields=${fields}&limit=20`;

  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    console.error("fetchMetaTemplateComponents:", json);
    return null;
  }

  const rows = Array.isArray(json.data) ? (json.data as Record<string, unknown>[]) : [];
  const wantLang = templateLanguage.trim().toLowerCase() || "id";
  const match =
    rows.find((r) => templateLanguageCode(r) === wantLang) ??
    rows.find((r) => String(r.name ?? "").trim() === templateName.trim()) ??
    rows[0];

  const components = match?.components;
  return Array.isArray(components) ? components : null;
}

export async function buildLeadWhatsAppStoredBody(
  admin: SupabaseClient,
  args: {
    organizationId: string;
    whatsappAccountId: string;
    phoneNumberId: string;
    accessToken: string;
    templateName: string;
    templateLanguage: string;
    bodyParams: string[];
  },
): Promise<string> {
  const wabaId = await resolveWabaId(
    admin,
    args.organizationId,
    args.whatsappAccountId,
    args.phoneNumberId,
    args.accessToken,
  );

  if (wabaId) {
    const components = await fetchMetaTemplateComponents(
      wabaId,
      args.accessToken,
      args.templateName,
      args.templateLanguage,
    );
    if (components) {
      return renderFilledTemplateBody(components, args.bodyParams);
    }
  }

  const filled = renderFilledTemplateBody(null, args.bodyParams);
  if (filled.trim()) return filled.slice(0, 4090);
  return `[Template: ${args.templateName.trim()}]`.slice(0, 200);
}

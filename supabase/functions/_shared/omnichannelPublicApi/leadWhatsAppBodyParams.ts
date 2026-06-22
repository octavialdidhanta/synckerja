import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildParamsFromMapping,
  parseParameterMapping,
  paramOrDash,
  type LeadMappingSource,
} from "./leadTemplateMapping.ts";

export type { LeadMappingSource };

export type LeadWhatsAppTemplateConfig = {
  templateName: string;
  templateLanguage: string;
  bodyKeys: string[];
  mappingSource: LeadMappingSource;
};

/** Fixed 7-param map (API docs default) when no org template row exists. */
export function buildLeadWhatsAppBodyParamsFixed(args: {
  name: string;
  email: string | null;
  phoneNumber: string;
  formData: Record<string, unknown> | null;
}): string[] {
  const fd = args.formData ?? {};
  return [
    paramOrDash(args.name),
    paramOrDash(args.email),
    paramOrDash(args.phoneNumber),
    paramOrDash(fd.package_label),
    paramOrDash(fd.event_date),
    paramOrDash(fd.event_time),
    paramOrDash(fd.event_address),
  ];
}

export function buildLeadWhatsAppBodyParamsFromKeys(
  bodyKeys: string[],
  args: {
    name: string;
    email: string | null;
    phoneNumber: string;
    formData: Record<string, unknown> | null;
  },
): string[] {
  return buildParamsFromMapping(bodyKeys, args);
}

export function parseLeadConsent(
  body: Record<string, unknown>,
  formData: Record<string, unknown> | null,
): boolean {
  const raw = body.consent ?? formData?.consent;
  if (raw === true) return true;
  if (raw === false) return false;
  if (typeof raw === "string" && raw.trim().toLowerCase() === "true") return true;
  return false;
}

function parseLegacyBodyKeys(bodyKeysRaw: unknown): string[] {
  return String(bodyKeysRaw ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
}

/** Load per-web_id template mapping (parameter_mapping or legacy body_keys). */
export async function loadLeadWhatsAppTemplateConfig(
  admin: SupabaseClient,
  organizationId: string,
  webId: string,
  templateName: string,
): Promise<LeadWhatsAppTemplateConfig | null> {
  const normalizedWebId = webId.trim().toLowerCase();
  const normalizedTemplate = templateName.trim();

  const { data: row } = await admin
    .from("organization_whatsapp_templates")
    .select("template_name, template_language, parameter_mapping, body_keys, is_active")
    .eq("organization_id", organizationId)
    .eq("web_id", normalizedWebId)
    .eq("purpose", "lead")
    .eq("template_name", normalizedTemplate)
    .eq("is_active", true)
    .maybeSingle();

  if (!row) return null;

  const templateLanguage = String(row.template_language ?? "id").trim() || "id";
  const templateNameResolved = String(row.template_name ?? normalizedTemplate);

  const mappedKeys = parseParameterMapping(row.parameter_mapping);
  if (mappedKeys && mappedKeys.length > 0) {
    return {
      templateName: templateNameResolved,
      templateLanguage,
      bodyKeys: mappedKeys,
      mappingSource: "parameter_mapping",
    };
  }

  const legacyKeys = parseLegacyBodyKeys(row.body_keys);
  if (legacyKeys.length > 0) {
    return {
      templateName: templateNameResolved,
      templateLanguage,
      bodyKeys: legacyKeys,
      mappingSource: "organization_whatsapp_templates",
    };
  }

  return null;
}

export async function resolveLeadWhatsAppBodyParams(
  admin: SupabaseClient,
  args: {
    organizationId: string;
    webId: string;
    templateName: string;
    orgTemplateLanguage?: string | null;
    name: string;
    email: string | null;
    phoneNumber: string;
    formData: Record<string, unknown> | null;
  },
): Promise<{ params: string[]; language: string; mappingSource: LeadMappingSource }> {
  const config = await loadLeadWhatsAppTemplateConfig(
    admin,
    args.organizationId,
    args.webId,
    args.templateName,
  );

  if (config) {
    if (
      config.mappingSource === "parameter_mapping" &&
      config.bodyKeys.length === 0
    ) {
      console.error("resolveLeadWhatsAppBodyParams: empty parameter_mapping", {
        organizationId: args.organizationId,
        webId: args.webId,
        templateName: args.templateName,
      });
    }

    return {
      params: buildLeadWhatsAppBodyParamsFromKeys(config.bodyKeys, args),
      language: config.templateLanguage,
      mappingSource: config.mappingSource,
    };
  }

  const orgLanguage = String(args.orgTemplateLanguage ?? "id").trim() || "id";

  return {
    params: buildLeadWhatsAppBodyParamsFixed(args),
    language: orgLanguage,
    mappingSource: "fixed_7",
  };
}

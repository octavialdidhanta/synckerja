import {
  countTemplateParameterSlots,
} from '@/5-3-whatsapp-template/utils/buildCampaignTemplateParameters';
import { extractTemplateParameterSlots } from '@/5-3-whatsapp-template/utils/campaignTemplateContent';

export const LEAD_MAGNET_WA_PARAM_TOKENS = {
  username: '{{username}}',
  deliveryUrl: '{{delivery_url}}',
  campaignName: '{{campaign_name}}',
  empty: '-',
} as const;

export type LeadMagnetWaParamToken =
  | typeof LEAD_MAGNET_WA_PARAM_TOKENS.username
  | typeof LEAD_MAGNET_WA_PARAM_TOKENS.deliveryUrl
  | typeof LEAD_MAGNET_WA_PARAM_TOKENS.campaignName
  | typeof LEAD_MAGNET_WA_PARAM_TOKENS.empty
  | string;

export type LeadMagnetWhatsAppTemplateParams = {
  parameter_values?: string[];
  components_json?: unknown[];
  /** @deprecated legacy body-only mapping */
  body?: string[];
  header?: string[];
  button?: string[];
};

export function parseLeadMagnetWhatsAppTemplateParams(
  raw: Record<string, unknown> | null | undefined,
): LeadMagnetWhatsAppTemplateParams {
  if (!raw || typeof raw !== 'object') return {};
  const parameterValues = Array.isArray(raw.parameter_values)
    ? raw.parameter_values.map((v) => String(v ?? ''))
    : undefined;
  const componentsJson = Array.isArray(raw.components_json) ? raw.components_json : undefined;
  const body = Array.isArray(raw.body) ? raw.body.map((v) => String(v ?? '')) : undefined;
  const header = Array.isArray(raw.header) ? raw.header.map((v) => String(v ?? '')) : undefined;
  const button = Array.isArray(raw.button) ? raw.button.map((v) => String(v ?? '')) : undefined;
  return { parameter_values: parameterValues, components_json: componentsJson, body, header, button };
}

export function suggestLeadMagnetParameterValues(
  componentsJson: unknown[] | null | undefined,
): string[] {
  const slots = extractTemplateParameterSlots(componentsJson);
  if (slots.length === 0) return [];

  const bodySlotIndexes = slots.filter((s) => s.region === 'body').map((s) => s.index);
  const firstBodyIndex = bodySlotIndexes[0];
  const lastBodyIndex = bodySlotIndexes[bodySlotIndexes.length - 1];

  return slots.map((slot) => {
    if (slot.index === firstBodyIndex) return LEAD_MAGNET_WA_PARAM_TOKENS.username;
    if (slot.index === lastBodyIndex && bodySlotIndexes.length > 1) {
      return LEAD_MAGNET_WA_PARAM_TOKENS.deliveryUrl;
    }
    if (slots.length === 1) return LEAD_MAGNET_WA_PARAM_TOKENS.deliveryUrl;
    if (slot.index === lastBodyIndex) return LEAD_MAGNET_WA_PARAM_TOKENS.deliveryUrl;
    return LEAD_MAGNET_WA_PARAM_TOKENS.empty;
  });
}

export function isLeadMagnetTemplateMappingComplete(
  params: Record<string, unknown> | null | undefined,
): boolean {
  const parsed = parseLeadMagnetWhatsAppTemplateParams(params);
  const components = parsed.components_json;
  const values = parsed.parameter_values;

  if (Array.isArray(components) && components.length > 0) {
    const expected = countTemplateParameterSlots(components);
    if (expected <= 0) return true;
    if (!Array.isArray(values) || values.length < expected) return false;
    return values.slice(0, expected).every((v) => String(v ?? '').trim().length > 0);
  }

  // Legacy campaigns with body-only mapping
  if (Array.isArray(parsed.body) && parsed.body.length > 0) {
    return parsed.body.every((v) => String(v ?? '').trim().length > 0);
  }

  return false;
}

export function leadMagnetTemplateMappingError(
  params: Record<string, unknown> | null | undefined,
): string | null {
  const parsed = parseLeadMagnetWhatsAppTemplateParams(params);
  const components = parsed.components_json;
  const values = parsed.parameter_values;

  if (!Array.isArray(components) || components.length === 0) {
    if (Array.isArray(parsed.body) && parsed.body.length > 0) return null;
    return 'Pilih template WhatsApp dan lengkapi mapping variabel';
  }

  const expected = countTemplateParameterSlots(components);
  const actual = Array.isArray(values) ? values.length : 0;
  if (expected <= 0) return null;
  if (actual < expected) {
    return `Template membutuhkan ${expected} variabel, hanya ${actual} yang diisi`;
  }
  const missing = values!.slice(0, expected).some((v) => !String(v ?? '').trim());
  if (missing) return `Lengkapi semua ${expected} variabel template WhatsApp`;
  return null;
}

export function buildLeadMagnetWhatsAppTemplateParamsPayload(args: {
  componentsJson: unknown[];
  parameterValues: string[];
}): LeadMagnetWhatsAppTemplateParams {
  return {
    components_json: args.componentsJson,
    parameter_values: args.parameterValues,
  };
}

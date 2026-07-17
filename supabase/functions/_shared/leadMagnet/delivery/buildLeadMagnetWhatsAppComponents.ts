import {
  buildGraphTemplateComponents,
  countTemplateParameterSlots,
  isTemplateBuildFailure,
} from "../../waTemplateGraph.ts";
export { countTemplateParameterSlots };
import {
  buildWhatsAppTemplateComponents,
  interpolateDeliveryTemplate,
  type DeliveryContext,
  type WhatsAppTemplateParams,
} from "./buildDeliveryContext.ts";

type ParsedWhatsAppTemplateParams = {
  parameter_values?: string[];
  components_json?: unknown[];
  body?: string[];
  header?: string[];
  button?: string[];
};

function parseStoredWhatsAppTemplateParams(
  raw: Record<string, unknown> | null | undefined,
): ParsedWhatsAppTemplateParams {
  if (!raw || typeof raw !== "object") return {};
  const parameterValues = Array.isArray(raw.parameter_values)
    ? raw.parameter_values.map((v) => String(v ?? ""))
    : undefined;
  const componentsJson = Array.isArray(raw.components_json) ? raw.components_json : undefined;
  const body = Array.isArray(raw.body) ? raw.body.map((v) => String(v ?? "")) : undefined;
  const header = Array.isArray(raw.header) ? raw.header.map((v) => String(v ?? "")) : undefined;
  const button = Array.isArray(raw.button) ? raw.button.map((v) => String(v ?? "")) : undefined;
  return {
    parameter_values: parameterValues,
    components_json: componentsJson,
    body,
    header,
    button,
  };
}

export function validateWhatsAppTemplateParamsForPublish(
  params: Record<string, unknown> | null | undefined,
): string | null {
  const parsed = parseStoredWhatsAppTemplateParams(params);
  const components = parsed.components_json;
  const values = parsed.parameter_values;

  if (Array.isArray(components) && components.length > 0) {
    const expected = countTemplateParameterSlots(components);
    if (expected <= 0) return null;
    if (!Array.isArray(values)) {
      return `Template WhatsApp membutuhkan ${expected} variabel — mapping belum disimpan`;
    }
    if (values.length < expected) {
      return `Template WhatsApp membutuhkan ${expected} variabel, hanya ${values.length} yang diisi`;
    }
    const missing = values.slice(0, expected).some((v) => !String(v ?? "").trim());
    if (missing) return `Lengkapi semua ${expected} variabel template WhatsApp`;
    return null;
  }

  if (Array.isArray(parsed.body) && parsed.body.length > 0) {
    const missing = parsed.body.some((v) => !String(v ?? "").trim());
    if (missing) return "Lengkapi variabel template WhatsApp (format legacy)";
    return null;
  }

  return "Mapping variabel template WhatsApp wajib diisi";
}

/** Flat interpolated template values in Meta {{1}}…{{n}} order (for preview + persist). */
export function getInterpolatedLeadMagnetTemplateValues(
  params: Record<string, unknown> | null | undefined,
  ctx: DeliveryContext,
): string[] | null {
  const parsed = parseStoredWhatsAppTemplateParams(params);
  if (!Array.isArray(parsed.components_json) || parsed.components_json.length === 0) {
    return null;
  }
  const expected = countTemplateParameterSlots(parsed.components_json);
  const rawValues = parsed.parameter_values ?? [];
  if (rawValues.length < expected) return null;
  return rawValues
    .slice(0, expected)
    .map((v) => interpolateDeliveryTemplate(String(v ?? ""), ctx));
}

export function buildLeadMagnetWhatsAppComponents(
  params: Record<string, unknown> | null | undefined,
  ctx: DeliveryContext,
): { ok: true; components: Array<Record<string, unknown>> } | { ok: false; error: string } {
  const parsed = parseStoredWhatsAppTemplateParams(params);

  if (Array.isArray(parsed.components_json) && parsed.components_json.length > 0) {
    const expected = countTemplateParameterSlots(parsed.components_json);
    const rawValues = parsed.parameter_values ?? [];
    if (rawValues.length < expected) {
      return {
        ok: false,
        error: `Template expects ${expected} variable(s) but received ${rawValues.length}.`,
      };
    }
    const interpolated = rawValues
      .slice(0, expected)
      .map((v) => interpolateDeliveryTemplate(String(v ?? ""), ctx));
    const built = buildGraphTemplateComponents(parsed.components_json, interpolated);
    if (isTemplateBuildFailure(built)) {
      return { ok: false, error: built.reason };
    }
    return { ok: true, components: built.components };
  }

  const legacyParams: WhatsAppTemplateParams = {
    body: parsed.body,
    header: parsed.header,
    button: parsed.button,
  };
  return { ok: true, components: buildWhatsAppTemplateComponents(legacyParams, ctx) };
}

import type { TFunction } from "i18next";
import type { MemberRowLite, RecipientListMemberViewRow } from "./enrichRecipientListMembers";
import type { WhatsappRecipientListDetailPayload } from "@/5-3-whatsapp-template/hooks/useWhatsappRecipientLists";

const MEDIA_HEADER_FORMATS = new Set(["IMAGE", "VIDEO", "DOCUMENT"]);

function countPlaceholders(text: string): number {
  return (text.match(/\{\{[^}]+\}\}/g) ?? []).length;
}

export type TemplateSlotRegion = "header" | "body";

export type TemplateParameterSlot = {
  /** 1-based index for UI label {{1}}, {{2}}, … */
  index: number;
  label: string;
  region: TemplateSlotRegion;
};

export type MappableFieldKey =
  | "import_full_name"
  | "import_customer_name"
  | "import_company"
  | "fullName"
  | "phoneDisplay";

export type MappableFieldOption = {
  key: MappableFieldKey;
  labelKey: string;
};

/** Variable mapping: slot index (1..n) → mappable field key */
export type VariableMapping = Record<number, MappableFieldKey>;

const FILE_UPLOAD_FIELDS: MappableFieldOption[] = [
  { key: "import_full_name", labelKey: "whatsappTemplates.campaign.content.field.importFullName" },
  { key: "import_customer_name", labelKey: "whatsappTemplates.campaign.content.field.importCustomerName" },
  { key: "import_company", labelKey: "whatsappTemplates.campaign.content.field.importCompany" },
  { key: "fullName", labelKey: "whatsappTemplates.campaign.content.field.fullName" },
  { key: "phoneDisplay", labelKey: "whatsappTemplates.campaign.content.field.phoneDisplay" },
];

const CRM_SELECT_FIELDS: MappableFieldOption[] = [
  { key: "fullName", labelKey: "whatsappTemplates.campaign.content.field.fullName" },
  { key: "phoneDisplay", labelKey: "whatsappTemplates.campaign.content.field.phoneDisplay" },
];

export function getMappableFieldOptions(
  creationSource: string | null | undefined,
): MappableFieldOption[] {
  const src = String(creationSource ?? "crm_select").toLowerCase();
  return src === "file_upload" ? FILE_UPLOAD_FIELDS : CRM_SELECT_FIELDS;
}

export function mappableFieldLabel(key: MappableFieldKey, t: TFunction): string {
  const opt = [...FILE_UPLOAD_FIELDS, ...CRM_SELECT_FIELDS].find((f) => f.key === key);
  return opt ? t(opt.labelKey) : key;
}

export function extractTemplateParameterSlots(
  components: unknown[] | null | undefined,
): TemplateParameterSlot[] {
  const slots: TemplateParameterSlot[] = [];
  if (!Array.isArray(components)) return slots;
  let index = 0;
  for (const raw of components) {
    const c = raw as Record<string, unknown>;
    const type = String(c.type ?? "").toUpperCase();
    if (type === "HEADER") {
      const fmt = String(c.format ?? "").toUpperCase();
      if (!MEDIA_HEADER_FORMATS.has(fmt)) {
        const n = countPlaceholders(String(c.text ?? ""));
        for (let i = 0; i < n; i++) {
          index += 1;
          slots.push({ index, label: `{{${index}}}`, region: "header" });
        }
      } else {
        const n = countPlaceholders(String(c.text ?? ""));
        for (let i = 0; i < n; i++) {
          index += 1;
          slots.push({ index, label: `{{${index}}}`, region: "header" });
        }
      }
    } else if (type === "BODY") {
      const n = countPlaceholders(String(c.text ?? ""));
      for (let i = 0; i < n; i++) {
        index += 1;
        slots.push({ index, label: `{{${index}}}`, region: "body" });
      }
    } else if (type === "BUTTONS") {
      const buttons = c.buttons;
      if (!Array.isArray(buttons)) continue;
      for (const btn of buttons) {
        if (!btn || typeof btn !== "object") continue;
        const b = btn as Record<string, unknown>;
        if (String(b.type ?? "").toUpperCase() !== "URL") continue;
        const n = countPlaceholders(String(b.url ?? ""));
        for (let i = 0; i < n; i++) {
          index += 1;
          slots.push({ index, label: `{{${index}}}`, region: "body" });
        }
      }
    }
  }
  return slots;
}

export type TemplateContentKind =
  | "hidden"
  | "plain"
  | "withVariables"
  | "withMediaHeader"
  | "withMediaAndVariables";

export function deriveTemplateContentKind(
  components: unknown[] | null | undefined,
): TemplateContentKind {
  if (!Array.isArray(components) || components.length === 0) return "hidden";
  const slots = extractTemplateParameterSlots(components);
  const hasMedia = components.some((raw) => {
    const c = raw as Record<string, unknown>;
    if (String(c.type ?? "").toUpperCase() !== "HEADER") return false;
    const fmt = String(c.format ?? "").toUpperCase();
    return MEDIA_HEADER_FORMATS.has(fmt);
  });
  if (slots.length > 0 && hasMedia) return "withMediaAndVariables";
  if (slots.length > 0) return "withVariables";
  if (hasMedia) return "withMediaHeader";
  return "plain";
}

export function hasMediaHeader(components: unknown[] | null | undefined): boolean {
  if (!Array.isArray(components)) return false;
  return components.some((raw) => {
    const c = raw as Record<string, unknown>;
    if (String(c.type ?? "").toUpperCase() !== "HEADER") return false;
    return MEDIA_HEADER_FORMATS.has(String(c.format ?? "").toUpperCase());
  });
}

export function resolveFieldValue(
  key: MappableFieldKey,
  view: RecipientListMemberViewRow,
  raw: MemberRowLite,
): string {
  switch (key) {
    case "import_full_name":
      return String(raw.import_full_name ?? "").trim();
    case "import_customer_name":
      return String(raw.import_customer_name ?? "").trim();
    case "import_company":
      return String(raw.import_company ?? "").trim();
    case "fullName":
      return view.fullName.trim();
    case "phoneDisplay":
      return view.phoneDisplay.trim();
    default:
      return "";
  }
}

/** ASCII hyphen — Meta-safe empty fallback (matches worker). */
const EMPTY_PARAM = "-";

export function buildParameterValuesFromMapping(
  slots: TemplateParameterSlot[],
  mapping: VariableMapping,
  view: RecipientListMemberViewRow,
  raw: MemberRowLite,
): string[] {
  return slots.map((slot) => {
    const key = mapping[slot.index];
    if (!key) return EMPTY_PARAM;
    const v = resolveFieldValue(key, view, raw).slice(0, 1024);
    return v.length > 0 ? v : EMPTY_PARAM;
  });
}

/** Preferred field order for auto-suggest by slot index. */
const SUGGEST_ORDER_FILE: MappableFieldKey[] = [
  "fullName",
  "import_full_name",
  "import_customer_name",
  "import_company",
  "phoneDisplay",
];

const SUGGEST_ORDER_CRM: MappableFieldKey[] = ["fullName", "phoneDisplay"];

export function suggestDefaultMapping(
  slots: TemplateParameterSlot[],
  creationSource: string | null | undefined,
): VariableMapping {
  const available = new Set(
    getMappableFieldOptions(creationSource).map((f) => f.key),
  );
  const order =
    String(creationSource ?? "").toLowerCase() === "file_upload"
      ? SUGGEST_ORDER_FILE
      : SUGGEST_ORDER_CRM;
  const pool = order.filter((k) => available.has(k));
  const out: VariableMapping = {};
  for (const slot of slots) {
    const key = pool[(slot.index - 1) % pool.length];
    if (key) out[slot.index] = key;
  }
  return out;
}

export function mergeMappingOnListChange(
  prev: VariableMapping,
  slots: TemplateParameterSlot[],
  creationSource: string | null | undefined,
): VariableMapping {
  const available = new Set(
    getMappableFieldOptions(creationSource).map((f) => f.key),
  );
  const out: VariableMapping = {};
  for (const slot of slots) {
    const key = prev[slot.index];
    if (key && available.has(key)) {
      out[slot.index] = key;
    }
  }
  const suggested = suggestDefaultMapping(
    slots.filter((s) => !out[s.index]),
    creationSource,
  );
  for (const slot of slots) {
    if (!out[slot.index] && suggested[slot.index]) {
      out[slot.index] = suggested[slot.index]!;
    }
  }
  return out;
}

export function isMappingComplete(
  slots: TemplateParameterSlot[],
  mapping: VariableMapping,
): boolean {
  if (slots.length === 0) return true;
  return slots.every((s) => Boolean(mapping[s.index]));
}

export function variableMappingToJson(mapping: VariableMapping): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(mapping)) {
    out[String(k)] = v;
  }
  return out;
}

export function parseParameterMappingJson(
  raw: unknown,
): VariableMapping | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out: VariableMapping = {};
  const validKeys = new Set<MappableFieldKey>([
    "import_full_name",
    "import_customer_name",
    "import_company",
    "fullName",
    "phoneDisplay",
  ]);
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const idx = Number(k);
    if (!Number.isFinite(idx) || idx < 1) continue;
    const key = String(v ?? "") as MappableFieldKey;
    if (validKeys.has(key)) out[idx] = key;
  }
  return Object.keys(out).length > 0 ? out : null;
}

export function getListCreationSource(
  listDetail: WhatsappRecipientListDetailPayload | null | undefined,
): string {
  return listDetail?.list?.creation_source ?? "crm_select";
}

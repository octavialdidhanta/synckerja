import {
  CUSTOM_FORM_ENTRY_SCREEN_ID,
  type CustomFormField,
  type CustomFormFieldInputType,
  type CustomFormModel,
} from "./buildCustomFormFlowJson";

export type ParseCustomFormResult =
  | { ok: true; model: CustomFormModel }
  | { ok: false; reason: string };

const INPUT_TYPES: CustomFormFieldInputType[] = ["text", "email", "number", "phone"];

function parseInputType(raw: unknown): CustomFormFieldInputType {
  const v = String(raw ?? "text").trim().toLowerCase();
  return INPUT_TYPES.includes(v as CustomFormFieldInputType) ? (v as CustomFormFieldInputType) : "text";
}

function asChildren(layout: unknown): unknown[] {
  if (layout == null || typeof layout !== "object") return [];
  const children = (layout as { children?: unknown }).children;
  return Array.isArray(children) ? children : [];
}

/**
 * Reverse `buildCustomFormFlowJson` for Synckerja single-screen custom forms.
 */
export function parseCustomFormFlowJson(flowJson: unknown): ParseCustomFormResult {
  if (flowJson == null || typeof flowJson !== "object" || Array.isArray(flowJson)) {
    return { ok: false, reason: "Invalid flow JSON object" };
  }
  const screens = (flowJson as { screens?: unknown }).screens;
  if (!Array.isArray(screens) || screens.length === 0) {
    return { ok: false, reason: "No screens in flow JSON" };
  }
  const screen =
    screens.find(
      (s) =>
        s != null &&
        typeof s === "object" &&
        String((s as { id?: string }).id ?? "") === CUSTOM_FORM_ENTRY_SCREEN_ID,
    ) ?? screens[0];
  if (screen == null || typeof screen !== "object") {
    return { ok: false, reason: "Invalid screen" };
  }
  const screenObj = screen as { title?: string; layout?: unknown };
  const children = asChildren(screenObj.layout);
  let screenTitle = "";
  let introText = "";
  const fields: CustomFormField[] = [];

  for (const child of children) {
    if (child == null || typeof child !== "object") continue;
    const row = child as Record<string, unknown>;
    const type = String(row.type ?? "").trim();
    if (type === "TextHeading") {
      screenTitle = String(row.text ?? "").trim();
      continue;
    }
    if (type === "TextBody") {
      introText = String(row.text ?? "").trim();
      continue;
    }
    if (type === "TextInput" || type === "TextEntry") {
      const name = String(row.name ?? "").trim();
      const label = String(row.label ?? "").trim();
      if (!name || !label) continue;
      fields.push({
        name,
        label,
        instructions: row["helper-text"] != null ? String(row["helper-text"]).trim() : undefined,
        inputType: parseInputType(row["input-type"]),
        required: Boolean(row.required),
      });
    }
  }

  if (!screenTitle) {
    screenTitle = String(screenObj.title ?? "").trim() || "Form";
  }
  if (fields.length === 0) {
    return { ok: false, reason: "No TextInput fields found" };
  }

  return {
    ok: true,
    model: {
      screenTitle,
      introText: introText || undefined,
      fields,
    },
  };
}

export function canParseCustomFormFlowJson(flowJson: unknown): boolean {
  return parseCustomFormFlowJson(flowJson).ok;
}

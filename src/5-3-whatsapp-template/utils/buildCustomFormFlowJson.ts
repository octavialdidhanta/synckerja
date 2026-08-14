import { WHATSAPP_FLOW_JSON_VERSION } from "./flowJsonVersion";

export { WHATSAPP_FLOW_JSON_VERSION };

/**
 * Builds WhatsApp Flow JSON for a minimal “custom form” (single screen, navigate + complete).
 * Schema follows Meta Flow JSON reference (components + layout).
 *
 * **Flow JSON version:** see `WHATSAPP_FLOW_JSON_VERSION` — bump when Meta deprecates.
 * @see https://developers.facebook.com/docs/whatsapp/flows/reference/flowjson/
 */

/** Single-screen entry id used for template FLOW `navigate_screen`. */
export const CUSTOM_FORM_ENTRY_SCREEN_ID = "CUSTOM_FORM_SCREEN" as const;

const LABEL_MAX = 20;
const INSTRUCTIONS_MAX = 80;
const TITLE_MAX = 60;

export type CustomFormFieldInputType = "text" | "email" | "number" | "phone";

export type CustomFormField = {
  /** Stable field id for Flow JSON `name` (snake_case). */
  name: string;
  label: string;
  instructions?: string;
  inputType: CustomFormFieldInputType;
  required: boolean;
};

export type CustomFormModel = {
  /** Shown as screen title and TextHeading. */
  screenTitle: string;
  /** Optional body copy below the heading. */
  introText?: string;
  fields: CustomFormField[];
};

function mapInputType(t: CustomFormFieldInputType): string {
  switch (t) {
    case "phone":
      return "phone";
    case "email":
      return "email";
    case "number":
      return "number";
    case "text":
    default:
      return "text";
  }
}

/**
 * Returns Flow JSON object suitable for `flow_json` on create flow (stringify before POST).
 */
export function buildCustomFormFlowJson(model: CustomFormModel): {
  flowJson: Record<string, unknown>;
  entryScreenId: string;
} {
  const title = (model.screenTitle || "Form").trim().slice(0, TITLE_MAX);
  const children: Record<string, unknown>[] = [
    { type: "TextHeading", text: title },
  ];
  const intro = (model.introText ?? "").trim();
  if (intro) {
    children.push({ type: "TextBody", text: intro.slice(0, 4096) });
  }
  for (const f of model.fields) {
    const label = f.label.trim().slice(0, LABEL_MAX);
    const row: Record<string, unknown> = {
      type: "TextEntry",
      name: f.name.trim(),
      label,
      required: Boolean(f.required),
      "input-type": mapInputType(f.inputType),
    };
    const h = (f.instructions ?? "").trim();
    if (h) row["helper-text"] = h.slice(0, INSTRUCTIONS_MAX);
    children.push(row);
  }
  children.push({
    type: "Footer",
    label: "Continue",
    "on-click-action": {
      name: "complete",
      payload: {},
    },
  });

  const flowJson: Record<string, unknown> = {
    version: WHATSAPP_FLOW_JSON_VERSION,
    screens: [
      {
        id: CUSTOM_FORM_ENTRY_SCREEN_ID,
        title: title.slice(0, 80),
        terminal: true,
        data: {},
        layout: {
          type: "SingleColumnLayout",
          children,
        },
      },
    ],
  };

  return { flowJson, entryScreenId: CUSTOM_FORM_ENTRY_SCREEN_ID };
}

/** Sanitize user-visible name into Graph `name` for POST /flows. */
export function toFlowApiName(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 128) || "custom_form";
}

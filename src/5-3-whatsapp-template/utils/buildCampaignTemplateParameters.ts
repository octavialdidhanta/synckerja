import type { MemberRowLite, RecipientListMemberViewRow } from "./enrichRecipientListMembers";
import { extractTemplateParameterSlots } from "./campaignTemplateContent";

function countPlaceholders(text: string): number {
  return (text.match(/\{\{[^}]+\}\}/g) ?? []).length;
}

/**
 * Counts `{{…}}` placeholders in HEADER (text) and BODY in component order — matches Meta template send payload.
 * MVP: values are filled per recipient with `buildMvpParameterValues` (import columns + name + phone, cycled).
 * Large slot counts still work; very long text is truncated to 1024 chars per parameter when sending.
 */
export function countTemplateParameterSlots(components: unknown[] | null | undefined): number {
  return extractTemplateParameterSlots(components).length;
}

export type MemberImportFields = Pick<
  MemberRowLite,
  "import_full_name" | "import_customer_name" | "import_company"
>;

/**
 * MVP: fill N slots cycling import fields, display name, and phone so Meta receives non-empty strings where possible.
 */
export function buildMvpParameterValues(
  slotCount: number,
  view: RecipientListMemberViewRow,
  raw: MemberImportFields,
): string[] {
  if (slotCount <= 0) return [];
  const full = view.fullName.trim() || view.phoneDisplay.trim() || "—";
  const phoneDigits = view.phoneDisplay.replace(/\D/g, "") || "0";
  const pool = [
    String(raw.import_full_name ?? "").trim() || full,
    String(raw.import_customer_name ?? "").trim() || full,
    String(raw.import_company ?? "").trim() || full,
    full,
    phoneDigits,
    view.phoneDisplay.trim() || phoneDigits,
  ];
  const out: string[] = [];
  for (let i = 0; i < slotCount; i++) {
    const v = String(pool[i % pool.length] ?? "").slice(0, 1024);
    out.push(v.length > 0 ? v : "—");
  }
  return out;
}

/**
 * Split a flat parameter list (same order as Meta HEADER text vars then BODY vars) for phone preview props.
 */
export function splitFlatParametersForPreview(
  components: unknown[] | null | undefined,
  flat: string[],
): { headerVariableExamples: string[]; bodyVariableExamples: string[] } {
  const headerVariableExamples: string[] = [];
  const bodyVariableExamples: string[] = [];
  if (!Array.isArray(components)) return { headerVariableExamples, bodyVariableExamples };
  let idx = 0;
  for (const raw of components) {
    const c = raw as Record<string, unknown>;
    const type = String(c.type ?? "").toUpperCase();
    if (type === "HEADER") {
      const fmt = String(c.format ?? "").toUpperCase();
      if (fmt === "IMAGE" || fmt === "VIDEO" || fmt === "DOCUMENT") continue;
      const n = countPlaceholders(String(c.text ?? ""));
      for (let i = 0; i < n; i++) {
        headerVariableExamples.push(String(flat[idx++] ?? "-").slice(0, 1024));
      }
    } else if (type === "BODY") {
      const n = countPlaceholders(String(c.text ?? ""));
      for (let i = 0; i < n; i++) {
        bodyVariableExamples.push(String(flat[idx++] ?? "-").slice(0, 1024));
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
          bodyVariableExamples.push(String(flat[idx++] ?? "-").slice(0, 1024));
        }
      }
    }
  }
  return { headerVariableExamples, bodyVariableExamples };
}

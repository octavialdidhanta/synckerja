/** Keys from form_data that have a non-empty value (matches website fields actually submitted). */
export function extractNonEmptyFormDataKeys(formData: unknown): string[] {
  if (!formData || typeof formData !== "object" || Array.isArray(formData)) return [];

  const out: string[] = [];
  for (const [key, value] of Object.entries(formData as Record<string, unknown>)) {
    const k = key.trim();
    if (!k) continue;
    if (value == null) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    out.push(k);
  }

  return out.sort((a, b) => a.localeCompare(b));
}

export function isFloatingWhatsAppStubFormData(formData: unknown): boolean {
  if (!formData || typeof formData !== "object" || Array.isArray(formData)) return false;
  return (formData as Record<string, unknown>).source === "floating_whatsapp";
}

export type MapperFormSubmissionRow = {
  status?: string | null;
  form_id?: string | null;
  form_data?: unknown;
};

/** Website form submissions usable for template field mapping (skip WA floating-click drafts). */
export function isMapperRelevantSubmission(row: MapperFormSubmissionRow): boolean {
  if (isFloatingWhatsAppStubFormData(row.form_data)) return false;
  if (String(row.status ?? "").toLowerCase() === "draft") return false;
  return true;
}

export function aggregateMapperFormDataKeys(
  rows: Array<{ form_data?: unknown }>,
): string[] {
  const keys = new Set<string>();
  for (const row of rows) {
    for (const key of extractNonEmptyFormDataKeys(row.form_data)) {
      keys.add(key);
    }
  }
  return [...keys].sort((a, b) => a.localeCompare(b));
}

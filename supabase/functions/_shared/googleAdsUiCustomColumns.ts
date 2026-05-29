export const UI_CUSTOM_METRIC_PREFIX = "ui_custom:";

export type UiCustomColumnRow = {
  id: string;
  name: string;
  formula_text: string | null;
  sort_order: number;
};

export type UiCustomColumnListItem = {
  key: string;
  label: string;
  description: string;
  column_id: string;
};

export function uiCustomMetricKey(columnId: string): string {
  const id = String(columnId ?? "").trim();
  if (!id) return "";
  return `${UI_CUSTOM_METRIC_PREFIX}${id}`;
}

export function parseUiCustomMetricKey(key: string): string | null {
  const raw = String(key ?? "").trim();
  if (!raw.startsWith(UI_CUSTOM_METRIC_PREFIX)) return null;
  const id = raw.slice(UI_CUSTOM_METRIC_PREFIX.length).trim();
  return /^[0-9a-f-]{36}$/i.test(id) ? id : null;
}

export function isUiCustomMetricKey(key: string): boolean {
  return parseUiCustomMetricKey(key) != null;
}

export function rowToUiCustomColumnListItem(row: UiCustomColumnRow): UiCustomColumnListItem {
  const key = uiCustomMetricKey(row.id);
  return {
    key,
    label: row.name,
    description: row.formula_text?.trim()
      ? `Formula: ${row.formula_text.trim()}`
      : "Custom column (formula) — nilai dihitung di Google Ads UI; belum dihitung di Synckerja",
    column_id: row.id,
  };
}

export function parseImportColumnNames(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    const text = String(raw ?? "").trim();
    if (!text) return [];
    return text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }
  const names: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const name = String(item ?? "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names;
}

const MAP: Record<string, string> = {
  id: "Indonesian",
  en: "English",
  en_US: "English (US)",
  en_GB: "English (UK)",
};

export function languageCodeToLabel(code: string): string {
  const c = code.trim();
  return (MAP[c] ?? MAP[c.replace(/-/g, "_")] ?? c) || "—";
}

/**
 * Short tag for template tables — derived only from Meta `language` (e.g. `id` → `ID`,
 * `en_US` → `EN-US`). No static map of codes; unknown values are normalized the same way.
 */
export function metaLanguageToShortTag(language: string | undefined | null): string {
  const raw = String(language ?? "").trim();
  if (!raw) return "—";
  return raw.replace(/_/g, "-").toUpperCase();
}

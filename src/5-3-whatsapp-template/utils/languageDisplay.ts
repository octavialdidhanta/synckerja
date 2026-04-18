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

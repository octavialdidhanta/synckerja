import type { AppLanguage } from "./translations";

/** Map i18next BCP-47 / resolved language to app locale */
export function resolveUiLanguage(lng: string | undefined): AppLanguage {
  const raw = (lng ?? "id").toLowerCase();
  if (raw.startsWith("en")) return "en";
  return "id";
}

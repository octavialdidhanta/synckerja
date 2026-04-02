import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { id as idLocale, enUS } from "date-fns/locale";
import { defaultTranslations, type AppLanguage } from "./translations";
import { resolveUiLanguage } from "./resolveUiLanguage";

function applyVariables(
  template: string,
  variables?: Record<string, string | number>,
): string {
  if (!variables) return template;
  return Object.entries(variables).reduce((acc, [key, value]) => {
    return acc.replace(new RegExp(`{{${key}}}`, "g"), String(value));
  }, template);
}

/**
 * App translation hook backed by i18next (JSON + merged flat strings from translations.ts).
 * Keeps the legacy `t(key, fallback?, variables?)` signature for existing call sites.
 */
export function useAppTranslation() {
  const { t: i18nT, i18n } = useTranslation();
  /** Always follow i18next (source of truth). LanguageProvider is optional; without it the old useLanguage() fallback stayed stale after changeLanguage. */
  const language = resolveUiLanguage(i18n.language) as AppLanguage;

  const t = useCallback(
    (key: string, fallback?: string, variables?: Record<string, string | number>) => {
      const lang = language;
      const dict = defaultTranslations[lang];
      const fallbackText =
        fallback ?? dict[key as keyof typeof dict] ?? defaultTranslations.en[key as keyof typeof defaultTranslations.en] ?? key;

      const translated = i18nT(key, { defaultValue: fallbackText });
      return applyVariables(translated, variables);
    },
    [language, i18nT],
  );

  const dateLocale = useMemo(() => (language === "id" ? "id-ID" : "en-US"), [language]);
  /** Use with `format` / `formatDistanceToNow` from date-fns — not the BCP-47 `dateLocale` string. */
  const dateFnsLocale = useMemo(() => (language === "id" ? idLocale : enUS), [language]);

  return { t, language, dateLocale, dateFnsLocale };
}

import type { AppLanguage, TranslationDictionary } from "./translationTypes";

export type { AppLanguage, TranslationDictionary } from "./translationTypes";
export {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  APP_LANGUAGE_DEVICE_OVERRIDE_KEY,
} from "./translationTypes";
const cache: Partial<Record<AppLanguage, TranslationDictionary>> = {};

export function getCachedTranslationDictionary(
  lang: AppLanguage,
): TranslationDictionary | undefined {
  return cache[lang];
}

/** Loads one language dictionary (code-split chunk). */
export async function loadTranslationDictionary(
  lang: AppLanguage,
): Promise<TranslationDictionary> {
  if (cache[lang]) return cache[lang]!;
  const mod =
    lang === "en"
      ? await import("./translations-en")
      : await import("./translations-id");
  const dict = lang === "en" ? mod.enTranslations : mod.idTranslations;
  cache[lang] = dict;
  return dict;
}

export const applyVariables = (
  value: string,
  variables?: Record<string, string | number>,
): string => {
  if (!variables) return value;
  return Object.entries(variables).reduce<string>(
    (acc, [placeholder, v]) => acc.replace(`{{${placeholder}}}`, String(v)),
    value,
  );
};

/** @deprecated Use loadTranslationDictionary — kept for rare sync call sites during migration */
export const defaultTranslations: Record<AppLanguage, TranslationDictionary> = new Proxy(
  {} as Record<AppLanguage, TranslationDictionary>,
  {
    get(_target, prop: string) {
      if (prop !== "id" && prop !== "en") return undefined;
      return cache[prop as AppLanguage];
    },
  },
);

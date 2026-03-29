import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import enJson from "../locales/en.json";
import idJson from "../locales/id.json";
import {
  defaultTranslations,
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  type AppLanguage,
} from "./translations";
import {
  cloneJsonResource,
  deepMerge,
  flatTranslationRecordToNested,
} from "./mergeResources";

export const supportedLanguages = ["en", "id"] as const;
export type SupportedLanguage = AppLanguage;

const LEGACY_STORAGE_KEY = "synckerja_language";

function resolveInitialLanguage(): SupportedLanguage {
  if (typeof window === "undefined") {
    return DEFAULT_LANGUAGE as SupportedLanguage;
  }
  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY) as SupportedLanguage | null;
  if (stored === "en" || stored === "id") {
    return stored;
  }
  const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY) as SupportedLanguage | null;
  if (legacy === "en" || legacy === "id") {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, legacy);
    return legacy;
  }
  const nav = navigator.language?.toLowerCase() ?? "id";
  if (nav.startsWith("en")) return "en";
  return "id";
}

const enNested = flatTranslationRecordToNested(defaultTranslations.en);
const idNested = flatTranslationRecordToNested(defaultTranslations.id);

const enMerged = deepMerge(
  cloneJsonResource(enJson) as Record<string, unknown>,
  enNested,
) as typeof enJson;

const idMerged = deepMerge(
  cloneJsonResource(idJson) as Record<string, unknown>,
  idNested,
) as typeof idJson;

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: enMerged },
    id: { translation: idMerged },
  },
  lng: resolveInitialLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: { escapeValue: false },
});

export function setAppLanguage(lng: SupportedLanguage) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, lng);
    document.documentElement.lang = lng;
  }
  void i18n.changeLanguage(lng);
}

export { LANGUAGE_STORAGE_KEY };
export default i18n;

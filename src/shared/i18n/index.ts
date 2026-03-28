import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "../locales/en.json";
import id from "../locales/id.json";

const STORAGE_KEY = "synckerja_language";

export const supportedLanguages = ["en", "id"] as const;
export type SupportedLanguage = (typeof supportedLanguages)[number];

function getInitialLanguage(): SupportedLanguage {
  if (typeof window === "undefined") return "id";
  const stored = localStorage.getItem(STORAGE_KEY) as SupportedLanguage | null;
  if (stored && supportedLanguages.includes(stored)) return stored;
  const nav = navigator.language?.toLowerCase() ?? "id";
  if (nav.startsWith("en")) return "en";
  return "id";
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    id: { translation: id },
  },
  lng: getInitialLanguage(),
  fallbackLng: "id",
  interpolation: { escapeValue: false },
});

export function setAppLanguage(lng: SupportedLanguage) {
  localStorage.setItem(STORAGE_KEY, lng);
  void i18n.changeLanguage(lng);
}

export { STORAGE_KEY as LANGUAGE_STORAGE_KEY };
export default i18n;

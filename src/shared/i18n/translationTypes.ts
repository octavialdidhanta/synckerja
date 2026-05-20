export type AppLanguage = "id" | "en";

export type TranslationDictionary = Record<string, string>;

export const DEFAULT_LANGUAGE: AppLanguage = "en";
export const LANGUAGE_STORAGE_KEY = "appLanguage";
export const APP_LANGUAGE_DEVICE_OVERRIDE_KEY = "appLanguageDeviceOverride";


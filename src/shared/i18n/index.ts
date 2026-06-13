import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import {
  APP_LANGUAGE_DEVICE_OVERRIDE_KEY,
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  loadTranslationDictionary,
  type AppLanguage,
} from "./translations";
import {
  cloneJsonResource,
  deepMerge,
  flatTranslationRecordToNested,
} from "./mergeResources";

export type SetAppLanguageOptions = {
  /** Prefer this locale on device; skip org `application_language` until user saves from Settings. */
  deviceOnly?: boolean;
  clearDeviceOverride?: boolean;
};

export type InitI18nOptions = {
  /** JSON-only boot for public auth routes — defers the large flat dictionary chunk until idle. */
  preferFastBoot?: boolean;
};

export const supportedLanguages = ["en", "id"] as const;
export type SupportedLanguage = AppLanguage;

const LEGACY_STORAGE_KEY = "synckerja_language";

const localeBundlesReady = new Set<AppLanguage>();

const PUBLIC_AUTH_PATH =
  /^\/(?:login|register|forgot-password|reset-password|verify-email|email-verified|terms-and-conditions)(?:\/|$)/;

function isPublicAuthRoute(): boolean {
  if (typeof window === "undefined") return false;
  return PUBLIC_AUTH_PATH.test(window.location.pathname);
}

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
  const nav = navigator.language?.toLowerCase() ?? "";
  if (nav.startsWith("en")) return "en";
  if (nav.startsWith("id")) return "id";
  return DEFAULT_LANGUAGE;
}

async function loadLocaleJson(lng: AppLanguage) {
  const mod =
    lng === "en"
      ? await import("../locales/en.json")
      : await import("../locales/id.json");
  return mod.default;
}

async function buildResourcesForLanguage(lng: AppLanguage) {
  const flat = await loadTranslationDictionary(lng);
  const nested = flatTranslationRecordToNested(flat);
  const json = await loadLocaleJson(lng);
  return deepMerge(cloneJsonResource(json) as Record<string, unknown>, nested) as typeof json;
}

function scheduleIdleTask(task: () => void, timeoutMs: number) {
  if (typeof window === "undefined") {
    task();
    return;
  }
  if ("requestIdleCallback" in window) {
    (
      window as Window & { requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => void }
    ).requestIdleCallback(task, { timeout: timeoutMs });
  } else {
    globalThis.setTimeout(task, Math.min(timeoutMs, 2500));
  }
}

/** Loads JSON + flat dictionary and registers a full translation bundle. */
export async function ensureLocaleBundleReady(lng: AppLanguage): Promise<void> {
  if (localeBundlesReady.has(lng)) return;

  const merged = await buildResourcesForLanguage(lng);
  i18n.addResourceBundle(lng, "translation", merged, true, true);
  localeBundlesReady.add(lng);
}

function scheduleSecondaryLocaleLoad(lng: AppLanguage) {
  scheduleIdleTask(() => {
    void ensureLocaleBundleReady(lng);
  }, 5000);
}

let initPromise: Promise<typeof i18n> | null = null;

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    initPromise = null;
    localeBundlesReady.clear();
  });
}

/**
 * Initializes i18n with the active locale first. The inactive locale (~300KB+ flat dict)
 * loads on idle so login/public routes avoid downloading unused translation JS.
 */
export function initI18n(options?: InitI18nOptions): Promise<typeof i18n> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const preferFastBoot = options?.preferFastBoot ?? true;
    const initialLng = resolveInitialLanguage();
    const otherLng: AppLanguage = initialLng === "en" ? "id" : "en";
    const jsonInitial = await loadLocaleJson(initialLng);

    if (!i18n.isInitialized) {
      await i18n.use(initReactI18next).init({
        resources: {
          [initialLng]: { translation: jsonInitial },
        },
        lng: initialLng,
        fallbackLng: DEFAULT_LANGUAGE,
        interpolation: { escapeValue: false },
      });
    }

    if (preferFastBoot) {
      scheduleIdleTask(() => {
        void ensureLocaleBundleReady(initialLng);
      }, 400);
    } else {
      await ensureLocaleBundleReady(initialLng);
    }

    await i18n.changeLanguage(initialLng);

    if (typeof document !== "undefined") {
      document.documentElement.lang = initialLng;
    }

    scheduleSecondaryLocaleLoad(otherLng);

    return i18n;
  })().catch((err) => {
    initPromise = null;
    console.error("[i18n] init failed:", err);
    throw err;
  });

  return initPromise;
}

export async function setAppLanguage(lng: AppLanguage, options?: SetAppLanguageOptions) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, lng);
    document.documentElement.lang = lng;
    if (options?.clearDeviceOverride) {
      window.localStorage.removeItem(APP_LANGUAGE_DEVICE_OVERRIDE_KEY);
    } else if (options?.deviceOnly) {
      window.localStorage.setItem(APP_LANGUAGE_DEVICE_OVERRIDE_KEY, "true");
    }
  }

  await ensureLocaleBundleReady(lng);
  await i18n.changeLanguage(lng);
}

export { LANGUAGE_STORAGE_KEY };
export default i18n;

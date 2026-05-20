import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useLocation } from "react-router-dom";
import { AppLanguage, APP_LANGUAGE_DEVICE_OVERRIDE_KEY, DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY } from "./translations";
import i18n, { setAppLanguage as applyAppLanguage } from "@/shared/i18n";
import { resolveUiLanguage } from "@/shared/i18n/resolveUiLanguage";
import { supabase } from "@/shared/lib/supabaseClient";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { logger } from "@/shared/lib/logger";

export interface SetLanguageOptions {
  deviceOnly?: boolean;
}

interface LanguageContextValue {
  language: AppLanguage;
  setLanguage: (language: AppLanguage, options?: SetLanguageOptions) => void;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

const PUBLIC_AUTH_PATH =
  /^\/(?:login|register|forgot-password|reset-password|verify-email|email-verified|terms-and-conditions)(?:\/|$)/;

const loadInitialLanguage = (): AppLanguage => {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE;
  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return stored === "en" || stored === "id" ? (stored as AppLanguage) : DEFAULT_LANGUAGE;
};

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const { pathname } = useLocation();
  const isPublicAuthRoute = PUBLIC_AUTH_PATH.test(pathname);
  const [language, setLanguageState] = useState<AppLanguage>(loadInitialLanguage);
  const { organizationId } = useCurrentOrg();
  const [isLoadingFromDb, setIsLoadingFromDb] = useState(true);

  // Load language from database when organizationId is available (skip if device override is set)
  useEffect(() => {
    const loadLanguageFromDatabase = async () => {
      if (isPublicAuthRoute) {
        setIsLoadingFromDb(false);
        return;
      }

      if (!organizationId) {
        setIsLoadingFromDb(false);
        return;
      }

      if (typeof window !== "undefined") {
        const deviceOverride = window.localStorage.getItem(APP_LANGUAGE_DEVICE_OVERRIDE_KEY);
        if (deviceOverride === "true") {
          setIsLoadingFromDb(false);
          return;
        }
      }

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profileRow } = await supabase
            .from("profiles")
            .select("preferred_locale")
            .eq("user_id", user.id)
            .maybeSingle();
          const personal = profileRow?.preferred_locale;
          if (personal === "en" || personal === "id") {
            setLanguageState(personal);
            void applyAppLanguage(personal);
            setIsLoadingFromDb(false);
            return;
          }

          // No `profiles.preferred_locale` — English baseline (matches Settings default)
          setLanguageState(DEFAULT_LANGUAGE);
          void applyAppLanguage(DEFAULT_LANGUAGE);
          setIsLoadingFromDb(false);
          return;
        }

        // Not signed in: keep localStorage / init default (English)
      } catch (error: any) {
        console.error('Error loading language from database:', error);
      } finally {
        setIsLoadingFromDb(false);
      }
    };

    loadLanguageFromDatabase();
  }, [organizationId, isPublicAuthRoute]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      document.documentElement.lang = language;
    }
  }, [language]);

  /** Keep i18next in sync with context — must load bundle before changeLanguage. */
  useEffect(() => {
    const resolved = resolveUiLanguage(i18n.resolvedLanguage);
    if (resolved !== language) {
      void applyAppLanguage(language);
    }
  }, [language]);

  useEffect(() => {
    const onChanged = (lng: string) => {
      const app: AppLanguage = lng.startsWith("en") ? "en" : "id";
      setLanguageState((prev) => (prev === app ? prev : app));
    };
    i18n.on("languageChanged", onChanged);
    return () => {
      i18n.off("languageChanged", onChanged);
    };
  }, []);

  const setLanguage = useCallback((nextLanguage: AppLanguage, options?: SetLanguageOptions) => {
    const deviceOnly = options?.deviceOnly === true;

    setLanguageState(nextLanguage);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
      document.documentElement.lang = nextLanguage;
      void applyAppLanguage(nextLanguage);
      if (deviceOnly) {
        window.localStorage.setItem(APP_LANGUAGE_DEVICE_OVERRIDE_KEY, "true");
      } else {
        window.localStorage.removeItem(APP_LANGUAGE_DEVICE_OVERRIDE_KEY);
      }
    }

    if (deviceOnly) {
      return;
    }

    // Save to database if organizationId is available
    if (organizationId && !isLoadingFromDb) {
      const saveLanguageToDatabase = async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) {
            console.warn('No authenticated user, language saved to localStorage only');
            return;
          }

          const isIndonesian = nextLanguage === 'id';

          const { error: langError } = await supabase
            .from('application_language')
            .upsert({
              organization_id: organizationId,
              is_indonesian: isIndonesian,
              created_by: user.id,
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'organization_id'
            });

          if (langError) {
            console.error('Failed to save language to database:', langError);
          } else {
            if (import.meta.env.DEV) {
              logger.debug('âœ… Language saved to database:', { organizationId, isIndonesian, language: nextLanguage });
            }
          }
        } catch (error: any) {
          console.error('Error saving language to database:', error);
        }
      };

      saveLanguageToDatabase();
    }
  }, [organizationId, isLoadingFromDb]);

  const value = useMemo(
    () => ({
      language,
      setLanguage,
    }),
    [language, setLanguage],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = (): LanguageContextValue => {
  const context = useContext(LanguageContext);
  // Always call useMemo so hook order is stable (Rules of Hooks). Never return before all hooks run.
  const fallback = useMemo<LanguageContextValue>(
    () => ({
      language: loadInitialLanguage(),
      setLanguage: () => {},
    }),
    []
  );
  return context ?? fallback;
};



















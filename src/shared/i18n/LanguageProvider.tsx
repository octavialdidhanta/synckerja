import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AppLanguage, APP_LANGUAGE_DEVICE_OVERRIDE_KEY, DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY } from "./translations";
import i18n from "@/shared/i18n";
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

const loadInitialLanguage = (): AppLanguage => {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE;
  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return stored === "en" || stored === "id" ? (stored as AppLanguage) : DEFAULT_LANGUAGE;
};

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<AppLanguage>(loadInitialLanguage);
  const { organizationId } = useCurrentOrg();
  const [isLoadingFromDb, setIsLoadingFromDb] = useState(true);

  // Load language from database when organizationId is available (skip if device override is set)
  useEffect(() => {
    const loadLanguageFromDatabase = async () => {
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
        const { data, error } = await supabase
          .from('application_language')
          .select('is_indonesian')
          .eq('organization_id', organizationId)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
          console.error('Failed to load language from database:', error);
          setIsLoadingFromDb(false);
          return;
        }

        if (data) {
          // Convert boolean to AppLanguage: true = "id", false = "en"
          const dbLanguage: AppLanguage = data.is_indonesian ? 'id' : 'en';
          
          setLanguageState(dbLanguage);
          if (typeof window !== "undefined") {
            window.localStorage.setItem(LANGUAGE_STORAGE_KEY, dbLanguage);
            document.documentElement.lang = dbLanguage;
            void i18n.changeLanguage(dbLanguage);
          }
          
          if (import.meta.env.DEV) {
            logger.debug('âœ… Loaded language from database:', { organizationId, isIndonesian: data.is_indonesian, language: dbLanguage });
          }
        }
      } catch (error: any) {
        console.error('Error loading language from database:', error);
      } finally {
        setIsLoadingFromDb(false);
      }
    };

    loadLanguageFromDatabase();
  }, [organizationId]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      document.documentElement.lang = language;
    }
  }, [language]);

  /** Keep i18next in sync with context (single pipeline: JSON + merged TS strings). */
  useEffect(() => {
    const resolved = i18n.resolvedLanguage?.startsWith("en") ? "en" : "id";
    if (resolved !== language) {
      void i18n.changeLanguage(language);
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
      void i18n.changeLanguage(nextLanguage);
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



















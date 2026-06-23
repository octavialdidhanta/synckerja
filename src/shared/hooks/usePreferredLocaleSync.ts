import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useCentralizedUserData } from "@/shared/auth/contexts/CentralizedUserDataContext";
import { setAppLanguage, supportedLanguages, type SupportedLanguage } from "@/shared/i18n";
import { resolveUiLanguage } from "@/shared/i18n/resolveUiLanguage";
import { APP_LANGUAGE_DEVICE_OVERRIDE_KEY } from "@/shared/i18n/translations";

export { resolveUiLanguage };

function normalizePreferredLocale(value: string | null | undefined): SupportedLanguage | null {
  if (value === "en" || value === "id") return value;
  return null;
}

/**
 * After login, align i18n with `profiles.preferred_locale` when set.
 * Reads from `CentralizedUserDataContext` when hydrated — no extra `profiles` fetch.
 */
export function usePreferredLocaleSync(userId: string | null | undefined) {
  const { i18n } = useTranslation();
  const { userData, centralProfileHydrated } = useCentralizedUserData();

  const fromCentral =
    userId &&
    centralProfileHydrated &&
    userData?.user_id === userId
      ? normalizePreferredLocale(userData.preferred_locale)
      : null;

  useEffect(() => {
    if (!userId) return;
    if (!centralProfileHydrated || userData?.user_id !== userId) return;
    if (typeof window !== "undefined" && window.localStorage.getItem(APP_LANGUAGE_DEVICE_OVERRIDE_KEY) === "true") {
      return;
    }
    if (!fromCentral) return;
    const current = resolveUiLanguage(i18n.language);
    if (fromCentral !== current) {
      setAppLanguage(fromCentral);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: only sync on centralized locale changes
  }, [userId, centralProfileHydrated, userData?.user_id, fromCentral]);
}

export function isSupportedLocale(v: string): v is SupportedLanguage {
  return (supportedLanguages as readonly string[]).includes(v);
}

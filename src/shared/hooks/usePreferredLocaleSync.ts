import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/shared/lib/supabaseClient";
import { setAppLanguage, supportedLanguages, type SupportedLanguage } from "@/shared/i18n";
import { resolveUiLanguage } from "@/shared/i18n/resolveUiLanguage";
import { APP_LANGUAGE_DEVICE_OVERRIDE_KEY } from "@/shared/i18n/translations";

export { resolveUiLanguage };

async function fetchPreferredLocale(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("preferred_locale")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  const v = data?.preferred_locale;
  if (v === "en" || v === "id") return v;
  return null;
}

/**
 * After login, align i18n with `profiles.preferred_locale` when set.
 * Does not overwrite when DB is null (localStorage / browser wins).
 */
export function usePreferredLocaleSync(userId: string | null | undefined) {
  const { i18n } = useTranslation();

  const query = useQuery({
    queryKey: ["profile-preferred-locale", userId],
    queryFn: () => fetchPreferredLocale(userId!),
    enabled: Boolean(userId),
    staleTime: 60_000,
  });

  /**
   * Sync DB → i18n only when the profile-locale query result changes (login, refetch after save).
   * Do NOT list `i18n` or `i18n.language` in deps: that re-ran after every `changeLanguage` and
   * reset the UI to `profiles.preferred_locale` while the user was previewing another language.
   */
  useEffect(() => {
    if (!userId || query.isLoading || query.isError) return;
    if (typeof window !== "undefined" && window.localStorage.getItem(APP_LANGUAGE_DEVICE_OVERRIDE_KEY) === "true") {
      return;
    }
    const fromDb = query.data;
    if (fromDb !== "en" && fromDb !== "id") return;
    const current = resolveUiLanguage(i18n.language);
    if (fromDb !== current) {
      setAppLanguage(fromDb);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: only sync on query.data / userId changes
  }, [userId, query.isLoading, query.isError, query.data]);
}

export function isSupportedLocale(v: string): v is SupportedLanguage {
  return (supportedLanguages as readonly string[]).includes(v);
}

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/shared/lib/supabaseClient";
import { setAppLanguage, supportedLanguages, type SupportedLanguage } from "@/shared/i18n";

export function resolveUiLanguage(lng: string | undefined): SupportedLanguage {
  const raw = (lng ?? "id").toLowerCase();
  if (raw.startsWith("en")) return "en";
  return "id";
}

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

  useEffect(() => {
    if (!userId || query.isLoading || query.isError) return;
    const fromDb = query.data;
    if (fromDb !== "en" && fromDb !== "id") return;
    const current = resolveUiLanguage(i18n.language);
    if (fromDb !== current) {
      setAppLanguage(fromDb);
    }
  }, [userId, query.isLoading, query.isError, query.data, i18n.language]);
}

export function isSupportedLocale(v: string): v is SupportedLanguage {
  return (supportedLanguages as readonly string[]).includes(v);
}

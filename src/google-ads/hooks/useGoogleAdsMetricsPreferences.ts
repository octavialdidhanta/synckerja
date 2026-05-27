import { useEffect, useMemo, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { DEFAULT_METRIC_KEYS, type GoogleAdsMetricEntity } from "@/google-ads/metrics/types";

function sanitizeKeys(raw: string[], validKeys: Set<string>): string[] {
  const filtered = raw.filter((k) => validKeys.has(k));
  if (filtered.length > 0) return filtered;
  return DEFAULT_METRIC_KEYS.filter((k) => validKeys.has(k));
}

export function useGoogleAdsMetricsPreferences(
  organizationId: string | null | undefined,
  entity: GoogleAdsMetricEntity,
  validKeys: Set<string> | null,
) {
  const queryClient = useQueryClient();
  const queryKey = ["google-ads-metrics-preferences", organizationId, entity];
  const sanitizedPersistedRef = useRef<string | null>(null);

  const catalogReady = validKeys != null && validKeys.size > 0;

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      if (!organizationId || !validKeys) {
        return sanitizeKeys([...DEFAULT_METRIC_KEYS], validKeys ?? new Set(DEFAULT_METRIC_KEYS));
      }
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes.user?.id;
      const fallback = sanitizeKeys([...DEFAULT_METRIC_KEYS], validKeys);
      if (!userId) return fallback;

      const { data, error } = await supabase
        .from("organization_google_ads_metrics_preferences")
        .select("selected_metrics")
        .eq("organization_id", organizationId)
        .eq("user_id", userId)
        .eq("entity", entity)
        .maybeSingle();

      if (error) {
        console.error("organization_google_ads_metrics_preferences:", error.message);
        return fallback;
      }

      const raw = data?.selected_metrics;
      if (!Array.isArray(raw) || raw.length === 0) return fallback;
      return sanitizeKeys(raw.map((k) => String(k)).filter(Boolean), validKeys);
    },
    enabled: Boolean(organizationId) && catalogReady,
    staleTime: 30_000,
  });

  const save = useMutation({
    mutationFn: async (selectedMetrics: string[]) => {
      if (!organizationId) throw new Error("No organization");
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes.user?.id;
      if (!userId) throw new Error("Not signed in");

      const sanitized = validKeys
        ? sanitizeKeys(selectedMetrics, validKeys)
        : selectedMetrics;

      const { error } = await supabase.from("organization_google_ads_metrics_preferences").upsert(
        {
          organization_id: organizationId,
          user_id: userId,
          entity,
          selected_metrics: sanitized,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "organization_id,user_id,entity" },
      );
      if (error) throw error;
      return sanitized;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const selectedMetrics = useMemo(
    () =>
      query.data ??
      sanitizeKeys([...DEFAULT_METRIC_KEYS], validKeys ?? new Set(DEFAULT_METRIC_KEYS)),
    [query.data, validKeys],
  );

  useEffect(() => {
    sanitizedPersistedRef.current = null;
  }, [entity, organizationId]);

  useEffect(() => {
    if (!organizationId || !validKeys || !query.isSuccess || !query.data) return;
    const dataKey = JSON.stringify(query.data);
    if (sanitizedPersistedRef.current === dataKey) return;

    let cancelled = false;
    void (async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes.user?.id;
      if (!userId || cancelled) return;

      const { data } = await supabase
        .from("organization_google_ads_metrics_preferences")
        .select("selected_metrics")
        .eq("organization_id", organizationId)
        .eq("user_id", userId)
        .eq("entity", entity)
        .maybeSingle();

      if (cancelled) return;
      const raw = data?.selected_metrics;
      if (!Array.isArray(raw)) {
        sanitizedPersistedRef.current = dataKey;
        return;
      }
      const stored = raw.map((k) => String(k)).filter(Boolean);
      const sanitized = sanitizeKeys(stored, validKeys);
      if (
        sanitized.length === stored.length &&
        sanitized.every((k, i) => k === stored[i])
      ) {
        sanitizedPersistedRef.current = dataKey;
        return;
      }

      const { error } = await supabase.from("organization_google_ads_metrics_preferences").upsert(
        {
          organization_id: organizationId,
          user_id: userId,
          entity,
          selected_metrics: sanitized,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "organization_id,user_id,entity" },
      );
      if (!error && !cancelled) {
        sanitizedPersistedRef.current = dataKey;
        queryClient.invalidateQueries({ queryKey });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [organizationId, entity, validKeys, query.isSuccess, query.data, queryClient, queryKey]);

  return {
    selectedMetrics,
    isPending: !catalogReady || query.isPending,
    save,
  };
}

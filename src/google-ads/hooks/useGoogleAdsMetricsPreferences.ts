import { useEffect, useMemo, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { defaultSelectedColumnKeys, stripGoogleAdsPinnedMetricKeys } from "@/google-ads/metrics/googleAdsIdentityColumns";
import {
  DEFAULT_METRIC_KEYS,
  type GoogleAdsMetricEntity,
  type GoogleAdsMetricsSort,
} from "@/google-ads/metrics/types";

const DEFAULT_SORT: GoogleAdsMetricsSort = { field: "spent", direction: "desc" };

function globalDefaultMetricsForEntity(
  entity: GoogleAdsMetricEntity,
  validKeys: Set<string>,
): string[] | null {
  // Global default preset: "Visibility Performance" for campaign entity.
  if (entity !== "campaign") return null;
  const keys = [
    "impressions",
    "top_impr_pct",
    "absolute_top_impr_pct",
    "search_top_is",
    "search_budget_lost_is",
    "search_lost_top_is_rank",
  ];
  const filtered = keys.filter((k) => validKeys.has(k));
  return filtered.length > 0 ? filtered : null;
}

function sanitizeKeys(raw: string[], validKeys: Set<string>): string[] {
  const filtered = stripGoogleAdsPinnedMetricKeys(raw).filter((k) => validKeys.has(k));
  if (filtered.length > 0) return filtered;
  return DEFAULT_METRIC_KEYS.filter((k) => validKeys.has(k));
}

function parseSortDirection(raw: unknown): "asc" | "desc" {
  return String(raw ?? "").toLowerCase() === "asc" ? "asc" : "desc";
}

type PreferencesRow = {
  selectedMetrics: string[];
  /** `direction` omitted when DB sort_direction is null — page applies per-column default. */
  sort: { field: string; direction?: "asc" | "desc" };
};

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
    queryFn: async (): Promise<PreferencesRow> => {
      const keySet = validKeys ?? new Set(DEFAULT_METRIC_KEYS);
      const fallbackMetrics =
        (validKeys ? globalDefaultMetricsForEntity(entity, validKeys) : null) ??
        defaultSelectedColumnKeys(entity, keySet);
      if (!organizationId || !validKeys) {
        return { selectedMetrics: fallbackMetrics, sort: DEFAULT_SORT };
      }
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes.user?.id;
      if (!userId) {
        return { selectedMetrics: fallbackMetrics, sort: DEFAULT_SORT };
      }

      const { data, error } = await supabase
        .from("organization_google_ads_metrics_preferences")
        .select("selected_metrics, sort_field, sort_direction")
        .eq("organization_id", organizationId)
        .eq("user_id", userId)
        .eq("entity", entity)
        .maybeSingle();

      if (error) {
        console.error("organization_google_ads_metrics_preferences:", error.message);
        return { selectedMetrics: fallbackMetrics, sort: DEFAULT_SORT };
      }

      const raw = data?.selected_metrics;
      const selectedMetrics =
        !Array.isArray(raw) || raw.length === 0
          ? fallbackMetrics
          : sanitizeKeys(raw.map((k) => String(k)).filter(Boolean), validKeys);

      const sortField = String(data?.sort_field ?? "").trim();
      const sortDirectionRaw = data?.sort_direction;
      const hasStoredDirection =
        sortDirectionRaw != null && String(sortDirectionRaw).trim() !== "";

      const sort: PreferencesRow["sort"] = hasStoredDirection
        ? {
            field: sortField || DEFAULT_SORT.field,
            direction: parseSortDirection(sortDirectionRaw),
          }
        : { field: sortField || DEFAULT_SORT.field };

      return { selectedMetrics, sort };
    },
    enabled: Boolean(organizationId) && catalogReady,
    staleTime: 30_000,
  });

  const upsertPreferences = async (
    selectedMetrics: string[],
    sort: GoogleAdsMetricsSort,
  ) => {
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
        sort_field: sort.field,
        sort_direction: sort.direction,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,user_id,entity" },
    );
    if (error) throw error;
    return { selectedMetrics: sanitized, sort };
  };

  const save = useMutation({
    mutationFn: async (
      input: string[] | { selectedMetrics: string[]; sort?: GoogleAdsMetricsSort },
    ) => {
      const selectedMetrics = Array.isArray(input) ? input : input.selectedMetrics;
      const sort = Array.isArray(input)
        ? (query.data?.sort ?? DEFAULT_SORT)
        : (input.sort ?? query.data?.sort ?? DEFAULT_SORT);
      return upsertPreferences(selectedMetrics, sort);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const saveSort = useMutation({
    mutationFn: async (sort: GoogleAdsMetricsSort) => {
      const metrics =
        query.data?.selectedMetrics ??
        defaultSelectedColumnKeys(entity, validKeys ?? new Set(DEFAULT_METRIC_KEYS));
      return upsertPreferences(metrics, sort);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const selectedMetrics = useMemo(
    () =>
      query.data?.selectedMetrics ??
        defaultSelectedColumnKeys(entity, validKeys ?? new Set(DEFAULT_METRIC_KEYS)),
    [query.data?.selectedMetrics, validKeys],
  );

  const storedSort = useMemo(
    () => query.data?.sort ?? DEFAULT_SORT,
    [query.data?.sort],
  );

  useEffect(() => {
    sanitizedPersistedRef.current = null;
  }, [entity, organizationId]);

  useEffect(() => {
    if (!organizationId || !validKeys || !query.isSuccess || !query.data) return;
    const dataKey = JSON.stringify(query.data.selectedMetrics);
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
          sort_field: query.data.sort.field,
          sort_direction: query.data.sort.direction,
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
    storedSort,
    isPending: !catalogReady || query.isPending,
    save,
    saveSort,
  };
}

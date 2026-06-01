import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import type { MetaAdsMetricEntity } from "@/meta-ads/hooks/useMetaAdsMetricsQuery";
import {
  META_ADS_DEFAULT_METRIC_KEYS,
  getMetaAdsCatalogMetricKeys,
} from "@/meta-ads/metrics/metaAdsMetricCatalog";
import type { MetaAdsMetricsSort } from "@/meta-ads/metrics/metaAdsSortColumns";

const DEFAULT_SORT: MetaAdsMetricsSort = { field: "spend", direction: "desc" };

function sanitizeKeys(raw: string[], validKeys: Set<string>): string[] {
  const filtered = raw.filter((k) => validKeys.has(k));
  if (filtered.length > 0) return filtered;
  return META_ADS_DEFAULT_METRIC_KEYS.filter((k) => validKeys.has(k));
}

export function formatMetaAdsSortKey(sort: MetaAdsMetricsSort): string {
  const field = sort.field.trim() || DEFAULT_SORT.field;
  const direction = sort.direction === "asc" ? "asc" : "desc";
  return `${field}:${direction}`;
}

export function parseMetaAdsSortKey(raw: string | null | undefined): MetaAdsMetricsSort {
  const s = String(raw ?? "").trim();
  const [field, direction] = s.split(":");
  if (!field) return DEFAULT_SORT;
  return {
    field,
    direction: direction === "asc" ? "asc" : "desc",
  };
}

type PreferencesRow = {
  visibleColumns: string[];
  sort: MetaAdsMetricsSort;
};

export function useMetaAdsMetricsPreferences(
  organizationId: string | null | undefined,
  entity: MetaAdsMetricEntity,
  validKeys: Set<string> | null = null,
) {
  const queryClient = useQueryClient();
  const queryKey = ["meta-ads-metrics-preferences", organizationId, entity];
  const catalogKeys = validKeys ?? getMetaAdsCatalogMetricKeys();
  const keysReady = catalogKeys.size > 0;

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<PreferencesRow> => {
      const fallback = sanitizeKeys([...META_ADS_DEFAULT_METRIC_KEYS], catalogKeys);
      if (!organizationId) {
        return { visibleColumns: fallback, sort: DEFAULT_SORT };
      }
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes.user?.id;
      if (!userId) {
        return { visibleColumns: fallback, sort: DEFAULT_SORT };
      }

      const { data, error } = await supabase
        .from("organization_meta_ads_metrics_preferences")
        .select("visible_columns, sort_key")
        .eq("organization_id", organizationId)
        .eq("user_id", userId)
        .eq("entity", entity)
        .maybeSingle();

      if (error) {
        console.error("organization_meta_ads_metrics_preferences:", error.message);
        return { visibleColumns: fallback, sort: DEFAULT_SORT };
      }

      const rawCols = data?.visible_columns;
      const visibleColumns =
        !Array.isArray(rawCols) || rawCols.length === 0
          ? fallback
          : sanitizeKeys(rawCols.map((k) => String(k)).filter(Boolean), catalogKeys);

      const sort = parseMetaAdsSortKey(data?.sort_key);

      return { visibleColumns, sort };
    },
    enabled: Boolean(organizationId) && keysReady,
    staleTime: 30_000,
  });

  const upsertPreferences = async (visibleColumns: string[], sort: MetaAdsMetricsSort) => {
    if (!organizationId) throw new Error("No organization");
    const { data: userRes } = await supabase.auth.getUser();
    const userId = userRes.user?.id;
    if (!userId) throw new Error("Not signed in");

    const sanitized = sanitizeKeys(visibleColumns, catalogKeys);
    const sortKey = formatMetaAdsSortKey(sort);

    const { error } = await supabase.from("organization_meta_ads_metrics_preferences").upsert(
      {
        organization_id: organizationId,
        user_id: userId,
        entity,
        visible_columns: sanitized,
        sort_key: sortKey,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,user_id,entity" },
    );
    if (error) throw error;
    return { visibleColumns: sanitized, sort };
  };

  const save = useMutation({
    mutationFn: async (
      input: string[] | { visibleColumns: string[]; sort?: MetaAdsMetricsSort },
    ) => {
      const visibleColumns = Array.isArray(input) ? input : input.visibleColumns;
      const sort = Array.isArray(input)
        ? (query.data?.sort ?? DEFAULT_SORT)
        : (input.sort ?? query.data?.sort ?? DEFAULT_SORT);
      return upsertPreferences(visibleColumns, sort);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const saveSort = useMutation({
    mutationFn: async (sort: MetaAdsMetricsSort) => {
      const cols =
        query.data?.visibleColumns ??
        sanitizeKeys([...META_ADS_DEFAULT_METRIC_KEYS], catalogKeys);
      return upsertPreferences(cols, sort);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const visibleColumns = useMemo(
    () =>
      query.data?.visibleColumns ??
      sanitizeKeys([...META_ADS_DEFAULT_METRIC_KEYS], catalogKeys),
    [query.data?.visibleColumns, catalogKeys],
  );

  const storedSort = useMemo(() => query.data?.sort ?? DEFAULT_SORT, [query.data?.sort]);

  return {
    visibleColumns,
    storedSort,
    isPending: !keysReady || query.isPending,
    save,
    saveSort,
  };
}

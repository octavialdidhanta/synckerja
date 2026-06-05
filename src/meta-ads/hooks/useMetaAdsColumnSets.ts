import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import type { MetaAdsMetricEntity } from "@/meta-ads/hooks/useMetaAdsMetricsQuery";

export type MetaAdsColumnSet = {
  id: string;
  name: string;
  metric_keys: string[];
  scope: "global" | "org";
  created_at?: string;
  updated_at?: string;
};

function mapColumnSetRow(row: {
  id: string;
  name: string;
  metric_keys: unknown;
  created_at?: string;
  updated_at?: string;
} & { scope: MetaAdsColumnSet["scope"] }): MetaAdsColumnSet {
  return {
    id: String(row.id),
    name: String(row.name),
    metric_keys: Array.isArray(row.metric_keys)
      ? (row.metric_keys as unknown[]).map((k) => String(k)).filter(Boolean)
      : [],
    scope: row.scope,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function useMetaAdsColumnSets(
  organizationId: string | null | undefined,
  entity: MetaAdsMetricEntity,
  enabled: boolean,
) {
  const queryClient = useQueryClient();
  const queryKey = ["meta-ads-column-sets", "v1", organizationId, entity];

  const listQuery = useQuery({
    queryKey,
    queryFn: async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes.user?.id;

      const globalRes = await supabase
        .from("meta_ads_global_column_sets")
        .select("id, name, metric_keys, created_at, updated_at")
        .eq("entity", entity)
        .order("name", { ascending: true });

      const globalSets = globalRes.error
        ? ([] as MetaAdsColumnSet[])
        : (globalRes.data ?? []).map((row) => mapColumnSetRow({ ...row, scope: "global" }));

      if (!organizationId || !userId) return globalSets;

      const orgRes = await supabase
        .from("organization_meta_ads_column_sets")
        .select("id, name, metric_keys, created_at, updated_at")
        .eq("organization_id", organizationId)
        .eq("user_id", userId)
        .eq("entity", entity)
        .order("name", { ascending: true });

      const orgSets = orgRes.error
        ? ([] as MetaAdsColumnSet[])
        : (orgRes.data ?? []).map((row) => mapColumnSetRow({ ...row, scope: "org" }));

      return [...globalSets, ...orgSets];
    },
    enabled,
    staleTime: 60_000,
  });

  const save = useMutation({
    mutationFn: async (input: { name: string; metric_keys: string[] }) => {
      if (!organizationId) throw new Error("No organization");
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes.user?.id;
      if (!userId) throw new Error("Not signed in");

      const { data, error } = await supabase
        .from("organization_meta_ads_column_sets")
        .upsert(
          {
            organization_id: organizationId,
            user_id: userId,
            entity,
            name: input.name.trim(),
            metric_keys: input.metric_keys,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "organization_id,user_id,entity,name" },
        )
        .select("id, name, metric_keys, created_at, updated_at")
        .single();

      if (error) throw error;
      return mapColumnSetRow({ ...data, scope: "org" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const remove = useMutation({
    mutationFn: async (input: { id: string; scope?: MetaAdsColumnSet["scope"] }) => {
      if (input.scope === "global") return;
      if (!organizationId) throw new Error("No organization");
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes.user?.id;
      if (!userId) throw new Error("Not signed in");

      const { error } = await supabase
        .from("organization_meta_ads_column_sets")
        .delete()
        .eq("organization_id", organizationId)
        .eq("user_id", userId)
        .eq("entity", entity)
        .eq("id", input.id);

      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return {
    columnSets: listQuery.data ?? [],
    isLoading: listQuery.isPending,
    isError: listQuery.isError,
    save,
    remove,
  };
}

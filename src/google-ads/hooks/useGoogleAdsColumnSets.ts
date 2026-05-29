import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { parseEdgeFunctionError } from "@/google-ads/lib/parseEdgeFunctionError";
import type { GoogleAdsMetricEntity } from "@/google-ads/metrics/types";

export type GoogleAdsColumnSet = {
  id: string;
  name: string;
  metric_keys: string[];
  created_at?: string;
  updated_at?: string;
};

type ListResponse = { column_sets: GoogleAdsColumnSet[] };
type SaveResponse = { column_set: GoogleAdsColumnSet };

async function invokeColumnSets(
  organizationId: string,
  body: Record<string, unknown>,
): Promise<ListResponse | SaveResponse | { ok: boolean }> {
  const { data, error } = await supabase.functions.invoke("google-ads-metrics", {
    body: { organization_id: organizationId, ...body },
  });
  if (error) throw await parseEdgeFunctionError(error, data);
  const payload = data as { error?: string };
  if (payload?.error) throw await parseEdgeFunctionError(null, payload);
  return data as ListResponse | SaveResponse | { ok: boolean };
}

export function useGoogleAdsColumnSets(
  organizationId: string | null | undefined,
  entity: GoogleAdsMetricEntity,
  enabled: boolean,
) {
  const queryClient = useQueryClient();
  const queryKey = ["google-ads-column-sets", organizationId, entity];

  const listQuery = useQuery({
    queryKey,
    queryFn: async () => {
      if (!organizationId) return [] as GoogleAdsColumnSet[];
      const res = (await invokeColumnSets(organizationId, {
        action: "listColumnSets",
        entity,
      })) as ListResponse;
      return res.column_sets ?? [];
    },
    enabled: Boolean(organizationId) && enabled,
    staleTime: 60_000,
  });

  const save = useMutation({
    mutationFn: async (input: { name: string; metric_keys: string[] }) => {
      if (!organizationId) throw new Error("No organization");
      const res = (await invokeColumnSets(organizationId, {
        action: "saveColumnSet",
        entity,
        name: input.name,
        metric_keys: input.metric_keys,
      })) as SaveResponse;
      return res.column_set;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const remove = useMutation({
    mutationFn: async (input: { id: string } | { name: string }) => {
      if (!organizationId) throw new Error("No organization");
      await invokeColumnSets(organizationId, {
        action: "deleteColumnSet",
        entity,
        ...input,
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return {
    columnSets: listQuery.data ?? [],
    isLoading: listQuery.isPending,
    save,
    remove,
  };
}

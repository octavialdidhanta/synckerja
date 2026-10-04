import { useMutation, useQueryClient } from "@tanstack/react-query";
import { parseEdgeFunctionError } from "@/meta-ads/lib/parseEdgeFunctionError";
import type { MetaAdsMetricsResponse } from "@/meta-ads/hooks/useMetaAdsMetricsQuery";
import { supabase } from "@/shared/lib/supabaseClient";

export type MetaAdConfiguredStatus = "ACTIVE" | "PAUSED";

function applyAdStatus(current: unknown, adId: string, status: MetaAdConfiguredStatus): unknown {
  if (!current || typeof current !== "object" || !("rows" in current)) return current;
  const response = current as MetaAdsMetricsResponse;
  if (!Array.isArray(response.rows)) return current;
  return {
    ...response,
    rows: response.rows.map((row) => {
      if (String(row.ad_id ?? "").trim() !== adId) return row;
      return {
        ...row,
        configured_status: status,
        delivery: status === "ACTIVE" ? "Active" : "Off",
      };
    }),
  };
}

export function useSetMetaAdStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      organizationId: string;
      adAccountId: string;
      adId: string;
      status: MetaAdConfiguredStatus;
    }) => {
      const { data, error } = await supabase.functions.invoke("meta-ads-metrics", {
        body: {
          action: "setAdStatus",
          organization_id: args.organizationId,
          ad_account_id: args.adAccountId,
          ad_id: args.adId,
          status: args.status,
        },
      });
      if (error) throw await parseEdgeFunctionError(error, data);
      const payload = data as { error?: string; status?: string };
      if (payload?.error) throw await parseEdgeFunctionError(null, payload);
      return payload;
    },
    onMutate: async (args) => {
      const queryKey = ["meta-ads-metrics", args.organizationId, args.adAccountId, "ad"] as const;
      await queryClient.cancelQueries({ queryKey });
      const snapshots = queryClient.getQueriesData({ queryKey });
      queryClient.setQueriesData({ queryKey }, (current) => applyAdStatus(current, args.adId, args.status));
      return { snapshots };
    },
    onError: (_error, _args, context) => {
      for (const [key, data] of context?.snapshots ?? []) {
        queryClient.setQueryData(key, data);
      }
    },
  });
}

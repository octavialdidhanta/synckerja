import { useQuery } from "@tanstack/react-query";
import { parseEdgeFunctionError } from "@/meta-ads/lib/parseEdgeFunctionError";
import { supabase } from "@/shared/lib/supabaseClient";

export type MetaAdsetAudiencePayload = {
  adset_id: string;
  name: string;
  targeting: Record<string, unknown> | null;
  sentence_lines: Array<{ content?: string; children?: string[] }>;
};

export function useMetaAdsAdsetAudience(args: {
  enabled: boolean;
  organizationId: string | null | undefined;
  adAccountId: string | null | undefined;
  adsetId: string | null | undefined;
}) {
  const { enabled, organizationId, adAccountId, adsetId } = args;
  const id = String(adsetId ?? "").trim();

  return useQuery({
    queryKey: ["meta-ads-adset-audience-v1", organizationId, adAccountId, id],
    queryFn: async (): Promise<MetaAdsetAudiencePayload> => {
      const { data, error } = await supabase.functions.invoke("meta-ads-metrics", {
        body: {
          action: "fetchAdsetAudience",
          organization_id: organizationId,
          ad_account_id: adAccountId,
          adset_id: id,
        },
      });
      if (error) throw await parseEdgeFunctionError(error, data);
      const payload = data as MetaAdsetAudiencePayload & { error?: string };
      if (payload?.error) throw await parseEdgeFunctionError(null, payload);
      return payload;
    },
    enabled: Boolean(enabled && organizationId && adAccountId && /^\d+$/.test(id)),
    staleTime: 10 * 60 * 1000,
  });
}

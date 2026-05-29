import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { parseEdgeFunctionError } from "@/google-ads/lib/parseEdgeFunctionError";
import type {
  GoogleAdsMetricEntity,
  GoogleAdsUiCustomColumnItem,
  GoogleAdsUiCustomColumnsResponse,
} from "@/google-ads/metrics/types";

async function invokeUiCustomColumns(
  organizationId: string,
  body: Record<string, unknown>,
): Promise<GoogleAdsUiCustomColumnsResponse> {
  const { data, error } = await supabase.functions.invoke("google-ads-metrics", {
    body: { organization_id: organizationId, ...body },
  });
  if (error) throw await parseEdgeFunctionError(error, data);
  const payload = data as GoogleAdsUiCustomColumnsResponse & { error?: string };
  if (payload?.error) throw await parseEdgeFunctionError(null, payload);
  return { custom_columns: payload.custom_columns ?? [] };
}

export function useGoogleAdsUiCustomColumns(
  organizationId: string | null | undefined,
  customerId: string | null | undefined,
  entity: GoogleAdsMetricEntity,
  enabled: boolean,
) {
  const queryKey = ["google-ads-ui-custom-columns", organizationId, customerId, entity];
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey,
    queryFn: async () => {
      if (!organizationId || !customerId) {
        return { custom_columns: [] } satisfies GoogleAdsUiCustomColumnsResponse;
      }
      return invokeUiCustomColumns(organizationId, {
        action: "listUiCustomColumns",
        customer_id: customerId,
        entity,
      });
    },
    enabled: Boolean(organizationId && customerId) && enabled,
    staleTime: 30_000,
  });

  const importColumns = useMutation({
    mutationFn: async (input: { names: string[]; replaceAll?: boolean }) => {
      if (!organizationId || !customerId) throw new Error("Missing organization or customer");
      return invokeUiCustomColumns(organizationId, {
        action: "importUiCustomColumns",
        customer_id: customerId,
        entity,
        names: input.names,
        replace_all: input.replaceAll === true,
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const removeColumn = useMutation({
    mutationFn: async (columnId: string) => {
      if (!organizationId) throw new Error("No organization");
      await invokeUiCustomColumns(organizationId, {
        action: "deleteUiCustomColumn",
        id: columnId,
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return {
    customColumns: listQuery.data?.custom_columns ?? ([] as GoogleAdsUiCustomColumnItem[]),
    isLoading: listQuery.isPending,
    isImporting: importColumns.isPending,
    importColumns,
    removeColumn,
    refetch: listQuery.refetch,
  };
}

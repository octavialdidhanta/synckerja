import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import {
  DEFAULT_POS_OUTLET_STOCK_SETTINGS,
  type PosOutletStockSettings,
} from "../types/sessionStockCommit";
import type { StockCommitPoint } from "../types/stockCommitPoint";
import {
  fetchPosOutletStockSettings,
  upsertPosOutletStockSettings,
} from "../lib/resolveStockCommitPolicy";

export const POS_OUTLET_STOCK_SETTINGS_QUERY_KEY = "pos-outlet-stock-settings";

export function usePosOutletStockSettings(outletId: string | null | undefined) {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [POS_OUTLET_STOCK_SETTINGS_QUERY_KEY, organizationId, outletId],
    queryFn: async (): Promise<PosOutletStockSettings> => {
      if (!organizationId || !outletId) {
        return {
          outlet_id: outletId ?? "",
          organization_id: organizationId ?? "",
          ...DEFAULT_POS_OUTLET_STOCK_SETTINGS,
        };
      }
      return fetchPosOutletStockSettings({ organizationId, outletId });
    },
    enabled: Boolean(organizationId && outletId),
  });

  const save = useMutation({
    mutationFn: async (stockCommitPoint: StockCommitPoint) => {
      if (!organizationId || !outletId) {
        throw new Error("Organization and outlet are required");
      }
      await upsertPosOutletStockSettings({
        organizationId,
        outletId,
        stockCommitPoint,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [POS_OUTLET_STOCK_SETTINGS_QUERY_KEY, organizationId, outletId],
      });
    },
  });

  return {
    settings: query.data,
    stockCommitPoint: query.data?.stock_commit_point ?? DEFAULT_POS_OUTLET_STOCK_SETTINGS.stock_commit_point,
    isLoading: query.isLoading,
    save,
  };
}

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";
import { buildItemSalesHourlyDisplay } from "../lib/computeItemSalesDisplay";
import {
  EMPTY_ITEM_SALES_HOURLY_DISPLAY,
  type ItemSalesHourlyDisplay,
} from "../lib/itemSalesTypes";

export type UseItemSalesHourlyArgs = {
  outletId: string | null;
  fromIso: string;
  toIso: string;
  enabled?: boolean;
};

export function useItemSalesHourly(args: UseItemSalesHourlyArgs) {
  const { organizationId, loading: orgLoading } = useCurrentOrg();
  const enabled = Boolean(args.enabled !== false && organizationId && args.fromIso && args.toIso);

  const reportQuery = useQuery({
    queryKey: ["pos-item-sales-hourly", organizationId, args.outletId, args.fromIso, args.toIso],
    enabled: enabled && !orgLoading,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("pos_item_sales_hourly", {
        p_organization_id: organizationId!,
        p_outlet_id: args.outletId,
        p_from: args.fromIso,
        p_to: args.toIso,
      });
      if (error) throw error;
      return Array.isArray(data) ? data : data ? [data] : [];
    },
  });

  const display: ItemSalesHourlyDisplay = useMemo(() => {
    if (!reportQuery.data) return EMPTY_ITEM_SALES_HOURLY_DISPLAY;
    return buildItemSalesHourlyDisplay(
      reportQuery.data as Array<Partial<Record<string, unknown>>>,
    );
  }, [reportQuery.data]);

  const isLoading =
    orgLoading || (enabled && reportQuery.isLoading && !reportQuery.data);

  return {
    display,
    isLoading,
    isFetching: reportQuery.isFetching,
    isError: reportQuery.isError,
    error: reportQuery.error,
    refetch: reportQuery.refetch,
  };
}

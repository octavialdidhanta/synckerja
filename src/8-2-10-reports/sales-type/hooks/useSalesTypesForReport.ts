import { useQuery } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";
import {
  filterSalesTypesForOutlet,
  normalizeSalesTypeConfig,
} from "../lib/computeSalesTypeDisplay";
import type { SalesTypeConfig } from "../lib/salesTypeTypes";

export type UseSalesTypesForReportArgs = {
  outletId?: string | null;
  enabled?: boolean;
};

type SalesTypeRowDb = {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  catalog_sales_type_outlets?: Array<{ outlet_id: string }> | null;
};

export function useSalesTypesForReport(args: UseSalesTypesForReportArgs = {}) {
  const { organizationId, loading: orgLoading } = useCurrentOrg();
  const enabled = Boolean(args.enabled !== false && organizationId);

  const query = useQuery({
    queryKey: ["catalog-sales-types-report", organizationId, args.outletId ?? null],
    enabled: enabled && !orgLoading,
    queryFn: async (): Promise<SalesTypeConfig[]> => {
      const { data, error } = await supabase
        .from("catalog_sales_types")
        .select(
          "id, name, sort_order, is_active, catalog_sales_type_outlets(outlet_id)",
        )
        .eq("organization_id", organizationId!)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;

      const configs = ((data ?? []) as SalesTypeRowDb[]).map((row) =>
        normalizeSalesTypeConfig({
          id: row.id,
          name: row.name,
          sort_order: row.sort_order,
          is_active: row.is_active,
          outlet_ids: (row.catalog_sales_type_outlets ?? []).map((l) => l.outlet_id),
        }),
      );

      return filterSalesTypesForOutlet(configs, args.outletId ?? null);
    },
  });

  return {
    salesTypes: query.data ?? [],
    isLoading: orgLoading || (enabled && query.isLoading),
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

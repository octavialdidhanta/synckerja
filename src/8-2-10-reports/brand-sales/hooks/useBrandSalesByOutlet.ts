import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { supabase } from "@/shared/lib/supabaseClient";
import { normalizeBrandSalesOutletRow } from "../lib/computeBrandSalesDisplay";
import type { BrandSalesOutletRow } from "../lib/brandSalesTypes";

export type UseBrandSalesByOutletArgs = {
  fromIso: string;
  toIso: string;
  enabled?: boolean;
};

export function useBrandSalesByOutlet(args: UseBrandSalesByOutletArgs) {
  const { t } = useAppTranslation();
  const { organizationId, loading: orgLoading } = useCurrentOrg();
  const enabled = Boolean(args.enabled !== false && organizationId && args.fromIso && args.toIso);

  const query = useQuery({
    queryKey: ["pos-brand-sales-by-outlet", organizationId, args.fromIso, args.toIso],
    enabled: enabled && !orgLoading,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("pos_brand_sales_by_outlet", {
        p_organization_id: organizationId!,
        p_from: args.fromIso,
        p_to: args.toIso,
      });
      if (error) throw error;
      return Array.isArray(data) ? data : data ? [data] : [];
    },
  });

  const unbrandedLabel = t("reports.brandSales.unbranded", "Unbranded");

  const rows: BrandSalesOutletRow[] = useMemo(() => {
    if (!query.data) return [];
    return (query.data as Array<Partial<Record<string, unknown>>>).map((row) =>
      normalizeBrandSalesOutletRow(row, unbrandedLabel),
    );
  }, [query.data, unbrandedLabel]);

  return {
    rows,
    isLoading: orgLoading || (enabled && query.isLoading && !query.data),
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

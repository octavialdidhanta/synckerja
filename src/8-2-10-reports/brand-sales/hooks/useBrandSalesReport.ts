import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { supabase } from "@/shared/lib/supabaseClient";
import { buildBrandSalesDisplay } from "../lib/computeBrandSalesDisplay";
import { EMPTY_BRAND_SALES_DISPLAY, type BrandSalesDisplay } from "../lib/brandSalesTypes";

export type UseBrandSalesReportArgs = {
  outletId: string | null;
  fromIso: string;
  toIso: string;
  enabled?: boolean;
};

export function useBrandSalesReport(args: UseBrandSalesReportArgs) {
  const { t } = useAppTranslation();
  const { organizationId, loading: orgLoading } = useCurrentOrg();
  const enabled = Boolean(args.enabled !== false && organizationId && args.fromIso && args.toIso);

  const brandQuery = useQuery({
    queryKey: [
      "pos-brand-sales-report",
      organizationId,
      args.outletId,
      args.fromIso,
      args.toIso,
    ],
    enabled: enabled && !orgLoading,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("pos_brand_sales_report", {
        p_organization_id: organizationId!,
        p_outlet_id: args.outletId,
        p_from: args.fromIso,
        p_to: args.toIso,
      });
      if (error) throw error;
      return Array.isArray(data) ? data : data ? [data] : [];
    },
  });

  const itemQuery = useQuery({
    queryKey: [
      "pos-brand-sales-by-item",
      organizationId,
      args.outletId,
      args.fromIso,
      args.toIso,
    ],
    enabled: enabled && !orgLoading,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("pos_brand_sales_by_item", {
        p_organization_id: organizationId!,
        p_outlet_id: args.outletId,
        p_from: args.fromIso,
        p_to: args.toIso,
      });
      if (error) throw error;
      return Array.isArray(data) ? data : data ? [data] : [];
    },
  });

  const unbrandedLabel = t("reports.brandSales.unbranded", "Unbranded");

  const display: BrandSalesDisplay = useMemo(() => {
    if (!brandQuery.data && !itemQuery.data) return EMPTY_BRAND_SALES_DISPLAY;
    return buildBrandSalesDisplay({
      brandRowsRaw: brandQuery.data as Array<Partial<Record<string, unknown>>>,
      itemRowsRaw: itemQuery.data as Array<Partial<Record<string, unknown>>>,
      unbrandedLabel,
    });
  }, [brandQuery.data, itemQuery.data, unbrandedLabel]);

  const isLoading =
    orgLoading ||
    (enabled &&
      ((brandQuery.isLoading && !brandQuery.data) || (itemQuery.isLoading && !itemQuery.data)));

  return {
    display,
    isLoading,
    isFetching: brandQuery.isFetching || itemQuery.isFetching,
    isError: brandQuery.isError || itemQuery.isError,
    error: brandQuery.error ?? itemQuery.error,
    refetch: async () => {
      await Promise.all([brandQuery.refetch(), itemQuery.refetch()]);
    },
  };
}

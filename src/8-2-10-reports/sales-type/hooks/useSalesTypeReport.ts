import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { supabase } from "@/shared/lib/supabaseClient";
import { mergeSalesTypeReport } from "../lib/computeSalesTypeDisplay";
import { EMPTY_SALES_TYPE_DISPLAY, type SalesTypeDisplay } from "../lib/salesTypeTypes";
import { useSalesTypesForReport } from "./useSalesTypesForReport";

export type UseSalesTypeReportArgs = {
  outletId: string | null;
  fromIso: string;
  toIso: string;
  enabled?: boolean;
};

export function useSalesTypeReport(args: UseSalesTypeReportArgs) {
  const { t } = useAppTranslation();
  const { organizationId, loading: orgLoading } = useCurrentOrg();
  const enabled = Boolean(args.enabled !== false && organizationId && args.fromIso && args.toIso);

  const typesQuery = useSalesTypesForReport({
    outletId: args.outletId,
    enabled,
  });

  const reportQuery = useQuery({
    queryKey: ["pos-sales-type-report", organizationId, args.outletId, args.fromIso, args.toIso],
    enabled: enabled && !orgLoading && !typesQuery.isLoading,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("pos_sales_type_report", {
        p_organization_id: organizationId!,
        p_outlet_id: args.outletId,
        p_from: args.fromIso,
        p_to: args.toIso,
      });
      if (error) throw error;
      return Array.isArray(data) ? data : data ? [data] : [];
    },
  });

  const unassignedLabel = t("reports.salesType.unassigned", "Unassigned");

  const display: SalesTypeDisplay = useMemo(() => {
    if (!reportQuery.data) return EMPTY_SALES_TYPE_DISPLAY;
    return mergeSalesTypeReport(
      typesQuery.salesTypes,
      reportQuery.data as Array<Partial<Record<string, unknown>>>,
      unassignedLabel,
    );
  }, [reportQuery.data, typesQuery.salesTypes, unassignedLabel]);

  const isLoading =
    orgLoading ||
    typesQuery.isLoading ||
    (enabled && reportQuery.isLoading && !reportQuery.data);

  return {
    display,
    isLoading,
    isFetching: reportQuery.isFetching,
    isError: reportQuery.isError || typesQuery.isError,
    error: reportQuery.error ?? typesQuery.error,
    refetch: reportQuery.refetch,
  };
}

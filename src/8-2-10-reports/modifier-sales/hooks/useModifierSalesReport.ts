import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { supabase } from "@/shared/lib/supabaseClient";
import { buildModifierSalesDisplay } from "../lib/computeModifierSalesDisplay";
import { EMPTY_MODIFIER_SALES_DISPLAY, type ModifierSalesDisplay } from "../lib/modifierSalesTypes";

export type UseModifierSalesReportArgs = {
  outletId: string | null;
  fromIso: string;
  toIso: string;
  enabled?: boolean;
};

export function useModifierSalesReport(args: UseModifierSalesReportArgs) {
  const { t } = useAppTranslation();
  const { organizationId, loading: orgLoading } = useCurrentOrg();
  const enabled = Boolean(args.enabled !== false && organizationId && args.fromIso && args.toIso);

  const groupQuery = useQuery({
    queryKey: [
      "pos-modifier-sales-report",
      organizationId,
      args.outletId,
      args.fromIso,
      args.toIso,
    ],
    enabled: enabled && !orgLoading,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("pos_modifier_sales_report", {
        p_organization_id: organizationId!,
        p_outlet_id: args.outletId,
        p_from: args.fromIso,
        p_to: args.toIso,
      });
      if (error) throw error;
      return Array.isArray(data) ? data : data ? [data] : [];
    },
  });

  const optionQuery = useQuery({
    queryKey: [
      "pos-modifier-sales-by-option",
      organizationId,
      args.outletId,
      args.fromIso,
      args.toIso,
    ],
    enabled: enabled && !orgLoading,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("pos_modifier_sales_by_option", {
        p_organization_id: organizationId!,
        p_outlet_id: args.outletId,
        p_from: args.fromIso,
        p_to: args.toIso,
      });
      if (error) throw error;
      return Array.isArray(data) ? data : data ? [data] : [];
    },
  });

  const unknownGroupLabel = t("reports.modifierSales.unknownGroup", "Unknown");

  const display: ModifierSalesDisplay = useMemo(() => {
    if (!groupQuery.data && !optionQuery.data) return EMPTY_MODIFIER_SALES_DISPLAY;
    return buildModifierSalesDisplay({
      groupRowsRaw: groupQuery.data as Array<Partial<Record<string, unknown>>>,
      optionRowsRaw: optionQuery.data as Array<Partial<Record<string, unknown>>>,
      unknownGroupLabel,
    });
  }, [groupQuery.data, optionQuery.data, unknownGroupLabel]);

  const isLoading =
    orgLoading ||
    (enabled &&
      ((groupQuery.isLoading && !groupQuery.data) ||
        (optionQuery.isLoading && !optionQuery.data)));

  return {
    display,
    isLoading,
    isFetching: groupQuery.isFetching || optionQuery.isFetching,
    isError: groupQuery.isError || optionQuery.isError,
    error: groupQuery.error ?? optionQuery.error,
    refetch: async () => {
      await Promise.all([groupQuery.refetch(), optionQuery.refetch()]);
    },
  };
}

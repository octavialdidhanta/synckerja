import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";
import { mergePaymentMethodsReport } from "../lib/computePaymentMethodsDisplay";
import {
  EMPTY_PAYMENT_METHODS_DISPLAY,
  type PaymentMethodsDisplay,
} from "../lib/paymentMethodsTypes";
import { usePaymentMethodChannels } from "./usePaymentMethodChannels";

export type UsePaymentMethodsReportArgs = {
  outletId: string | null;
  fromIso: string;
  toIso: string;
  enabled?: boolean;
};

export function usePaymentMethodsReport(args: UsePaymentMethodsReportArgs) {
  const { organizationId, loading: orgLoading } = useCurrentOrg();
  const enabled = Boolean(args.enabled !== false && organizationId && args.fromIso && args.toIso);

  const channelsQuery = usePaymentMethodChannels({
    outletId: args.outletId,
    enabled,
  });

  const reportQuery = useQuery({
    queryKey: [
      "pos-payment-methods-report",
      organizationId,
      args.outletId,
      args.fromIso,
      args.toIso,
    ],
    enabled: enabled && !orgLoading,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("pos_payment_methods_report", {
        p_organization_id: organizationId!,
        p_outlet_id: args.outletId,
        p_from: args.fromIso,
        p_to: args.toIso,
      });
      if (error) throw error;
      return Array.isArray(data) ? data : data ? [data] : [];
    },
  });

  const display: PaymentMethodsDisplay = useMemo(() => {
    if (!reportQuery.data) return EMPTY_PAYMENT_METHODS_DISPLAY;
    return mergePaymentMethodsReport(
      channelsQuery.channels,
      reportQuery.data as Array<Partial<Record<string, unknown>>>,
    );
  }, [channelsQuery.channels, reportQuery.data]);

  const isLoading =
    orgLoading ||
    channelsQuery.isLoading ||
    (enabled && reportQuery.isLoading && !reportQuery.data);

  return {
    display,
    isLoading,
    isFetching: reportQuery.isFetching,
    isError: reportQuery.isError || channelsQuery.isError,
    error: reportQuery.error ?? channelsQuery.error,
    refetch: reportQuery.refetch,
  };
}

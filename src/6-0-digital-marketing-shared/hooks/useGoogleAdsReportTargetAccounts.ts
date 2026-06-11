import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { googleAdsReportTargetQueryKeys } from "@/6-0-digital-marketing-shared/googleAdsReportTargetQueryKeys";
import type { GoogleAdsReportTargetAccountRef } from "@/6-0-digital-marketing-shared/googleAdsReportTargetTypes";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";

type GoogleAdsAccountRow = {
  id: string;
  label: string | null;
  customer_id: string;
  is_default: boolean;
};

export function useGoogleAdsReportTargetAccounts() {
  const { organizationId } = useCurrentOrg();

  const query = useQuery({
    queryKey: googleAdsReportTargetQueryKeys.accounts(organizationId),
    queryFn: async (): Promise<GoogleAdsReportTargetAccountRef[]> => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from("organization_google_ads_accounts")
        .select("id, label, customer_id, is_default")
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as GoogleAdsAccountRow[]).map((row) => ({
        customerId: row.customer_id,
        accountLabel: row.label?.trim() || row.customer_id,
        currencyCode: null,
      }));
    },
    enabled: Boolean(organizationId),
    staleTime: 60_000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const accounts = useMemo(() => query.data ?? [], [query.data]);

  return {
    accounts,
    isLoading: query.isLoading,
    isPending: query.isPending,
  };
}

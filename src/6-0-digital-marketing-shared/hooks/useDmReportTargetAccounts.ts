import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { dmReportTargetQueryKeys } from "@/6-0-digital-marketing-shared/dmReportTargetQueryKeys";
import type { DmReportTargetAccountRef } from "@/6-0-digital-marketing-shared/dmReportTargetTypes";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useGoogleAdsSettings } from "@/google-ads/hooks/useGoogleAdsSettings";
import { useMetaAdsSettings } from "@/meta-ads/hooks/useMetaAdsSettings";
import { useTikTokAdsSettings } from "@/tiktok-ads/hooks/useTikTokAdsSettings";
import { supabase } from "@/shared/lib/supabaseClient";

type GoogleAdsAccountRow = {
  id: string;
  label: string | null;
  customer_id: string;
  is_default: boolean;
  sort_order: number;
};

const CHANNEL_ORDER = { google: 0, meta: 1, tiktok: 2 } as const;

export function useDmReportTargetAccounts() {
  const { organizationId } = useCurrentOrg();

  const { data: googleSettings, isPending: googleSettingsPending } = useGoogleAdsSettings(
    organizationId,
    { enabled: Boolean(organizationId) },
  );

  const googleQuery = useQuery({
    queryKey: [...dmReportTargetQueryKeys.accounts(organizationId), "google"] as const,
    queryFn: async (): Promise<DmReportTargetAccountRef[]> => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from("organization_google_ads_accounts")
        .select("id, label, customer_id, is_default, sort_order")
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as GoogleAdsAccountRow[]).map((row, index) => ({
        channel: "google" as const,
        accountId: row.customer_id,
        accountLabel: row.label?.trim() || row.customer_id,
        currencyCode: null,
        sortOrder: row.sort_order ?? index,
      }));
    },
    enabled: Boolean(organizationId) && Boolean(googleSettings?.oauthConnected),
    staleTime: 60_000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: metaSettings, isPending: metaPending } = useMetaAdsSettings(organizationId, {
    enabled: Boolean(organizationId),
  });

  const { data: tiktokSettings, isPending: tiktokPending } = useTikTokAdsSettings(organizationId, {
    enabled: Boolean(organizationId),
  });

  const metaAccounts = useMemo((): DmReportTargetAccountRef[] => {
    if (!metaSettings?.oauthConnected) return [];
    return (metaSettings?.accounts ?? [])
      .filter((a) => a.is_active && a.pixel_id !== "0")
      .map((row, index) => ({
        channel: "meta" as const,
        accountId: row.ad_account_id,
        accountLabel: row.label?.trim() || row.ad_account_id,
        currencyCode: null,
        sortOrder: row.sort_order ?? index,
      }));
  }, [metaSettings?.accounts, metaSettings?.oauthConnected]);

  const tiktokAccounts = useMemo((): DmReportTargetAccountRef[] => {
    if (!tiktokSettings?.oauthConnected) return [];
    return (tiktokSettings?.accounts ?? [])
      .filter((a) => a.is_active)
      .map((row, index) => ({
        channel: "tiktok" as const,
        accountId: row.advertiser_id,
        accountLabel: row.label?.trim() || row.advertiser_id,
        currencyCode: null,
        sortOrder: row.sort_order ?? index,
      }));
  }, [tiktokSettings?.accounts, tiktokSettings?.oauthConnected]);

  const accounts = useMemo(() => {
    const merged = [
      ...(googleQuery.data ?? []),
      ...metaAccounts,
      ...tiktokAccounts,
    ];
    return merged.sort((a, b) => {
      const channelDiff = CHANNEL_ORDER[a.channel] - CHANNEL_ORDER[b.channel];
      if (channelDiff !== 0) return channelDiff;
      return a.sortOrder - b.sortOrder || a.accountLabel.localeCompare(b.accountLabel);
    });
  }, [googleQuery.data, metaAccounts, tiktokAccounts]);

  return {
    accounts,
    isLoading: googleQuery.isLoading || googleSettingsPending || metaPending || tiktokPending,
    isPending: googleQuery.isPending || googleSettingsPending || metaPending || tiktokPending,
  };
}

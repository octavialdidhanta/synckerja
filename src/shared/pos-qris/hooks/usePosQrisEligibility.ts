import { useQuery } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { fetchXenditSettings } from "@/xendit/lib/xenditApi";
import { usePaymentMethodChannels } from "@/8-2-10-reports/payment-methods/hooks/usePaymentMethodChannels";

export function usePosQrisEligibility(outletId: string | null) {
  const { organizationId } = useCurrentOrg();

  const xenditQuery = useQuery({
    queryKey: ["xendit-settings", organizationId],
    queryFn: () => fetchXenditSettings(organizationId!),
    enabled: Boolean(organizationId),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const channelsQuery = usePaymentMethodChannels({
    outletId: outletId ?? "",
    enabled: Boolean(outletId),
  });

  const qrisChannel =
    channelsQuery.channels.find((ch) => ch.slug === "qris" && ch.isActive) ?? null;

  const xenditEnabled = Boolean(xenditQuery.data?.account?.is_enabled);
  const hasSubAccount = Boolean(
    xenditQuery.data?.primarySubAccount?.xendit_sub_account_id?.trim() ||
      xenditQuery.data?.subAccounts?.some((row) => Boolean(row.xendit_sub_account_id?.trim())),
  );

  return {
    isLoading: xenditQuery.isLoading || channelsQuery.isLoading,
    isEligible: Boolean(organizationId && qrisChannel && xenditEnabled && hasSubAccount),
    qrisChannel,
    isSandbox: xenditQuery.data?.isSandbox ?? true,
    xenditEnabled,
    hasSubAccount,
  };
}

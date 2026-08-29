import { useQuery } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";
import { normalizePaymentMethodChannel } from "../lib/computePaymentMethodsDisplay";
import type { PaymentMethodChannelConfig } from "../lib/paymentMethodsTypes";

export type UsePaymentMethodChannelsArgs = {
  outletId?: string | null;
  enabled?: boolean;
};

export function usePaymentMethodChannels(args: UsePaymentMethodChannelsArgs = {}) {
  const { organizationId, loading: orgLoading } = useCurrentOrg();
  const enabled = Boolean(args.enabled !== false && organizationId);

  const query = useQuery({
    queryKey: ["pos-payment-method-channels", organizationId, args.outletId ?? null],
    enabled: enabled && !orgLoading,
    queryFn: async (): Promise<PaymentMethodChannelConfig[]> => {
      await supabase.rpc("pos_seed_default_payment_channels", {
        p_organization_id: organizationId!,
      });

      let q = supabase
        .from("pos_payment_method_channels")
        .select(
          "id, organization_id, pos_outlet_id, category, name, slug, legacy_payment_method, is_active, sort_order",
        )
        .eq("organization_id", organizationId!)
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (args.outletId) {
        q = q.or(`pos_outlet_id.is.null,pos_outlet_id.eq.${args.outletId}`);
      } else {
        q = q.is("pos_outlet_id", null);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map((row) =>
        normalizePaymentMethodChannel(row as Record<string, unknown>),
      );
    },
  });

  return {
    channels: query.data ?? [],
    isLoading: orgLoading || (enabled && query.isLoading),
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

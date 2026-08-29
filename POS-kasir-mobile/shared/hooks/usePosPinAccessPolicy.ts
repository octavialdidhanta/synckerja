import { useQuery } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";
import type { PosPinFeatureKey } from "../lib/posPinFeatures";

export const POS_PIN_ACCESS_POLICY_QUERY_KEY = "pos-pin-access-policy";

export function usePosPinAccessPolicy() {
  const { organizationId } = useCurrentOrg();

  const query = useQuery({
    queryKey: [POS_PIN_ACCESS_POLICY_QUERY_KEY, organizationId],
    enabled: Boolean(organizationId),
    queryFn: async (): Promise<Set<string>> => {
      if (!organizationId) return new Set();
      const { data, error } = await supabase
        .from("pos_pin_access_settings")
        .select("required_features")
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (error) throw error;
      const features = (data?.required_features as string[] | null) ?? [];
      return new Set(features);
    },
  });

  const required = query.data ?? new Set<string>();

  const requiresPin = (feature: PosPinFeatureKey | string) => required.has(feature);

  return {
    requiredFeatures: required,
    requiresPin,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}

/** Verify administrator PIN for an outlet. Returns authorizing staff id or null. */
export async function verifyAdminPinForOutlet(args: {
  organizationId: string;
  outletId: string;
  pin: string;
}): Promise<string | null> {
  const { data, error } = await supabase.rpc("pos_verify_admin_pin_for_outlet", {
    p_organization_id: args.organizationId,
    p_outlet_id: args.outletId,
    p_pin: args.pin,
  });
  if (error) throw error;
  return (data as string | null) ?? null;
}

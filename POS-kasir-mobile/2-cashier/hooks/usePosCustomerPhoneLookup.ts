import { useMutation } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";
import {
  customerVisitPhoneLookupVariants,
  normalizeCustomerVisitPhone,
} from "@/5-2-customer-visits/lib/normalizeCustomerVisitPhone";

export type PosLoyaltyCustomer = {
  id: string;
  name: string;
  phone: string;
};

export function usePosCustomerPhoneLookup() {
  const { organizationId } = useCurrentOrg();

  return useMutation({
    mutationFn: async (rawPhone: string): Promise<PosLoyaltyCustomer | null> => {
      if (!organizationId) throw new Error("Organization ID is required");
      const key = normalizeCustomerVisitPhone(rawPhone);
      if (!key) return null;
      const variants = customerVisitPhoneLookupVariants(key);
      const { data, error } = await supabase
        .from("leads")
        .select("id, client, phone_number")
        .eq("organization_id", organizationId)
        .in("phone_number", variants)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        id: String(data.id),
        name: String(data.client ?? "").trim() || "—",
        phone: String(data.phone_number ?? key),
      };
    },
  });
}

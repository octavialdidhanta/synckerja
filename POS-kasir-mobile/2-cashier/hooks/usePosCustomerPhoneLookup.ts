import { useMutation } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { lookupPosCheckoutLeadByPhone } from "@/5-2-customer-visits/checkout/pos-bind";

export type PosLoyaltyCustomer = {
  id: string | null;
  name: string;
  phone: string;
};

export function usePosCustomerPhoneLookup() {
  const { organizationId } = useCurrentOrg();

  return useMutation({
    mutationFn: async (rawPhone: string): Promise<PosLoyaltyCustomer | null> => {
      if (!organizationId) throw new Error("Organization ID is required");
      const found = await lookupPosCheckoutLeadByPhone({
        organizationId,
        rawPhone,
      });
      if (!found?.lead) return null;
      const name = String(found.lead.client ?? "").trim() || "—";
      return {
        id: found.lead.id,
        name,
        phone: found.lead.phone_number ?? found.phoneKey,
      };
    },
  });
}

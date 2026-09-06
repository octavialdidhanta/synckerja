import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";

export const POS_OUTLET_RECEIPT_SHARE_QUERY_KEY = "pos-outlet-receipt-share";

export type PosOutletReceiptShareSettings = {
  shareViaEmail: boolean;
  shareViaSms: boolean;
};

export function usePosOutletReceiptShareSettings(outletId: string | null | undefined) {
  return useQuery({
    queryKey: [POS_OUTLET_RECEIPT_SHARE_QUERY_KEY, outletId],
    enabled: Boolean(outletId),
    staleTime: 60_000,
    queryFn: async (): Promise<PosOutletReceiptShareSettings> => {
      const { data, error } = await supabase
        .from("pos_outlet_receipt_settings")
        .select("share_via_email, share_via_sms")
        .eq("outlet_id", outletId as string)
        .maybeSingle();
      if (error) throw error;
      return {
        shareViaEmail: Boolean(data?.share_via_email),
        shareViaSms: Boolean(data?.share_via_sms),
      };
    },
  });
}

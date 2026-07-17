import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { LeadMagnetCampaignRow, LeadMagnetEnrollmentRow } from "../types.ts";

/** Instagram DM delivery with ≤3s hot-path target (sync before waitUntil). */
export async function deliverViaInstagramDm(
  admin: SupabaseClient,
  args: {
    enrollment: LeadMagnetEnrollmentRow;
    campaign: LeadMagnetCampaignRow;
    accessToken: string;
    pageId: string;
    isFallback?: boolean;
  },
): Promise<boolean> {
  const { sendDeliveryMessage } = await import("../followGateRuntime.ts");
  return sendDeliveryMessage(admin, {
    ...args,
    deliveryChannel: "instagram",
    isFallback: args.isFallback === true,
  });
}

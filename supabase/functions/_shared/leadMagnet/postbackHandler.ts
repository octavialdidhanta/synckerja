import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parseLeadMagnetPostbackPayload } from "./types.ts";
import type { LeadMagnetPostbackTriggerInput } from "./types.ts";
import { handleFollowConfirmPostback, sendDeliveryMessage } from "./followGateRuntime.ts";
import type { LeadMagnetCampaignRow, LeadMagnetEnrollmentRow } from "./types.ts";

type EnrollmentWithCampaign = LeadMagnetEnrollmentRow & {
  campaign: LeadMagnetCampaignRow | LeadMagnetCampaignRow[] | null;
};

export async function handleLeadMagnetPostbackTrigger(
  admin: SupabaseClient,
  input: LeadMagnetPostbackTriggerInput,
): Promise<boolean> {
  const parsed = parseLeadMagnetPostbackPayload(input.payload);
  if (!parsed) return false;

  const { data: enrollment, error } = await admin
    .from("lead_magnet_enrollments")
    .select("*, campaign:lead_magnet_campaigns(*)")
    .eq("id", parsed.enrollmentId)
    .eq("organization_id", input.organizationId)
    .maybeSingle();

  if (error || !enrollment) {
    console.warn("[lead-magnet] enrollment not found for postback", parsed.enrollmentId);
    return false;
  }

  const joined = enrollment as EnrollmentWithCampaign;
  const campaignRaw = joined.campaign;
  const campaignRow = Array.isArray(campaignRaw) ? campaignRaw[0] : campaignRaw;
  if (!campaignRow) return false;

  const row = joined as LeadMagnetEnrollmentRow;
  if (row.status === "paused" || row.status === "delivered" || row.status === "failed") {
    return true;
  }

  if (parsed.action === "follow_confirm") {
    await handleFollowConfirmPostback(admin, {
      enrollment: row,
      campaign: campaignRow,
      accessToken: input.accessToken,
      pageId: input.pageId,
    });
    return true;
  }

  if (parsed.action === "get_framework") {
    await sendDeliveryMessage(admin, {
      enrollment: row,
      campaign: campaignRow,
      accessToken: input.accessToken,
      pageId: input.pageId,
    });
    return true;
  }

  return false;
}

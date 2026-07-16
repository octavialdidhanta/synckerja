import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parseLeadMagnetPostbackPayload } from "./types.ts";
import type { LeadMagnetPostbackTriggerInput, LeadMagnetPostbackHandleResult } from "./types.ts";
import { handleFollowConfirmPostback, resendFrameworkOfferDm, resendLeadMagnetDeliveryDm, sendDeliveryMessage } from "./followGateRuntime.ts";
import type { LeadMagnetCampaignRow, LeadMagnetEnrollmentRow } from "./types.ts";

type EnrollmentWithCampaign = LeadMagnetEnrollmentRow & {
  campaign: LeadMagnetCampaignRow | LeadMagnetCampaignRow[] | null;
};

export async function handleLeadMagnetPostbackTrigger(
  admin: SupabaseClient,
  input: LeadMagnetPostbackTriggerInput,
): Promise<LeadMagnetPostbackHandleResult> {
  const parsed = parseLeadMagnetPostbackPayload(input.payload);
  if (!parsed) return { handled: false };

  const { data: enrollment, error } = await admin
    .from("lead_magnet_enrollments")
    .select("*, campaign:lead_magnet_campaigns(*)")
    .eq("id", parsed.enrollmentId)
    .eq("organization_id", input.organizationId)
    .maybeSingle();

  if (error || !enrollment) {
    console.warn("[lead-magnet] enrollment not found for postback", parsed.enrollmentId);
    return { handled: false };
  }

  const joined = enrollment as EnrollmentWithCampaign;
  const campaignRaw = joined.campaign;
  const campaignRow = Array.isArray(campaignRaw) ? campaignRaw[0] : campaignRaw;
  if (!campaignRow) return { handled: false };

  const row = joined as LeadMagnetEnrollmentRow;
  if (row.status === "paused" || row.status === "failed") {
    return { handled: true };
  }

  if (parsed.action === "follow_confirm") {
    if (row.status === "framework_offered" || row.status === "follow_validated") {
      await resendFrameworkOfferDm(admin, {
        enrollment: row,
        campaign: campaignRow,
        accessToken: input.accessToken,
        pageId: input.pageId,
      });
      return { handled: true, followConfirm: { outcome: "material_sent" } };
    }
    if (row.status === "delivered") {
      await resendLeadMagnetDeliveryDm(admin, {
        enrollment: row,
        campaign: campaignRow,
        accessToken: input.accessToken,
        pageId: input.pageId,
      });
      return { handled: true, followConfirm: { outcome: "material_sent" } };
    }

    const followConfirm = await handleFollowConfirmPostback(admin, {
      enrollment: row,
      campaign: campaignRow,
      accessToken: input.accessToken,
      pageId: input.pageId,
    });
    return { handled: true, followConfirm };
  }

  if (parsed.action === "get_framework") {
    if (row.status === "delivered") {
      return { handled: true };
    }
    await sendDeliveryMessage(admin, {
      enrollment: row,
      campaign: campaignRow,
      accessToken: input.accessToken,
      pageId: input.pageId,
    });
    return { handled: true };
  }

  return { handled: false };
}

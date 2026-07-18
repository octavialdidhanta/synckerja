import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  resolveFollowConfirmPostbackRoute,
  resolveGetFrameworkPostbackRoute,
} from "./openingFirstFlowRouting.ts";
import { parseLeadMagnetPostbackPayload } from "./types.ts";
import type { LeadMagnetPostbackTriggerInput, LeadMagnetPostbackHandleResult } from "./types.ts";
import {
  handleFollowConfirmPostback,
  handleOpeningClickPostback,
  resendFrameworkOfferDm,
  resendLeadMagnetDeliveryDm,
  sendDeliveryMessage,
  sendFrameworkOffer,
} from "./followGateRuntime.ts";
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
    const route = resolveFollowConfirmPostbackRoute(row);
    if (route === "resend_opening" || route === "resend_legacy_offer") {
      await resendFrameworkOfferDm(admin, {
        enrollment: row,
        campaign: campaignRow,
        accessToken: input.accessToken,
        pageId: input.pageId,
      });
      return { handled: true, followConfirm: { outcome: "material_sent" } };
    }
    if (route === "resend_delivery") {
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
    const route = resolveGetFrameworkPostbackRoute(row);
    if (route === "noop") {
      return { handled: true };
    }
    if (route === "opening_click") {
      const openingResult = await handleOpeningClickPostback(admin, {
        enrollment: row,
        campaign: campaignRow,
        accessToken: input.accessToken,
        pageId: input.pageId,
      });
      return { handled: true, openingClick: openingResult };
    }
    if (route === "legacy_framework_offer") {
      await sendFrameworkOffer(admin, {
        enrollment: row,
        campaign: campaignRow,
        accessToken: input.accessToken,
        pageId: input.pageId,
      });
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

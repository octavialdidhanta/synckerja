import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { deliverViaInstagramDm } from "../delivery/deliverViaInstagramDm.ts";
import { logLeadMagnetFunnelEvent } from "../funnelAnalytics.ts";
import type { LeadMagnetCampaignRow, LeadMagnetEnrollmentRow } from "../types.ts";
import { getParticipantProfile } from "./participantProfile.ts";
import { isContactGateEnabled, resolveFlowBranch } from "./skipMatrix.ts";
import { sendContactPrompt } from "./contactGatePrompt.ts";

export async function advanceAfterFollowValidated(
  admin: SupabaseClient,
  args: {
    enrollment: LeadMagnetEnrollmentRow;
    campaign: LeadMagnetCampaignRow;
    accessToken: string;
    pageId: string;
    isFollower?: boolean;
  },
): Promise<boolean> {
  if (!isContactGateEnabled(args.campaign)) {
    const { sendMaterialOfferOrDelivery } = await import("../followGateRuntime.ts");
    return sendMaterialOfferOrDelivery(admin, args);
  }

  await logLeadMagnetFunnelEvent(admin, {
    enrollmentId: args.enrollment.id,
    campaignId: args.campaign.id,
    organizationId: args.enrollment.organization_id,
    eventType: "material_offer_skipped",
    metadata: { reason: "contact_gate_enabled" },
  });

  const profile = await getParticipantProfile(admin, {
    organizationId: args.enrollment.organization_id,
    platform: args.enrollment.platform,
    participantScopedId: args.enrollment.participant_scoped_id,
  });

  const branch = resolveFlowBranch({
    campaign: args.campaign,
    profile: profile ?? { phone_number: null, email: null },
    isFollower: args.isFollower ?? true,
  });

  if (branch.branch === "deliver_instagram") {
    return deliverViaInstagramDm(admin, args);
  }
  if (branch.branch === "needs_contact") {
    return sendContactPrompt(admin, { ...args, ask: branch.ask });
  }

  const { sendMaterialOfferOrDelivery } = await import("../followGateRuntime.ts");
  return sendMaterialOfferOrDelivery(admin, args);
}

export async function advanceContactGateOnComment(
  admin: SupabaseClient,
  args: {
    enrollment: LeadMagnetEnrollmentRow;
    campaign: LeadMagnetCampaignRow;
    accessToken: string;
    pageId: string;
    isFollower: boolean;
  },
): Promise<boolean> {
  if (!isContactGateEnabled(args.campaign)) {
    return false;
  }

  const profile = await getParticipantProfile(admin, {
    organizationId: args.enrollment.organization_id,
    platform: args.enrollment.platform,
    participantScopedId: args.enrollment.participant_scoped_id,
  });

  const branch = resolveFlowBranch({
    campaign: args.campaign,
    profile: profile ?? { phone_number: null, email: null },
    isFollower: args.isFollower,
  });

  if (branch.branch === "deliver_instagram" && args.isFollower) {
    await logLeadMagnetFunnelEvent(admin, {
      enrollmentId: args.enrollment.id,
      campaignId: args.campaign.id,
      organizationId: args.enrollment.organization_id,
      eventType: "material_offer_skipped",
      metadata: { reason: "profile_complete_ig_delivery" },
    });
    return deliverViaInstagramDm(admin, args);
  }

  return false;
}

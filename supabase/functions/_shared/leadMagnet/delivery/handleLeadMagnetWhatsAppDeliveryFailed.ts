import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildMetaDeliverySkipReason } from "../../omnichannelPublicApi/syncOmnichannelWhatsAppDelivery.ts";
import { resolveMetaContentAccount } from "../../metaContentAuth.ts";
import { logLeadMagnetFunnelEvent, updateEnrollmentStatus } from "../funnelAnalytics.ts";
import type { LeadMagnetCampaignRow, LeadMagnetEnrollmentRow } from "../types.ts";
import { deliverViaInstagramDm } from "./deliverViaInstagramDm.ts";

type LeadMagnetMessageMeta = {
  enrollment_id?: string;
  campaign_id?: string;
  organization_id?: string;
};

/** When Meta reports WA delivery failed, fall back to Instagram DM delivery. */
export async function handleLeadMagnetWhatsAppDeliveryFailed(
  admin: SupabaseClient,
  args: {
    waMessageId: string;
    statusPayload: Record<string, unknown>;
  },
): Promise<void> {
  const waMessageId = args.waMessageId.trim();
  if (!waMessageId) return;

  const { data: msgRow } = await admin
    .from("whatsapp_messages")
    .select("raw_metadata")
    .eq("wa_message_id", waMessageId)
    .maybeSingle();

  const rawMeta = msgRow?.raw_metadata as Record<string, unknown> | undefined;
  const lmMeta = rawMeta?.synckerja_lead_magnet as LeadMagnetMessageMeta | undefined;
  const enrollmentId = String(lmMeta?.enrollment_id ?? "").trim();
  if (!enrollmentId) return;

  const { data: enrollmentRow } = await admin
    .from("lead_magnet_enrollments")
    .select("*, campaign:lead_magnet_campaigns(*)")
    .eq("id", enrollmentId)
    .maybeSingle();

  if (!enrollmentRow) return;

  const enrollment = enrollmentRow as LeadMagnetEnrollmentRow & {
    campaign: LeadMagnetCampaignRow | LeadMagnetCampaignRow[] | null;
  };

  if (enrollment.status === "delivered_instagram" || enrollment.status === "delivered") {
    return;
  }
  if (enrollment.status !== "delivered_whatsapp" && enrollment.status !== "contact_collected") {
    return;
  }

  const campaignRaw = enrollment.campaign;
  const campaign = (Array.isArray(campaignRaw) ? campaignRaw[0] : campaignRaw) as LeadMagnetCampaignRow | null;
  if (!campaign) return;

  const skipReason = buildMetaDeliverySkipReason(args.statusPayload);
  await logLeadMagnetFunnelEvent(admin, {
    enrollmentId: enrollment.id,
    campaignId: campaign.id,
    organizationId: enrollment.organization_id,
    eventType: "delivery_whatsapp_failed",
    metadata: {
      wa_message_id: waMessageId,
      error: skipReason,
      meta_webhook: true,
    },
  });

  const platform = campaign.platform === "facebook" ? "facebook" : "instagram";
  const account = await resolveMetaContentAccount(
    admin,
    enrollment.organization_id,
    platform,
    campaign.account_id,
  );
  if (!account?.pageAccessToken || !account.pageId) {
    console.error("[lead-magnet] WA failed — cannot resolve Meta account for IG fallback", {
      enrollmentId,
      platform,
      accountId: campaign.account_id,
    });
    return;
  }

  const fallbackOk = await deliverViaInstagramDm(admin, {
    enrollment,
    campaign,
    accessToken: account.pageAccessToken,
    pageId: account.pageId,
    isFallback: true,
  });

  if (!fallbackOk) {
    console.error("[lead-magnet] IG fallback after WA failed did not complete", { enrollmentId });
    return;
  }

  await updateEnrollmentStatus(admin, enrollment.id, "delivered_instagram", {
    last_error: skipReason.slice(0, 500),
  });

  if (enrollment.lead_submission_id) {
    await admin
      .from("lead_submissions")
      .update({
        whatsapp_status: "failed",
        whatsapp_skip_reason: skipReason,
        updated_at: new Date().toISOString(),
      })
      .eq("id", enrollment.lead_submission_id);
  }
}

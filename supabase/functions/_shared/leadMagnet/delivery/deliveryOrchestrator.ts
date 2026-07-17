import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logLeadMagnetFunnelEvent, updateEnrollmentStatus } from "../funnelAnalytics.ts";
import { upsertParticipantContactField } from "../contactGate/participantProfile.ts";
import { deliverViaEmail } from "./deliverViaEmail.ts";
import { deliverViaInstagramDm } from "./deliverViaInstagramDm.ts";
import { deliverViaWhatsAppTemplate } from "./deliverViaWhatsAppTemplate.ts";
import type { LeadMagnetCampaignRow, LeadMagnetEnrollmentRow } from "../types.ts";

declare const EdgeRuntime: {
  waitUntil: (promise: Promise<unknown>) => void;
};

function deferDelivery(work: Promise<unknown>): void {
  if (typeof EdgeRuntime !== "undefined" && typeof EdgeRuntime.waitUntil === "function") {
    EdgeRuntime.waitUntil(work);
    return;
  }
  void work;
}

export type DeliveryChannel = "instagram" | "whatsapp" | "email";

export async function runAsyncDelivery(
  admin: SupabaseClient,
  args: {
    enrollment: LeadMagnetEnrollmentRow;
    campaign: LeadMagnetCampaignRow;
    accessToken: string;
    pageId: string;
    channel: "whatsapp" | "email";
    phoneDigits?: string;
    email?: string;
  },
): Promise<void> {
  const startedAt = Date.now();

  if (args.channel === "whatsapp" && args.phoneDigits) {
    const waResult = await deliverViaWhatsAppTemplate(admin, {
      enrollment: args.enrollment,
      campaign: args.campaign,
      phoneDigits: args.phoneDigits,
    });

    if (waResult.ok) {
      await updateEnrollmentStatus(admin, args.enrollment.id, "delivered_whatsapp");
      await upsertParticipantContactField(admin, {
        organizationId: args.enrollment.organization_id,
        platform: args.enrollment.platform,
        participantScopedId: args.enrollment.participant_scoped_id,
        lastDeliveryChannel: "whatsapp",
      });

      const now = new Date().toISOString();
      if (args.enrollment.lead_submission_id) {
        await admin
          .from("lead_submissions")
          .update({
            whatsapp_status: "sent",
            whatsapp_message_id: waResult.waMessageId,
            whatsapp_sent_at: now,
            whatsapp_conversation_id: waResult.conversationId ?? null,
            whatsapp_skip_reason: waResult.persistError ?? null,
            updated_at: now,
          })
          .eq("id", args.enrollment.lead_submission_id);
      }

      await logLeadMagnetFunnelEvent(admin, {
        enrollmentId: args.enrollment.id,
        campaignId: args.campaign.id,
        organizationId: args.enrollment.organization_id,
        eventType: "delivery_whatsapp_sent",
        metadata: {
          wa_message_id: waResult.waMessageId,
          whatsapp_conversation_id: waResult.conversationId ?? null,
          persist_error: waResult.persistError ?? null,
          lm_delivery_latency_ms: Date.now() - startedAt,
        },
      });
      return;
    }

    await logLeadMagnetFunnelEvent(admin, {
      enrollmentId: args.enrollment.id,
      campaignId: args.campaign.id,
      organizationId: args.enrollment.organization_id,
      eventType: "delivery_whatsapp_failed",
      metadata: { error: waResult.error },
    });
    await deliverViaInstagramDm(admin, {
      enrollment: args.enrollment,
      campaign: args.campaign,
      accessToken: args.accessToken,
      pageId: args.pageId,
      isFallback: true,
    });
    return;
  }

  if (args.channel === "email" && args.email) {
    const emailResult = await deliverViaEmail(admin, {
      enrollment: args.enrollment,
      campaign: args.campaign,
      email: args.email,
    });

    if (emailResult.ok) {
      await updateEnrollmentStatus(admin, args.enrollment.id, "delivered_email");
      await upsertParticipantContactField(admin, {
        organizationId: args.enrollment.organization_id,
        platform: args.enrollment.platform,
        participantScopedId: args.enrollment.participant_scoped_id,
        lastDeliveryChannel: "email",
      });
      await logLeadMagnetFunnelEvent(admin, {
        enrollmentId: args.enrollment.id,
        campaignId: args.campaign.id,
        organizationId: args.enrollment.organization_id,
        eventType: "delivery_email_sent",
        metadata: { lm_delivery_latency_ms: Date.now() - startedAt },
      });
      return;
    }

    await logLeadMagnetFunnelEvent(admin, {
      enrollmentId: args.enrollment.id,
      campaignId: args.campaign.id,
      organizationId: args.enrollment.organization_id,
      eventType: "delivery_email_failed",
      metadata: { error: emailResult.error },
    });
    await deliverViaInstagramDm(admin, {
      enrollment: args.enrollment,
      campaign: args.campaign,
      accessToken: args.accessToken,
      pageId: args.pageId,
      isFallback: true,
    });
  }
}

export function scheduleAsyncDelivery(
  admin: SupabaseClient,
  args: Parameters<typeof runAsyncDelivery>[1],
): void {
  deferDelivery(runAsyncDelivery(admin, args));
}

export async function orchestrateDeliveryAfterContact(
  admin: SupabaseClient,
  args: {
    enrollment: LeadMagnetEnrollmentRow;
    campaign: LeadMagnetCampaignRow;
    accessToken: string;
    pageId: string;
    collectedKind: "phone" | "email";
    phoneDigits?: string;
    email?: string;
  },
): Promise<void> {
  if (args.collectedKind === "phone" && args.phoneDigits) {
    scheduleAsyncDelivery(admin, {
      ...args,
      channel: "whatsapp",
      phoneDigits: args.phoneDigits,
    });
    return;
  }
  if (args.collectedKind === "email" && args.email) {
    scheduleAsyncDelivery(admin, {
      ...args,
      channel: "email",
      email: args.email,
    });
  }
}

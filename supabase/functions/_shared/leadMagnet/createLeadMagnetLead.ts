import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getOrCreateSystemActor, resolveLeadStatusId } from "../omnichannelPublicApi/leadStatusMap.ts";
import { resolveLeadMagnetAccountLabel } from "./resolveLeadMagnetAccountLabel.ts";
import {
  getParticipantProfile,
  upsertParticipantContactField,
} from "./contactGate/participantProfile.ts";
import { findExistingChannelLeadForParticipant } from "./reconcileInstagramLeadMagnetLead.ts";
import type { LeadMagnetCampaignRow, LeadMagnetPlatform } from "./types.ts";

export async function createLeadMagnetLead(
  admin: SupabaseClient,
  args: {
    organizationId: string;
    campaign: LeadMagnetCampaignRow;
    enrollmentId: string;
    participantUsername: string | null;
    participantScopedId: string;
    platform: LeadMagnetPlatform;
    mediaId: string;
  },
): Promise<{ leadId: string; leadSubmissionId: string } | null> {
  try {
    const { data: existingEnrollment } = await admin
      .from("lead_magnet_enrollments")
      .select("id, lead_id, lead_submission_id")
      .eq("id", args.enrollmentId)
      .maybeSingle();

    if (existingEnrollment?.lead_id) {
      return {
        leadId: String(existingEnrollment.lead_id),
        leadSubmissionId: String(existingEnrollment.lead_submission_id ?? ""),
      };
    }

    const canonicalProfile = await getParticipantProfile(admin, {
      organizationId: args.organizationId,
      platform: args.platform,
      participantScopedId: args.participantScopedId,
    });

    if (canonicalProfile?.canonical_lead_id && canonicalProfile.canonical_submission_id) {
      await admin
        .from("lead_magnet_enrollments")
        .update({
          lead_id: canonicalProfile.canonical_lead_id,
          lead_submission_id: canonicalProfile.canonical_submission_id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", args.enrollmentId);
      return {
        leadId: canonicalProfile.canonical_lead_id,
        leadSubmissionId: canonicalProfile.canonical_submission_id,
      };
    }

    const existingChannelLead = await findExistingChannelLeadForParticipant(admin, {
      organizationId: args.organizationId,
      platform: args.platform,
      participantScopedId: args.participantScopedId,
      participantUsername: args.participantUsername,
    });

    const displayName = (args.participantUsername ?? "").trim().replace(/^@/, "") ||
      `${args.platform === "instagram" ? "IG" : "FB"} ${args.participantScopedId.slice(0, 8)}`;
    const now = new Date().toISOString();
    const channelLabel = args.platform === "instagram" ? "Instagram Comment" : "Facebook Comment";

    if (existingChannelLead?.leadId) {
      const leadId = existingChannelLead.leadId;
      await admin
        .from("leads")
        .update({
          source: "Lead Magnet",
          category: "Lead Magnet",
          updated_at: now,
        })
        .eq("id", leadId)
        .eq("organization_id", args.organizationId);

      const submissionId = crypto.randomUUID();
      const submissionPayload: Record<string, unknown> = {
        id: submissionId,
        organization_id: args.organizationId,
        lead_id: leadId,
        form_id: null,
        name: displayName,
        status: "draft",
        is_active: true,
        lead_magnet_enrollment_id: args.enrollmentId,
        lead_magnet_campaign_id: args.campaign.id,
        notes: `Lead magnet keyword "${args.campaign.keyword}" on media ${args.mediaId}`,
        updated_at: now,
      };
      const { error: subErr } = await admin.from("lead_submissions").insert(submissionPayload);
      if (subErr) {
        console.error("[lead-magnet] lead_submissions insert on reused channel lead failed:", subErr.message);
      }

      await admin
        .from("lead_magnet_enrollments")
        .update({
          lead_id: leadId,
          lead_submission_id: subErr ? null : submissionId,
          updated_at: now,
        })
        .eq("id", args.enrollmentId);

      await upsertParticipantContactField(admin, {
        organizationId: args.organizationId,
        platform: args.platform,
        participantScopedId: args.participantScopedId,
        canonicalLeadId: leadId,
        canonicalSubmissionId: subErr ? null : submissionId,
        phoneNumber: canonicalProfile?.phone_number ?? null,
        email: canonicalProfile?.email ?? null,
      });

      return { leadId, leadSubmissionId: subErr ? "" : submissionId };
    }

    const actor = await getOrCreateSystemActor(admin, args.organizationId);
    const statusId = await resolveLeadStatusId(admin, args.organizationId, "new");
    const accountLabel = await resolveLeadMagnetAccountLabel(admin, {
      organizationId: args.organizationId,
      campaignId: args.campaign.id,
      platform: args.platform,
      legacyAccountId: args.campaign.account_id,
    });

    const leadId = crypto.randomUUID();
    const ticketId = "LEAD-" + leadId.replace(/-/g, "").slice(0, 8).toUpperCase();

    const { error: leadErr } = await admin.from("leads").insert({
      id: leadId,
      ticket_id: ticketId,
      client: displayName,
      title: String(args.campaign.name ?? "").trim().slice(0, 120) || "Campaign",
      category: "Lead Magnet",
      source: "Lead Magnet",
      services: channelLabel,
      organization_id: args.organizationId,
      created_by: actor.userId,
      created_by_name: accountLabel,
      assignee: "Unassigned",
      status_id: statusId,
      web_id: null,
      created_at: now,
      updated_at: now,
    });

    if (leadErr) {
      console.error("[lead-magnet] leads insert failed:", leadErr.message);
      return null;
    }

    const submissionId = crypto.randomUUID();
    const submissionPayload: Record<string, unknown> = {
      id: submissionId,
      organization_id: args.organizationId,
      lead_id: leadId,
      form_id: null,
      name: displayName,
      status: "draft",
      is_active: true,
      lead_magnet_enrollment_id: args.enrollmentId,
      lead_magnet_campaign_id: args.campaign.id,
      notes: `Lead magnet keyword "${args.campaign.keyword}" on media ${args.mediaId}`,
      updated_at: now,
    };

    const { error: subErr } = await admin.from("lead_submissions").insert(submissionPayload);

    if (subErr) {
      console.error("[lead-magnet] lead_submissions insert failed:", subErr.message);
      return { leadId, leadSubmissionId: submissionId };
    }

    await admin
      .from("lead_magnet_enrollments")
      .update({ lead_id: leadId, lead_submission_id: submissionId, updated_at: now })
      .eq("id", args.enrollmentId);

    await upsertParticipantContactField(admin, {
      organizationId: args.organizationId,
      platform: args.platform,
      participantScopedId: args.participantScopedId,
      canonicalLeadId: leadId,
      canonicalSubmissionId: submissionId,
      phoneNumber: canonicalProfile?.phone_number ?? null,
      email: canonicalProfile?.email ?? null,
    });

    return { leadId, leadSubmissionId: submissionId };
  } catch (err) {
    console.error("[lead-magnet] createLeadMagnetLead error:", err);
    return null;
  }
}

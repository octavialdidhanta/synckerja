import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getOrCreateSystemActor, resolveLeadStatusId } from "../omnichannelPublicApi/leadStatusMap.ts";
import type { LeadMagnetCampaignRow, LeadMagnetPlatform } from "./types.ts";

async function resolveWebIdForLeadMagnet(
  admin: SupabaseClient,
  organizationId: string,
): Promise<string | null> {
  const { data: rows } = await admin
    .from("analytics_web_access")
    .select("web_id, is_approved")
    .eq("organization_id", organizationId)
    .order("is_approved", { ascending: false })
    .order("web_id", { ascending: true })
    .limit(5);

  if (rows?.length) {
    const approved = rows.find((r) => r.is_approved !== false);
    const webId = (approved ?? rows[0])?.web_id;
    if (webId && String(webId).trim()) return String(webId).trim();
  }

  const { data: sibling } = await admin
    .from("lead_submissions")
    .select("web_id")
    .eq("organization_id", organizationId)
    .not("web_id", "is", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sibling?.web_id && String(sibling.web_id).trim()) {
    return String(sibling.web_id).trim();
  }

  return null;
}

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
    const actor = await getOrCreateSystemActor(admin, args.organizationId);
    const statusId = await resolveLeadStatusId(admin, args.organizationId, "new");
    const webId = await resolveWebIdForLeadMagnet(admin, args.organizationId);
    if (!webId) {
      console.warn("[lead-magnet] no web_id for org, skipping lead_submissions");
      return null;
    }

    const displayName = (args.participantUsername ?? "").trim().replace(/^@/, "") ||
      `IG ${args.participantScopedId.slice(0, 8)}`;
    const now = new Date().toISOString();
    const channelLabel = args.platform === "instagram" ? "Instagram Comment" : "Facebook Comment";

    const leadId = crypto.randomUUID();
    const ticketId = "LEAD-" + leadId.replace(/-/g, "").slice(0, 8).toUpperCase();

    const { error: leadErr } = await admin.from("leads").insert({
      id: leadId,
      ticket_id: ticketId,
      client: displayName,
      title: `Lead Magnet — ${args.campaign.name}`.slice(0, 120),
      category: "Lead Magnet",
      source: "Lead Magnet",
      services: channelLabel,
      organization_id: args.organizationId,
      created_by: actor.userId,
      created_by_name: "",
      assignee: "Unassigned",
      status_id: statusId,
      web_id: webId,
      created_at: now,
      updated_at: now,
    });

    if (leadErr) {
      console.error("[lead-magnet] leads insert failed:", leadErr.message);
      return null;
    }

    const submissionId = crypto.randomUUID();
    const { error: subErr } = await admin.from("lead_submissions").insert({
      id: submissionId,
      organization_id: args.organizationId,
      lead_id: leadId,
      web_id: webId,
      form_id: null,
      name: displayName,
      status: "draft",
      is_active: true,
      lead_magnet_enrollment_id: args.enrollmentId,
      lead_magnet_campaign_id: args.campaign.id,
      notes: `Lead magnet keyword "${args.campaign.keyword}" on media ${args.mediaId}`,
      updated_at: now,
    });

    if (subErr) {
      console.error("[lead-magnet] lead_submissions insert failed:", subErr.message);
      return { leadId, leadSubmissionId: submissionId };
    }

    await admin
      .from("lead_magnet_enrollments")
      .update({ lead_id: leadId, lead_submission_id: submissionId, updated_at: now })
      .eq("id", args.enrollmentId);

    return { leadId, leadSubmissionId: submissionId };
  } catch (err) {
    console.error("[lead-magnet] createLeadMagnetLead error:", err);
    return null;
  }
}

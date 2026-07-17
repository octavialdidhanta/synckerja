import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { LeadMagnetPlatform } from "../types.ts";
import type { ParticipantProfileFields } from "./skipMatrix.ts";

export type ParticipantProfileRow = ParticipantProfileFields & {
  id: string;
  organization_id: string;
  platform: LeadMagnetPlatform;
  participant_scoped_id: string;
  canonical_lead_id: string | null;
  canonical_submission_id: string | null;
  last_delivery_channel: "instagram" | "whatsapp" | "email" | null;
};

export async function getParticipantProfile(
  admin: SupabaseClient,
  args: {
    organizationId: string;
    platform: LeadMagnetPlatform;
    participantScopedId: string;
  },
): Promise<ParticipantProfileRow | null> {
  const { data } = await admin
    .from("lead_magnet_participant_profiles")
    .select("*")
    .eq("organization_id", args.organizationId)
    .eq("platform", args.platform)
    .eq("participant_scoped_id", args.participantScopedId)
    .maybeSingle();
  return (data as ParticipantProfileRow | null) ?? null;
}

export async function upsertParticipantContactField(
  admin: SupabaseClient,
  args: {
    organizationId: string;
    platform: LeadMagnetPlatform;
    participantScopedId: string;
    phoneNumber?: string | null;
    email?: string | null;
    canonicalLeadId?: string | null;
    canonicalSubmissionId?: string | null;
    lastDeliveryChannel?: "instagram" | "whatsapp" | "email" | null;
  },
): Promise<ParticipantProfileRow | null> {
  const now = new Date().toISOString();
  const existing = await getParticipantProfile(admin, {
    organizationId: args.organizationId,
    platform: args.platform,
    participantScopedId: args.participantScopedId,
  });

  const patch: Record<string, unknown> = { updated_at: now };
  if (args.phoneNumber !== undefined) patch.phone_number = args.phoneNumber;
  if (args.email !== undefined) patch.email = args.email;
  if (args.canonicalLeadId !== undefined) patch.canonical_lead_id = args.canonicalLeadId;
  if (args.canonicalSubmissionId !== undefined) {
    patch.canonical_submission_id = args.canonicalSubmissionId;
  }
  if (args.lastDeliveryChannel !== undefined) patch.last_delivery_channel = args.lastDeliveryChannel;

  if (existing?.id) {
    const { data } = await admin
      .from("lead_magnet_participant_profiles")
      .update(patch)
      .eq("id", existing.id)
      .select("*")
      .maybeSingle();
    return (data as ParticipantProfileRow | null) ?? null;
  }

  const { data } = await admin
    .from("lead_magnet_participant_profiles")
    .insert({
      organization_id: args.organizationId,
      platform: args.platform,
      participant_scoped_id: args.participantScopedId,
      phone_number: args.phoneNumber ?? null,
      email: args.email ?? null,
      canonical_lead_id: args.canonicalLeadId ?? null,
      canonical_submission_id: args.canonicalSubmissionId ?? null,
      last_delivery_channel: args.lastDeliveryChannel ?? null,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .maybeSingle();
  return (data as ParticipantProfileRow | null) ?? null;
}

export async function syncSubmissionContactFields(
  admin: SupabaseClient,
  submissionId: string | null | undefined,
  fields: {
    phoneNumber?: string | null;
    email?: string | null;
    leadMagnetCampaignName?: string | null;
    leadMagnetTargetMarket?: string | null;
  },
): Promise<void> {
  if (!submissionId) return;

  const { data: existing } = await admin
    .from("lead_submissions")
    .select("lead_magnet_campaign_name, lead_magnet_target_market")
    .eq("id", submissionId)
    .maybeSingle();

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (fields.phoneNumber !== undefined) patch.phone_number = fields.phoneNumber;
  if (fields.email !== undefined) patch.email = fields.email;

  const snapshotName = fields.leadMagnetCampaignName?.trim() || null;
  const snapshotMarket = fields.leadMagnetTargetMarket?.trim() || null;
  const existingName = existing?.lead_magnet_campaign_name != null
    ? String(existing.lead_magnet_campaign_name).trim()
    : "";
  const existingMarket = existing?.lead_magnet_target_market != null
    ? String(existing.lead_magnet_target_market).trim()
    : "";

  if (snapshotName && !existingName) patch.lead_magnet_campaign_name = snapshotName;
  if (snapshotMarket && !existingMarket) patch.lead_magnet_target_market = snapshotMarket;

  await admin.from("lead_submissions").update(patch).eq("id", submissionId);
}

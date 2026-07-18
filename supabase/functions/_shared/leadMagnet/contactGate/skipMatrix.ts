import type { LeadMagnetCampaignRow } from "../types.ts";

export type ParticipantProfileFields = {
  phone_number: string | null;
  email: string | null;
};

export type MissingContactField = "any" | "phone" | "email";

export type ContactGateFlowBranch =
  | { branch: "legacy_material_or_delivery" }
  | { branch: "needs_follow_gate" }
  | { branch: "needs_contact"; ask: MissingContactField }
  | { branch: "deliver_instagram" };

export type ContactFlowCampaign = Pick<
  LeadMagnetCampaignRow,
  "contact_gate_enabled" | "email_collection_enabled"
>;

export function isContactGateEnabled(
  campaign: Pick<LeadMagnetCampaignRow, "contact_gate_enabled">,
): boolean {
  return campaign.contact_gate_enabled === true;
}

export function isEmailCollectionEnabled(
  campaign: Pick<LeadMagnetCampaignRow, "email_collection_enabled">,
): boolean {
  return campaign.email_collection_enabled === true;
}

export function isAnyContactFlowActive(campaign: ContactFlowCampaign): boolean {
  return isEmailCollectionEnabled(campaign) || isContactGateEnabled(campaign);
}

export function getMissingContactFields(profile: ParticipantProfileFields): MissingContactField | null {
  const hasPhone = Boolean(profile.phone_number?.trim());
  const hasEmail = Boolean(profile.email?.trim());
  if (hasPhone && hasEmail) return null;
  if (hasPhone && !hasEmail) return "email";
  if (!hasPhone && hasEmail) return "phone";
  return "any";
}

export function resolveFlowBranch(args: {
  campaign: ContactFlowCampaign;
  profile: ParticipantProfileFields;
  isFollower: boolean;
}): ContactGateFlowBranch {
  if (!isAnyContactFlowActive(args.campaign)) {
    return { branch: "legacy_material_or_delivery" };
  }
  if (!args.isFollower) {
    return { branch: "needs_follow_gate" };
  }

  const hasEmail = Boolean(args.profile.email?.trim());
  const hasPhone = Boolean(args.profile.phone_number?.trim());

  if (isEmailCollectionEnabled(args.campaign) && !hasEmail) {
    return { branch: "needs_contact", ask: "email" };
  }
  if (isContactGateEnabled(args.campaign) && hasEmail && !hasPhone) {
    return { branch: "needs_contact", ask: "phone" };
  }
  if (isContactGateEnabled(args.campaign) && hasPhone && hasEmail) {
    return { branch: "deliver_instagram" };
  }

  return { branch: "legacy_material_or_delivery" };
}

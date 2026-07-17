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

export function isContactGateEnabled(
  campaign: Pick<LeadMagnetCampaignRow, "contact_gate_enabled">,
): boolean {
  return campaign.contact_gate_enabled === true;
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
  campaign: Pick<LeadMagnetCampaignRow, "contact_gate_enabled">;
  profile: ParticipantProfileFields;
  isFollower: boolean;
}): ContactGateFlowBranch {
  if (!isContactGateEnabled(args.campaign)) {
    return { branch: "legacy_material_or_delivery" };
  }
  if (!args.isFollower) {
    return { branch: "needs_follow_gate" };
  }
  const missing = getMissingContactFields(args.profile);
  if (!missing) {
    return { branch: "deliver_instagram" };
  }
  return { branch: "needs_contact", ask: missing };
}

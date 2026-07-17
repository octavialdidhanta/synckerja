export type MissingContactField = 'any' | 'phone' | 'email';

export type ParticipantProfilePreview = {
  phone_number: string | null;
  email: string | null;
};

export type FlowPreviewBranch =
  | { branch: 'legacy' }
  | { branch: 'follow_gate' }
  | { branch: 'contact'; ask: MissingContactField }
  | { branch: 'deliver_ig' }
  | { branch: 'deliver_wa' }
  | { branch: 'deliver_email' };

export function getMissingContactFields(
  profile: ParticipantProfilePreview,
): MissingContactField | null {
  const hasPhone = Boolean(profile.phone_number?.trim());
  const hasEmail = Boolean(profile.email?.trim());
  if (hasPhone && hasEmail) return null;
  if (hasPhone && !hasEmail) return 'email';
  if (!hasPhone && hasEmail) return 'phone';
  return 'any';
}

export function previewFlowBranch(args: {
  contactGateEnabled: boolean;
  skipFollowGateIfFollower: boolean;
  isFollower: boolean;
  profile: ParticipantProfilePreview;
}): FlowPreviewBranch {
  if (!args.contactGateEnabled) return { branch: 'legacy' };
  if (!args.isFollower) return { branch: 'follow_gate' };
  const missing = getMissingContactFields(args.profile);
  if (!missing) return { branch: 'deliver_ig' };
  if (missing === 'any') return { branch: 'contact', ask: 'any' };
  if (missing === 'email') return { branch: 'contact', ask: 'email' };
  return { branch: 'contact', ask: 'phone' };
}

export const FLOW_PREVIEW_SCENARIOS = [
  { id: 'new_user', label: 'Pengikut baru (belum ada kontak)', isFollower: true, profile: { phone_number: null, email: null } },
  { id: 'has_wa', label: 'Sudah punya WA (kampanye berikutnya)', isFollower: true, profile: { phone_number: '628123456789', email: null } },
  { id: 'has_email', label: 'Sudah punya email', isFollower: true, profile: { phone_number: null, email: 'user@example.com' } },
  { id: 'complete', label: 'Profil lengkap', isFollower: true, profile: { phone_number: '628123456789', email: 'user@example.com' } },
  { id: 'non_follower', label: 'Belum follow', isFollower: false, profile: { phone_number: null, email: null } },
] as const;

export function branchLabel(branch: FlowPreviewBranch): string {
  switch (branch.branch) {
    case 'legacy':
      return 'Flow lama (Material Offer / Delivery)';
    case 'follow_gate':
      return 'Follow gate → kontak → delivery';
    case 'contact':
      if (branch.ask === 'any') return 'Minta WA atau email → delivery async';
      if (branch.ask === 'email') return 'Minta email (kampanye berikutnya) → delivery email';
      return 'Minta WA saja (kampanye berikutnya) → delivery WhatsApp';
    case 'deliver_ig':
      return 'Skip kontak → DM IG link (≤3s)';
    case 'deliver_wa':
      return 'Delivery WhatsApp template';
    case 'deliver_email':
      return 'Delivery email Resend';
    default:
      return '';
  }
}

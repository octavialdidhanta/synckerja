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
  | { branch: 'deliver_wa' };

export function previewFlowBranch(args: {
  emailCollectionEnabled: boolean;
  contactGateEnabled: boolean;
  isFollower: boolean;
  profile: ParticipantProfilePreview;
}): FlowPreviewBranch {
  if (!args.emailCollectionEnabled && !args.contactGateEnabled) {
    return { branch: 'legacy' };
  }
  if (!args.isFollower) return { branch: 'follow_gate' };

  const hasEmail = Boolean(args.profile.email?.trim());
  const hasPhone = Boolean(args.profile.phone_number?.trim());

  if (args.emailCollectionEnabled && !hasEmail) {
    return { branch: 'contact', ask: 'email' };
  }
  if (args.contactGateEnabled && hasEmail && !hasPhone) {
    return { branch: 'contact', ask: 'phone' };
  }
  if (args.contactGateEnabled && hasPhone && hasEmail) {
    return { branch: 'deliver_ig' };
  }
  return { branch: 'deliver_ig' };
}

export const FLOW_PREVIEW_SCENARIOS = [
  {
    id: 'new_user',
    labelKey: 'leadMagnet.contactGate.previewScenario.newUser',
    isFollower: true,
    profile: { phone_number: null, email: null },
  },
  {
    id: 'has_email',
    labelKey: 'leadMagnet.contactGate.previewScenario.hasEmail',
    isFollower: true,
    profile: { phone_number: null, email: 'user@example.com' },
  },
  {
    id: 'complete',
    labelKey: 'leadMagnet.contactGate.previewScenario.complete',
    isFollower: true,
    profile: { phone_number: '628123456789', email: 'user@example.com' },
  },
  {
    id: 'non_follower',
    labelKey: 'leadMagnet.contactGate.previewScenario.nonFollower',
    isFollower: false,
    profile: { phone_number: null, email: null },
  },
] as const;

export function branchLabelKey(branch: FlowPreviewBranch): string {
  switch (branch.branch) {
    case 'legacy':
      return 'leadMagnet.contactGate.previewBranch.legacy';
    case 'follow_gate':
      return 'leadMagnet.contactGate.previewBranch.followGate';
    case 'contact':
      if (branch.ask === 'email') return 'leadMagnet.contactGate.previewBranch.contactEmail';
      return 'leadMagnet.contactGate.previewBranch.contactPhone';
    case 'deliver_ig':
      return 'leadMagnet.contactGate.previewBranch.deliverIg';
    case 'deliver_wa':
      return 'leadMagnet.contactGate.previewBranch.deliverWa';
  }
}

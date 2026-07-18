import { describe, expect, it } from 'vitest';
import {
  isContactGateEnabled,
  isEmailCollectionEnabled,
  isAnyContactFlowActive,
  resolveFlowBranch,
} from '../../../../supabase/functions/_shared/leadMagnet/contactGate/skipMatrix.ts';
import { previewFlowBranch } from './skipMatrixPreview.ts';

describe('skipMatrix dual flags', () => {
  it('legacy when both flags off', () => {
    expect(
      previewFlowBranch({
        emailCollectionEnabled: false,
        contactGateEnabled: false,
        isFollower: true,
        profile: { phone_number: null, email: null },
      }).branch,
    ).toBe('legacy');
  });

  it('email ask for new follower when email collection on', () => {
    const branch = previewFlowBranch({
      emailCollectionEnabled: true,
      contactGateEnabled: false,
      isFollower: true,
      profile: { phone_number: null, email: null },
    });
    expect(branch.branch).toBe('contact');
    if (branch.branch === 'contact') expect(branch.ask).toBe('email');
  });

  it('phone ask for returning user when WA gate on', () => {
    const branch = previewFlowBranch({
      emailCollectionEnabled: true,
      contactGateEnabled: true,
      isFollower: true,
      profile: { phone_number: null, email: 'a@b.com' },
    });
    expect(branch.branch).toBe('contact');
    if (branch.branch === 'contact') expect(branch.ask).toBe('phone');
  });

  it('runtime resolve matches preview', () => {
    expect(
      resolveFlowBranch({
        campaign: { contact_gate_enabled: true, email_collection_enabled: true },
        profile: { phone_number: null, email: null },
        isFollower: true,
      }).branch,
    ).toBe('needs_contact');
  });

  it('helpers', () => {
    expect(isContactGateEnabled({ contact_gate_enabled: true })).toBe(true);
    expect(isEmailCollectionEnabled({ email_collection_enabled: true })).toBe(true);
    expect(
      isAnyContactFlowActive({ contact_gate_enabled: false, email_collection_enabled: true }),
    ).toBe(true);
  });
});

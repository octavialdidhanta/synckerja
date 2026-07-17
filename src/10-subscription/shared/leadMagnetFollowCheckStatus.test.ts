import { describe, expect, it } from 'vitest';
import {
  isConsentRequiredMetaError,
  needsMessagingConsentRecheck,
  resolveFollowStatus,
  shouldSkipFollowGate,
} from '../../../supabase/functions/_shared/leadMagnet/followCheckStatus.ts';

describe('followCheckStatus', () => {
  it('resolveFollowStatus — true is always follower', () => {
    expect(resolveFollowStatus(true)).toBe('follower');
    expect(resolveFollowStatus(true, { messagingWindowOpen: false })).toBe('follower');
  });

  it('resolveFollowStatus — false before messaging window is unknown', () => {
    expect(resolveFollowStatus(false)).toBe('unknown');
    expect(resolveFollowStatus(false, { messagingWindowOpen: false })).toBe('unknown');
  });

  it('resolveFollowStatus — false after messaging window is non_follower', () => {
    expect(resolveFollowStatus(false, { messagingWindowOpen: true })).toBe('non_follower');
  });

  it('shouldSkipFollowGate — only when skip enabled and follower', () => {
    const campaign = { skip_follow_gate_if_follower: true };
    expect(shouldSkipFollowGate(campaign, 'follower')).toBe(true);
    expect(shouldSkipFollowGate(campaign, 'non_follower')).toBe(false);
    expect(shouldSkipFollowGate(campaign, 'unknown')).toBe(false);
    expect(shouldSkipFollowGate({ skip_follow_gate_if_follower: false }, 'follower')).toBe(false);
  });

  it('needsMessagingConsentRecheck — IG first contact + skip + not follower', () => {
    const campaign = { skip_follow_gate_if_follower: true };
    const enrollment = {
      platform: 'instagram' as const,
      comment_id: 'cmt-1',
      private_reply_message_id: null,
    };
    expect(needsMessagingConsentRecheck(enrollment, campaign, 'unknown')).toBe(true);
    expect(needsMessagingConsentRecheck(enrollment, campaign, 'non_follower')).toBe(true);
    expect(needsMessagingConsentRecheck(enrollment, campaign, 'follower')).toBe(false);
    expect(
      needsMessagingConsentRecheck(
        { ...enrollment, private_reply_message_id: 'msg-1' },
        campaign,
        'unknown',
      ),
    ).toBe(false);
    expect(
      needsMessagingConsentRecheck(
        { ...enrollment, platform: 'facebook' },
        campaign,
        'unknown',
      ),
    ).toBe(false);
  });

  it('isConsentRequiredMetaError — detects consent errors', () => {
    expect(isConsentRequiredMetaError({ message: 'User consent is required' })).toBe(true);
    expect(isConsentRequiredMetaError({ code: 230 })).toBe(true);
    expect(isConsentRequiredMetaError({ message: 'Other error' })).toBe(false);
  });
});

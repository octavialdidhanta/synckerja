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

  it('shouldSkipFollowGate — gate OFF always skips; gate ON skips only follower', () => {
    const gateOff = { skip_follow_gate_if_follower: true };
    expect(shouldSkipFollowGate(gateOff, 'follower')).toBe(true);
    expect(shouldSkipFollowGate(gateOff, 'non_follower')).toBe(true);
    expect(shouldSkipFollowGate(gateOff, 'unknown')).toBe(true);

    const gateOn = { skip_follow_gate_if_follower: false };
    expect(shouldSkipFollowGate(gateOn, 'follower')).toBe(true);
    expect(shouldSkipFollowGate(gateOn, 'non_follower')).toBe(false);
    expect(shouldSkipFollowGate(gateOn, 'unknown')).toBe(false);
  });

  it('needsMessagingConsentRecheck — IG first contact + gate ON + not follower', () => {
    const gateOn = { skip_follow_gate_if_follower: false };
    const gateOff = { skip_follow_gate_if_follower: true };
    const enrollment = {
      platform: 'instagram' as const,
      comment_id: 'cmt-1',
      private_reply_message_id: null,
    };
    expect(needsMessagingConsentRecheck(enrollment, gateOn, 'unknown')).toBe(true);
    expect(needsMessagingConsentRecheck(enrollment, gateOn, 'non_follower')).toBe(true);
    expect(needsMessagingConsentRecheck(enrollment, gateOn, 'follower')).toBe(false);
    expect(needsMessagingConsentRecheck(enrollment, gateOff, 'unknown')).toBe(false);
    expect(
      needsMessagingConsentRecheck(
        { ...enrollment, private_reply_message_id: 'msg-1' },
        gateOn,
        'unknown',
      ),
    ).toBe(false);
    expect(
      needsMessagingConsentRecheck(
        { ...enrollment, platform: 'facebook' },
        gateOn,
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

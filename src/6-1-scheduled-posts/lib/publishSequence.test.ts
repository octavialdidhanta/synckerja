import { describe, expect, it } from 'vitest';
import { classifyPublishAttempt, publishPlatformRank } from './publishSequence';

describe('publish sequence', () => {
  it('orders platforms the same way as the publish table', () => {
    expect(publishPlatformRank('Facebook')).toBeLessThan(publishPlatformRank('Instagram'));
    expect(publishPlatformRank('Instagram')).toBeLessThan(publishPlatformRank('LinkedIn'));
    expect(publishPlatformRank('LinkedIn')).toBeLessThan(publishPlatformRank('TikTok'));
    expect(publishPlatformRank('TikTok')).toBeLessThan(publishPlatformRank('YouTube'));
  });

  it('classifies a row before the next platform may start', () => {
    expect(classifyPublishAttempt({ status: 'published', external_post_id: '1' })).toBe('published');
    expect(classifyPublishAttempt({ status: 'publishing', external_post_id: '1' })).toBe('published');
    expect(classifyPublishAttempt({ status: 'failed', next_retry_at: null })).toBe('failed');
    expect(classifyPublishAttempt({ status: 'pending', next_retry_at: '2026-11-12T12:00:00Z' })).toBe('retry_wait');
    expect(classifyPublishAttempt({ status: 'publishing', external_post_id: null })).toBe('in_progress');
  });
});

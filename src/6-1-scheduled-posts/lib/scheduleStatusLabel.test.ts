import { describe, expect, it } from 'vitest';
import { scheduleStatusLabel } from '@/6-1-scheduled-posts/lib/scheduleStatusLabel';

describe('scheduleStatusLabel', () => {
  it('keeps a live publish distinct from a stalled retry', () => {
    expect(scheduleStatusLabel('publishing', { publishStep: 'queued' })).toBe('Waiting');
    expect(scheduleStatusLabel('publishing', { publishStep: 'downloading' })).toBe('Downloading');
    expect(scheduleStatusLabel('publishing', { publishStep: 'uploading' })).toBe('Uploading');
    expect(scheduleStatusLabel('publishing', { publishStep: 'processing' })).toBe('Processing');
    expect(scheduleStatusLabel('publishing')).toBe('Publishing');
    expect(
      scheduleStatusLabel('pending', { errorMessage: 'publish_stalled: no progress while publishing' }),
    ).toBe('Retrying');
    expect(scheduleStatusLabel('published')).toBe('Published');
    expect(scheduleStatusLabel('failed')).toBe('Failed');
  });
});

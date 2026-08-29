import { describe, expect, it } from 'vitest';
import { computeFeedbackPresetRange, shiftFeedbackRangeByDay } from './feedbackDatePresets';

describe('feedbackDatePresets', () => {
  const anchor = new Date(2026, 7, 25);

  it('computes today preset', () => {
    expect(computeFeedbackPresetRange('today', anchor)).toEqual({
      from: '2026-08-25',
      to: '2026-08-25',
    });
  });

  it('shifts custom single-day range by one day', () => {
    const shifted = shiftFeedbackRangeByDay(
      { preset: 'custom', from: '2026-08-25', to: '2026-08-25' },
      1,
    );
    expect(shifted).toEqual({
      preset: 'custom',
      from: '2026-08-26',
      to: '2026-08-26',
    });
  });
});

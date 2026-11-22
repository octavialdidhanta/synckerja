import { describe, expect, it } from 'vitest';
import { planNeedsStaleMetadataSync } from './syncPlanCompletionStateClient';

describe('planNeedsStaleMetadataSync', () => {
  it('turns Done on for an active For Ads plan and then leaves it alone', () => {
    expect(
      planNeedsStaleMetadataSync({
        status_content: 'For Ads',
        done: false,
        on_time_status: 'In Progress',
      }),
    ).toBe(true);
    expect(
      planNeedsStaleMetadataSync({
        status_content: 'For Ads',
        done: true,
        on_time_status: 'In Progress',
      }),
    ).toBe(true);
    expect(
      planNeedsStaleMetadataSync({
        status_content: 'For Ads',
        done: true,
        on_time_status: '',
      }),
    ).toBe(false);
  });
});

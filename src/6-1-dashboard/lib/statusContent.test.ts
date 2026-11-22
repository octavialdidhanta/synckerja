import { describe, expect, it } from 'vitest';
import {
  normalizeStatusContent,
  onTimeStatusForForAds,
  STATUS_CONTENT_FOR_ADS,
  STATUS_CONTENT_NONE,
} from './statusContent';

describe('status content', () => {
  it('shows the old recommended-for-ads value as For Ads', () => {
    expect(normalizeStatusContent('Recomended For Ads')).toBe(STATUS_CONTENT_FOR_ADS);
    expect(normalizeStatusContent('Recommended For Ads')).toBe(STATUS_CONTENT_FOR_ADS);
    expect(normalizeStatusContent('For Ads')).toBe(STATUS_CONTENT_FOR_ADS);
    expect(normalizeStatusContent('')).toBe(STATUS_CONTENT_NONE);
    expect(normalizeStatusContent('Cancel')).toBe('Cancel');
  });

  it('hides a waiting on-time status while For Ads is active', () => {
    expect(onTimeStatusForForAds('For Ads', 'In Progress')).toBe('');
    expect(onTimeStatusForForAds('For Ads', 'Scheduled')).toBe('');
    expect(onTimeStatusForForAds('For Ads', 'Ontime')).toBe('Ontime');
    expect(onTimeStatusForForAds('Cancel', 'In Progress')).toBe('In Progress');
  });
});

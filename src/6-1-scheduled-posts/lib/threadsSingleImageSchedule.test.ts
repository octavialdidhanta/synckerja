import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  getThreadsPlanEligibilityMissingReasons,
  isPlanEligibleForThreadsAutoSchedule,
} from '../../../supabase/functions/_shared/scheduledPosts/scheduledPostEligibility.ts';
import { showThreadsScheduleRow, threadsPhotoCountNote } from './threadsScheduleRow';

function source(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

const ready = {
  post_date: '2026-11-18',
  approved: true,
  production_approved: true,
  google_drive_link: null,
  content_type_name: 'Post',
  carousel_image_count: 1,
};

describe('Threads single-image eligibility', () => {
  it('accepts a Post or Carousel with exactly one photo', () => {
    expect(isPlanEligibleForThreadsAutoSchedule(ready)).toBe(true);
    expect(isPlanEligibleForThreadsAutoSchedule({ ...ready, content_type_name: 'Carousel' })).toBe(true);
    expect(getThreadsPlanEligibilityMissingReasons(ready)).toEqual([]);
  });

  it('accepts two photos and a Drive Reel, and rejects a missing photo or eleven photos', () => {
    const drive = 'https://drive.google.com/file/d/abc123drivefile/view';
    expect(isPlanEligibleForThreadsAutoSchedule({ ...ready, carousel_image_count: 2 })).toBe(true);
    expect(isPlanEligibleForThreadsAutoSchedule({ ...ready, carousel_image_count: 10 })).toBe(true);
    expect(isPlanEligibleForThreadsAutoSchedule({
      ...ready,
      content_type_name: 'Reel',
      google_drive_link: drive,
      carousel_image_count: 0,
    })).toBe(true);
    expect(getThreadsPlanEligibilityMissingReasons({
      ...ready,
      content_type_name: 'Reel',
      google_drive_link: null,
    })).toContain('google_drive_link');
    expect(getThreadsPlanEligibilityMissingReasons({
      ...ready,
      content_type_name: 'Reel',
      google_drive_link: 'https://example.com/video.mp4',
    })).toContain('google_drive_file');
    expect(getThreadsPlanEligibilityMissingReasons({ ...ready, carousel_image_count: 0 }))
      .toContain('carousel_images');
    expect(getThreadsPlanEligibilityMissingReasons({ ...ready, carousel_image_count: 11 }))
      .toContain('carousel_image_limit');
  });
});

describe('Threads rows and reel executors', () => {
  it('shows a Threads row on photo plans and Reel plans, and explains 0 or 11 photos', () => {
    expect(showThreadsScheduleRow(true, 1)).toBe(true);
    expect(showThreadsScheduleRow(true, 0)).toBe(true);
    expect(showThreadsScheduleRow(true, 2)).toBe(true);
    expect(showThreadsScheduleRow(true, 11)).toBe(true);
    expect(showThreadsScheduleRow(false, 2)).toBe(true);
    expect(threadsPhotoCountNote(0)).toBe('Add at least 1 photo before posting to Threads.');
    expect(threadsPhotoCountNote(11)).toBe('Threads accepts at most 10 photos.');
    expect(threadsPhotoCountNote(2)).toBeNull();
    const section = source('src/6-1-scheduled-posts/components/UnifiedAutoScheduleSection.tsx');
    const row = source('src/6-1-scheduled-posts/components/RequiredPlatformScheduleRow.tsx');
    expect(section).toContain("target.platform === 'Threads'");
    expect(section).toContain('showThreadsScheduleRow');
    expect(section).toContain('tiktokCarouselOnly ? threadsPhotoCountNote');
    expect(row).toContain('statusNote');
  });

  it('publishes through the image helper and leaves the Reel executors untouched', () => {
    const executor = source('supabase/functions/_shared/scheduledPosts/executeThreadsScheduledPost.ts');
    const registry = source('supabase/functions/_shared/scheduledPosts/platformRegistry.ts');
    expect(executor).toContain('publishThreadsSingleImage');
    expect(executor).not.toContain('executeFacebookScheduledPost');
    expect(executor).not.toContain('executeInstagramScheduledPost');
    expect(executor).not.toContain('executeTikTokScheduledPost');
    expect(registry).toMatch(/Threads:\s*\{[^}]*implemented:\s*true/);
  });
});

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  computeNextRetryAt,
  resolveScheduleStatusAfterFailure,
  SCHEDULED_POST_MAX_RETRIES_TRANSIENT,
} from '../../../supabase/functions/_shared/scheduledPosts/scheduledPostRetry.ts';

function source(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

describe('Threads claim order', () => {
  it('ranks Threads after YouTube and keeps the first five platforms', () => {
    const migration = source('supabase/migrations_archive/20261118073927_threads_platform_rank.sql');
    const array = migration.match(/ARRAY\[([\s\S]*?)\]/)?.[1] ?? '';
    const names = [...array.matchAll(/'([^']+)'/g)].map((match) => match[1]);
    expect(names).toEqual(['Facebook', 'Instagram', 'LinkedIn', 'TikTok', 'YouTube', 'Threads']);
  });
});

describe('Threads cancel and retry', () => {
  it('cancels a pending Threads row by threads_user_id', () => {
    const cancel = source('supabase/functions/_shared/scheduledPosts/scheduledPostCancel.ts');
    expect(cancel).toMatch(/case\s+"Threads":\s*return\s+"threads_user_id"/);
  });

  it('keeps a container-not-ready error pending until the eighth retry', () => {
    const message = 'threads_container_not_ready:IN_PROGRESS';
    expect(resolveScheduleStatusAfterFailure(1, message, 'Threads')).toBe('pending');
    expect(computeNextRetryAt(1, message, 'Threads')).toEqual(expect.any(String));
    expect(resolveScheduleStatusAfterFailure(
      SCHEDULED_POST_MAX_RETRIES_TRANSIENT,
      message,
      'Threads',
    )).toBe('failed');
    expect(computeNextRetryAt(SCHEDULED_POST_MAX_RETRIES_TRANSIENT, message, 'Threads')).toBeNull();
  });

  it('fails a permanent photo error on the second retry', () => {
    expect(resolveScheduleStatusAfterFailure(1, 'carousel_images', 'Threads')).toBe('pending');
    expect(resolveScheduleStatusAfterFailure(2, 'carousel_images', 'Threads')).toBe('failed');
    expect(computeNextRetryAt(2, 'carousel_images', 'Threads')).toBeNull();
  });
});

describe('Threads schedule stays on the scheduler tick', () => {
  it('does not publish a schedule action inside the request', () => {
    const publish = source('supabase/functions/threads-content-publish/index.ts');
    const postNow = publish.indexOf('if (action === "post_now") return await handlePostNowResponse');
    const scheduleReturn = publish.indexOf('return threadsContentJson({ ok: true, schedule: inserted }, 200)');
    expect(postNow).toBeGreaterThan(-1);
    expect(scheduleReturn).toBeGreaterThan(postNow);
    expect(publish).toContain('runPostNowInBackground');
    expect(publish.slice(postNow, scheduleReturn)).not.toContain('runPostNowInBackground');
  });

  it('keeps the scheduler on the shared job and the Threads executor', () => {
    const tick = source('supabase/functions/_shared/scheduledPosts/handleSchedulerTick.ts');
    const executor = source('supabase/functions/_shared/scheduledPosts/executeScheduledPost.ts');
    expect(tick).toContain('runScheduledPostJob');
    expect(tick).not.toContain('platform === "Threads"');
    expect(executor).toMatch(/case\s+"Threads"/);
  });
});

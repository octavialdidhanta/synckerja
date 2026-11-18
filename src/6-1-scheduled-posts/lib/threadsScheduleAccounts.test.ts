import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assertPlatformCanSchedule } from '../../../supabase/functions/_shared/scheduledPosts/platformRegistry.ts';
import {
  listThreadsScheduleAccounts,
  type ThreadsScheduleAccountRow,
} from '../../../supabase/functions/_shared/scheduledPosts/threadsScheduleAccounts.ts';
import { AUTO_SCHEDULE_PLATFORMS, platformSupportsAutoSchedule } from '../types/platform-delivery';

function source(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

function row(partial: Partial<ThreadsScheduleAccountRow> = {}): ThreadsScheduleAccountRow {
  return {
    threads_user_id: '27664023756568315',
    threads_username: 'octa.vialdi',
    instagram_username: 'octa.vialdi',
    instagram_name: 'Octa',
    has_threads: true,
    is_active: true,
    threads_access_token_enc: 'enc',
    ...partial,
  };
}

describe('listThreadsScheduleAccounts', () => {
  it('returns one account when the row has a token and a threads user id', () => {
    expect(listThreadsScheduleAccounts([row()])).toEqual([
      { platform: 'Threads', accountId: '27664023756568315', accountLabel: 'octa.vialdi' },
    ]);
  });

  it('drops rows without a token, without threads, or inactive', () => {
    expect(listThreadsScheduleAccounts([
      row({ threads_access_token_enc: '' }),
      row({ threads_access_token_enc: '   ' }),
      row({ has_threads: false }),
      row({ is_active: false }),
      row({ threads_user_id: '  ' }),
    ])).toEqual([]);
  });

  it('collapses six Instagram rows that share one threads user id', () => {
    const usernames = [
      'octa.vialdi',
      'vialdi_wedding',
      'vialdi.id',
      'sate.sultan_pik',
      'openbook.charity',
      'synckerja_office',
    ];
    const accounts = listThreadsScheduleAccounts(
      usernames.map((instagram_username) => row({ instagram_username })),
    );
    expect(accounts).toHaveLength(1);
    expect(accounts[0]).toMatchObject({
      accountId: '27664023756568315',
      accountLabel: 'octa.vialdi',
    });
  });

  it('uses the instagram username when the threads username is empty', () => {
    expect(listThreadsScheduleAccounts([
      row({ threads_username: '', instagram_username: 'synckerja_office', instagram_name: 'Office' }),
    ])[0]?.accountLabel).toBe('synckerja_office');
  });
});

describe('Threads can be scheduled', () => {
  it('allows scheduling Threads', () => {
    expect(() => assertPlatformCanSchedule('Threads')).not.toThrow();
  });

  it('lists Threads in the auto-schedule platforms and the required-platform dropdown', () => {
    expect(platformSupportsAutoSchedule('Threads')).toBe(true);
    expect(AUTO_SCHEDULE_PLATFORMS).toContain('Threads');
    expect(AUTO_SCHEDULE_PLATFORMS).toEqual([
      'TikTok',
      'Instagram',
      'Facebook',
      'YouTube',
      'LinkedIn',
      'Threads',
    ]);
    const modal = source('src/6-1-social-media-settings/modal/ServiceRequiredPlatformsModal.tsx');
    expect(modal).toContain("'Threads'");
    const execute = source('supabase/functions/_shared/scheduledPosts/executeScheduledPost.ts');
    expect(execute).toMatch(/case\s+"Threads"/);
  });
});

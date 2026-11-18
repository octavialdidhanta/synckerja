import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createThreadsMediaDeleteCaller,
  deleteThreadsMedia,
  interpretThreadsMediaDelete,
} from '../../../supabase/functions/_shared/scheduledPosts/deletePublished/deleteThreadsPublishedPost.ts';
import { canDeletePublishedPlatformRow } from './canDeletePublishedPlatformRow';

function source(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

const MEDIA_ID = '17955480411316926';

describe('deleteThreadsMedia', () => {
  it('sends DELETE for the media id', async () => {
    const calls: Array<{ url: string; method: string }> = [];
    const original = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), method: String(init?.method ?? 'GET') });
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }) as typeof fetch;
    try {
      const result = await deleteThreadsMedia(MEDIA_ID, createThreadsMediaDeleteCaller('test-token'));
      expect(result).toEqual({ ok: true, alreadyDeleted: false });
      expect(calls).toHaveLength(1);
      expect(calls[0]?.method).toBe('DELETE');
      expect(calls[0]?.url).toContain(`graph.threads.net/v1.0/${MEDIA_ID}`);
    } finally {
      globalThis.fetch = original;
    }
  });

  it('treats a missing media message as already deleted', () => {
    expect(interpretThreadsMediaDelete({
      status: 400,
      message: 'The requested resource does not exist',
    })).toEqual({ ok: true, alreadyDeleted: true });
  });

  it('does not treat another error as success', () => {
    expect(interpretThreadsMediaDelete({
      status: 400,
      message: 'permission denied',
    })).toEqual({ ok: false, error: 'permission denied' });
  });
});

describe('Threads delete stays on its own path', () => {
  it('requests threads_delete after content publish and wires the button', () => {
    const scopes = source('supabase/functions/_shared/metaPlatformScopes.ts');
    const publish = source('supabase/functions/threads-content-publish/index.ts');
    const client = source('src/6-1-scheduled-posts/lib/deletePlanPlatformPublish.ts');
    const deleter = source('supabase/functions/_shared/scheduledPosts/deletePublished/deleteThreadsPublishedPost.ts');
    const list = scopes.match(/THREADS_OAUTH_SCOPE_LIST = \[([\s\S]*?)\]/)?.[1] ?? '';
    const names = [...list.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
    expect(names.at(-2)).toBe('threads_content_publish');
    expect(names.at(-1)).toBe('threads_delete');
    expect(publish).toContain('action === "delete"');
    expect(client).toContain("platform === 'Threads'");
    expect(client).toContain('threads_user_id');
    expect(deleter).not.toContain('executeFacebookScheduledPost');
    expect(deleter).not.toContain('executeInstagramScheduledPost');
    expect(deleter).not.toContain('executeTikTokScheduledPost');
    expect(canDeletePublishedPlatformRow(
      {
        requiredPlatformRowId: 'row',
        platform: 'Threads',
        accountId: '27664023756568315',
        accountLabel: 'octa.vialdi',
        oauthConnected: true,
        publishScopesOk: true,
      },
      { id: 'schedule', status: 'published' } as never,
      [],
    )).toBe(true);
  });
});

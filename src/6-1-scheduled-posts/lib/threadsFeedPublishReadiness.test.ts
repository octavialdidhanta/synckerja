import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { interpretThreadsFeedPublishLimit } from '../../../supabase/functions/_shared/threadsFeedPublishReadiness.ts';

function source(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

const FEED_SCOPES = ['threads_basic', 'threads_content_publish', 'threads_delete'];

describe('interpretThreadsFeedPublishLimit', () => {
  it('passes when feed scopes are granted and the post quota is above zero', () => {
    const result = interpretThreadsFeedPublishLimit({
      scopes: FEED_SCOPES,
      payload: {
        data: [{
          quota_usage: 4,
          config: { quota_total: 250 },
          reply_quota_usage: 1,
          reply_config: { quota_total: 1000 },
        }],
      },
    });
    expect(result).toMatchObject({
      ok: true,
      reason: null,
      detail: null,
      quota_total: 250,
      quota_usage: 4,
      reply_quota_total: 1000,
      has_content_publish: true,
      has_delete_scope: true,
    });
  });

  it('fails missing_scope when only the reply quota is present', () => {
    const result = interpretThreadsFeedPublishLimit({
      scopes: ['threads_basic', 'threads_manage_replies'],
      payload: { data: [{ reply_config: { quota_total: 1000 }, config: { quota_total: 250 } }] },
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('missing_scope');
    expect(result.detail).toBe('threads_content_publish');
    expect(result.has_content_publish).toBe(false);
    expect(result.reply_quota_total).toBe(1000);
  });

  it('treats scope names without regard to case', () => {
    const result = interpretThreadsFeedPublishLimit({
      scopes: ['Threads_Basic', 'THREADS_CONTENT_PUBLISH'],
      payload: { data: [{ config: { quota_total: 10 }, quota_usage: '2' }] },
    });
    expect(result.ok).toBe(true);
    expect(result.quota_usage).toBe(2);
    expect(result.has_delete_scope).toBe(false);
  });

  it('fails post_quota_absent when the payload only has a reply quota', () => {
    const result = interpretThreadsFeedPublishLimit({
      scopes: ['threads_basic', 'threads_content_publish'],
      payload: { data: [{ reply_config: { quota_total: 1000 }, reply_quota_usage: 3 }] },
    });
    expect(result).toMatchObject({
      ok: false,
      reason: 'post_quota_absent',
      quota_total: null,
      reply_quota_total: 1000,
    });
  });

  it('fails post_quota_zero when Meta returns a zero post quota', () => {
    const result = interpretThreadsFeedPublishLimit({
      scopes: ['threads_basic', 'threads_content_publish'],
      payload: { data: [{ config: { quota_total: 0 }, quota_usage: 0 }] },
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('post_quota_zero');
    expect(result.quota_total).toBe(0);
  });

  it('keeps the Graph error when feed scopes are already granted', () => {
    const result = interpretThreadsFeedPublishLimit({
      scopes: ['threads_basic', 'threads_content_publish'],
      apiError: '(#10) Application does not have permission',
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('api_error');
    expect(result.detail).toBe('(#10) Application does not have permission');
  });

  it('reports missing_scope before an API error', () => {
    const result = interpretThreadsFeedPublishLimit({
      scopes: [],
      apiError: 'permission denied',
    });
    expect(result.reason).toBe('missing_scope');
    expect(result.detail).toBe('threads_basic,threads_content_publish');
  });
});

describe('threads phase 0 does not publish', () => {
  it('publishes Threads from the scheduler and keeps the readiness probe off container creation', () => {
    const execute = source('supabase/functions/_shared/scheduledPosts/executeScheduledPost.ts');
    const readiness = source('supabase/functions/threads-content-api/handlers/publishReadiness.ts');
    const api = source('supabase/functions/_shared/threadsContentApi.ts');
    expect(execute).toMatch(/case\s+"Threads"/);
    expect(execute).toContain('executeThreadsScheduledPost');
    expect(readiness).not.toContain('threads_publish');
    expect(readiness).not.toContain('resolveLiveThreadsGrantedScopes');
    expect(readiness).toContain('fetchThreadsFeedPublishLimit');
    expect(readiness).toContain('fetchThreadsGrantedPermissions');
    expect(api).toContain('fields: "quota_usage,config,reply_quota_usage,reply_config"');
    expect(api).toContain('fields: "reply_quota_usage,reply_config"');
  });
});

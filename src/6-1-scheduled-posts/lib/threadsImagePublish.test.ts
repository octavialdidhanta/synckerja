import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  publishThreadsSingleImage,
  type ThreadsImageGraphCaller,
} from '../../../supabase/functions/_shared/scheduledPosts/threadsImagePublish.ts';

function source(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

const USER_ID = '27664023756568315';
const IMAGE_URL = 'https://example.com/phase2.jpg';

function graphRecorder() {
  const calls: Array<{ method: 'post' | 'get'; path: string; body?: Record<string, string>; params?: Record<string, string> }> = [];
  const graph: ThreadsImageGraphCaller = {
    async post(path, body) {
      calls.push({ method: 'post', path, body });
      if (path.endsWith('/threads')) return { id: 'container-1' };
      return { id: 'media-1' };
    },
    async get(path, params) {
      calls.push({ method: 'get', path, params });
      if (String(params.fields ?? '').includes('status')) return { id: path, status: 'FINISHED' };
      return { id: path, permalink: 'https://www.threads.net/@octa.vialdi/post/probe' };
    },
  };
  return { calls, graph };
}

describe('publishThreadsSingleImage', () => {
  it('creates an image container, publishes that creation id, then reads the permalink', async () => {
    const { calls, graph } = graphRecorder();
    const result = await publishThreadsSingleImage(
      { threadsUserId: USER_ID, imageUrl: IMAGE_URL, text: 'Uji foto' },
      graph,
    );

    expect(calls.map((call) => `${call.method} ${call.path}`)).toEqual([
      `post ${USER_ID}/threads`,
      'get container-1',
      `post ${USER_ID}/threads_publish`,
      'get media-1',
    ]);
    expect(calls[0]?.body).toEqual({
      media_type: 'IMAGE',
      image_url: IMAGE_URL,
      text: 'Uji foto',
    });
    expect(calls[1]?.params).toEqual({ fields: 'status,error_message' });
    expect(calls[2]?.body).toEqual({ creation_id: 'container-1' });
    expect(calls[3]?.params).toEqual({ fields: 'id,permalink' });
    expect(calls.some((call) => call.path.startsWith('me/'))).toBe(false);
    expect(result).toEqual({
      mediaId: 'media-1',
      permalink: 'https://www.threads.net/@octa.vialdi/post/probe',
      threadsPublishPath: 'image',
    });
  });

  it('does not publish when the image url is not https or the container has no id', async () => {
    const rejected = graphRecorder();
    await expect(publishThreadsSingleImage(
      { threadsUserId: USER_ID, imageUrl: 'http://example.com/a.jpg' },
      rejected.graph,
    )).rejects.toThrow('image_url_https_required');
    expect(rejected.calls).toEqual([]);

    const emptyContainer = graphRecorder();
    emptyContainer.graph.post = async (path, body) => {
      emptyContainer.calls.push({ method: 'post', path, body });
      return {};
    };
    await expect(publishThreadsSingleImage(
      { threadsUserId: USER_ID, imageUrl: IMAGE_URL },
      emptyContainer.graph,
    )).rejects.toThrow('threads_container_id_missing');
    expect(emptyContainer.calls.map((call) => call.path)).toEqual([`${USER_ID}/threads`]);
  });

  it('slices text to 500 characters and omits an empty caption', async () => {
    const long = graphRecorder();
    await publishThreadsSingleImage(
      { threadsUserId: USER_ID, imageUrl: IMAGE_URL, text: 'a'.repeat(501) },
      long.graph,
    );
    expect(long.calls[0]?.body?.text).toHaveLength(500);

    const empty = graphRecorder();
    await publishThreadsSingleImage(
      { threadsUserId: USER_ID, imageUrl: IMAGE_URL, text: '   ' },
      empty.graph,
    );
    expect(empty.calls[0]?.body).toEqual({
      media_type: 'IMAGE',
      image_url: IMAGE_URL,
    });
  });

  it('retries threads_publish once when the media is not ready, without a second container', async () => {
    const calls: string[] = [];
    let publishAttempts = 0;
    const graph: ThreadsImageGraphCaller = {
      async post(path) {
        calls.push(path);
        if (path.endsWith('/threads')) return { id: 'container-1' };
        publishAttempts += 1;
        if (publishAttempts === 1) throw new Error('The media is not ready to be published');
        return { id: 'media-1' };
      },
      async get(_path, params) {
        calls.push(String(params.fields ?? '').includes('status') ? 'status' : 'get');
        if (String(params.fields ?? '').includes('status')) return { status: 'FINISHED' };
        return { permalink: 'https://www.threads.net/@octa.vialdi/post/probe' };
      },
    };

    await publishThreadsSingleImage(
      { threadsUserId: USER_ID, imageUrl: IMAGE_URL },
      graph,
    );
    expect(calls).toEqual([
      `${USER_ID}/threads`,
      'status',
      `${USER_ID}/threads_publish`,
      `${USER_ID}/threads_publish`,
      'get',
    ]);
  });
});

describe('Threads image publish does not write schedule rows itself', () => {
  it('keeps the image publisher free of schedule and link writes', () => {
    const registry = source('supabase/functions/_shared/scheduledPosts/platformRegistry.ts');
    const publisher = source('supabase/functions/_shared/scheduledPosts/threadsImagePublish.ts');
    const handler = source('supabase/functions/threads-content-api/handlers/publishImage.ts');

    expect(registry).toMatch(/Threads:\s*\{[^}]*implemented:\s*true/);
    for (const file of [publisher, handler]) {
      expect(file).not.toContain('social_media_scheduled_posts');
      expect(file).not.toContain('social_media_links');
      expect(file).not.toContain('resolveLiveThreadsGrantedScopes');
    }
  });
});

describe('threads_publish_path log', () => {
  it('logs image before the container call', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { graph } = graphRecorder();
    await publishThreadsSingleImage({ threadsUserId: USER_ID, imageUrl: IMAGE_URL }, graph);
    expect(spy).toHaveBeenCalledWith('threads_publish_path=image');
    spy.mockRestore();
  });
});

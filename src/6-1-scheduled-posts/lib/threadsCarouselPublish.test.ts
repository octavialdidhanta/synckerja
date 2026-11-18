import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { publishThreadsCarousel } from '../../../supabase/functions/_shared/scheduledPosts/threadsCarouselPublish.ts';
import type { ThreadsImageGraphCaller } from '../../../supabase/functions/_shared/scheduledPosts/threadsImagePublish.ts';

function source(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

const USER_ID = '27664023756568315';

function graphRecorder() {
  const calls: Array<{ path: string; body?: Record<string, string>; params?: Record<string, string> }> = [];
  let items = 0;
  const graph: ThreadsImageGraphCaller = {
    async post(path, body) {
      calls.push({ path, body });
      if (body.media_type === 'IMAGE') {
        items += 1;
        return { id: `child-${items}` };
      }
      if (body.media_type === 'CAROUSEL') return { id: 'carousel-1' };
      return { id: 'media-1' };
    },
    async get(path, params) {
      calls.push({ path, params });
      if (String(params.fields ?? '').includes('status')) return { id: path, status: 'FINISHED' };
      return { id: path, permalink: 'https://www.threads.com/@octa.vialdi/post/carousel' };
    },
  };
  return { calls, graph };
}

describe('publishThreadsCarousel', () => {
  it('creates two image items, one carousel, then publishes that creation id', async () => {
    const { calls, graph } = graphRecorder();
    const result = await publishThreadsCarousel({
      threadsUserId: USER_ID,
      imageUrls: ['https://example.com/a.jpg', 'https://example.com/b.jpg'],
      text: 'Dua foto',
    }, graph);

    const posts = calls.filter((call) => call.body);
    expect(posts.map((call) => call.body?.media_type ?? 'publish')).toEqual([
      'IMAGE',
      'IMAGE',
      'CAROUSEL',
      'publish',
    ]);
    expect(posts[0]?.body).toMatchObject({
      media_type: 'IMAGE',
      image_url: 'https://example.com/a.jpg',
      is_carousel_item: 'true',
    });
    expect(posts[0]?.body?.text).toBeUndefined();
    expect(posts[2]?.body).toMatchObject({
      media_type: 'CAROUSEL',
      children: 'child-1,child-2',
      text: 'Dua foto',
    });
    expect(posts[3]?.path).toBe(`${USER_ID}/threads_publish`);
    expect(posts[3]?.body).toEqual({ creation_id: 'carousel-1' });
    expect(calls.at(-1)?.params).toEqual({ fields: 'id,permalink' });
    expect(result).toEqual({
      mediaId: 'media-1',
      permalink: 'https://www.threads.com/@octa.vialdi/post/carousel',
      threadsPublishPath: 'carousel',
    });
  });

  it('does not call Graph for one url or eleven urls', async () => {
    const one = graphRecorder();
    await expect(publishThreadsCarousel({
      threadsUserId: USER_ID,
      imageUrls: ['https://example.com/a.jpg'],
    }, one.graph)).rejects.toThrow('threads_carousel_count');
    expect(one.calls).toEqual([]);

    const eleven = graphRecorder();
    await expect(publishThreadsCarousel({
      threadsUserId: USER_ID,
      imageUrls: Array.from({ length: 11 }, (_, index) => `https://example.com/${index}.jpg`),
    }, eleven.graph)).rejects.toThrow('threads_carousel_count');
    expect(eleven.calls).toEqual([]);
  });
});

describe('Threads executor chooses image or carousel', () => {
  it('keeps the single-image helper and does not import Reel executors', () => {
    const executor = source('supabase/functions/_shared/scheduledPosts/executeThreadsScheduledPost.ts');
    expect(executor).toContain('publishThreadsSingleImage');
    expect(executor).toContain('publishThreadsCarousel');
    expect(executor).toContain('imageUrls.length === 1');
    expect(executor).not.toContain('executeFacebookScheduledPost');
    expect(executor).not.toContain('executeInstagramScheduledPost');
    expect(executor).not.toContain('executeTikTokScheduledPost');
  });
});

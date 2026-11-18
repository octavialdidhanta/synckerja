import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { publishThreadsVideo } from '../../../supabase/functions/_shared/scheduledPosts/threadsVideoPublish.ts';
import type { ThreadsImageGraphCaller } from '../../../supabase/functions/_shared/scheduledPosts/threadsImagePublish.ts';

function source(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

const USER_ID = '27664023756568315';
const VIDEO_URL = 'https://drive.usercontent.google.com/download?id=abc&export=download&confirm=t';

function graphRecorder() {
  const calls: Array<{ path: string; body?: Record<string, string>; params?: Record<string, string> }> = [];
  const graph: ThreadsImageGraphCaller = {
    async post(path, body) {
      calls.push({ path, body });
      if (body.media_type === 'VIDEO') return { id: 'video-container-1' };
      return { id: 'media-1' };
    },
    async get(path, params) {
      calls.push({ path, params });
      if (String(params.fields ?? '').includes('status')) return { id: path, status: 'FINISHED' };
      return { id: path, permalink: 'https://www.threads.com/@octa.vialdi/post/video' };
    },
  };
  return { calls, graph };
}

describe('publishThreadsVideo', () => {
  it('creates one video container, publishes that creation id, then reads the permalink', async () => {
    const { calls, graph } = graphRecorder();
    const result = await publishThreadsVideo({
      threadsUserId: USER_ID,
      videoUrl: VIDEO_URL,
      text: 'Satu video',
    }, graph);

    const posts = calls.filter((call) => call.body);
    expect(posts).toHaveLength(2);
    expect(posts[0]?.body).toEqual({
      media_type: 'VIDEO',
      video_url: VIDEO_URL,
      text: 'Satu video',
    });
    expect(posts[0]?.body?.is_carousel_item).toBeUndefined();
    expect(posts[1]?.path).toBe(`${USER_ID}/threads_publish`);
    expect(posts[1]?.body).toEqual({ creation_id: 'video-container-1' });
    expect(calls.at(-1)?.params).toEqual({ fields: 'id,permalink' });
    expect(result).toEqual({
      mediaId: 'media-1',
      permalink: 'https://www.threads.com/@octa.vialdi/post/video',
      threadsPublishPath: 'video',
    });
  });

  it('does not call Graph when the video url is not https', async () => {
    const { calls, graph } = graphRecorder();
    await expect(publishThreadsVideo({
      threadsUserId: USER_ID,
      videoUrl: 'http://example.com/video.mp4',
    }, graph)).rejects.toThrow('video_url_https_required');
    expect(calls).toEqual([]);
  });
});

describe('Threads video stays off the reel byte path', () => {
  it('publishes a Reel through the video helper and a photo through the image helper', () => {
    const executor = source('supabase/functions/_shared/scheduledPosts/executeThreadsScheduledPost.ts');
    const shared = source('supabase/functions/_shared/scheduledPosts/sharedPublishContext.ts');
    const bytes = shared.match(/const PLATFORMS_NEEDING_BYTES = new Set\(\[([\s\S]*?)\]\)/)?.[1] ?? '';
    expect(executor).toContain('publishThreadsVideo');
    expect(executor).toContain('publishThreadsSingleImage');
    expect(executor).toContain('isReelContentType');
    expect(executor).not.toContain('executeFacebookScheduledPost');
    expect(executor).not.toContain('executeInstagramScheduledPost');
    expect(executor).not.toContain('executeTikTokScheduledPost');
    expect(bytes).toContain('"YouTube"');
    expect(bytes).toContain('"LinkedIn"');
    expect(bytes).not.toContain('Threads');
  });
});

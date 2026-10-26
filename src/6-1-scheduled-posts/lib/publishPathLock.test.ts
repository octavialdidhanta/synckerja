import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

describe('social publish path lock', () => {
  it('keeps Facebook, Instagram, and TikTok off the shared byte preload', () => {
    const shared = source('supabase/functions/_shared/scheduledPosts/sharedPublishContext.ts');
    const setBody = shared.match(/const PLATFORMS_NEEDING_BYTES = new Set\(\[([\s\S]*?)\]\)/)?.[1] ?? '';
    expect(setBody).toContain('"YouTube"');
    expect(setBody).toContain('"LinkedIn"');
    expect(setBody).not.toMatch(/Facebook|Instagram|TikTok/);
    expect(shared).toContain('bytes: ctx.preloadedVideo.bytes.slice()');
    expect(shared).toContain('bytes: sharedCtx.preloadedVideo.bytes.slice()');
  });

  it('publishes Facebook from the Drive URL before any byte upload', () => {
    const facebook = source('supabase/functions/_shared/scheduledPosts/executeFacebookScheduledPost.ts');
    const api = source('supabase/functions/_shared/metaContent/metaFacebookReelsPublishApi.ts');
    const urlCall = facebook.indexOf('uploadFacebookReelsFromUrl(');
    const byteCall = facebook.indexOf('uploadFacebookReelsVideo(');
    expect(urlCall).toBeGreaterThan(-1);
    expect(byteCall).toBeGreaterThan(urlCall);
    expect(facebook).toContain('facebook_file_url_fallback');
    expect(api).toContain('file_url: fileUrl');
    expect(api).toContain('AbortSignal.timeout(FACEBOOK_FILE_URL_TIMEOUT_MS)');
    expect(api).toContain('AbortSignal.timeout(PLATFORM_BYTE_UPLOAD_TIMEOUT_MS)');
  });

  it('publishes Instagram and TikTok from the public URL before byte upload', () => {
    const instagram = source('supabase/functions/_shared/scheduledPosts/executeInstagramScheduledPost.ts');
    const tiktok = source('supabase/functions/_shared/scheduledPosts/executeTikTokScheduledPost.ts');
    const igUrl = instagram.indexOf('instagram_publish_path=video_url');
    const igBytes = instagram.indexOf('resolveVideoBytesForUpload(');
    expect(igUrl).toBeGreaterThan(-1);
    expect(igBytes).toBeGreaterThan(igUrl);
    expect(instagram).toContain('instagram_video_url_fallback');
    const pull = tiktok.indexOf('if (pullEnabled && pullUrl)');
    expect(pull).toBeGreaterThan(-1);
    expect(tiktok.indexOf('initTikTokVideoPublishPullFromUrl(')).toBeGreaterThan(pull);
  });

  it('does not upload a shared video buffer in parallel or label waiting rows as downloading', () => {
    const bulk = source('supabase/functions/_shared/scheduledPosts/runPlanBulkPostNow.ts');
    const drive = source('supabase/functions/_shared/scheduledPosts/googleDriveVideoDownload.ts');
    expect(bulk).toContain('willDownload ? "downloading" : "queued"');
    expect(bulk).toContain('Boolean(sharedCtx.preloadedVideo) || isPlanPublishSequential()');
    expect(bulk).toContain('for (const row of instagramAfterPeers)');
    expect(drive).toContain('AbortSignal.timeout(DRIVE_DOWNLOAD_TIMEOUT_MS)');
  });
});

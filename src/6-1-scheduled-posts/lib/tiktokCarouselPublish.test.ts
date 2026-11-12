import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import handler from '../../../api/tiktok-carousel/[...path]';
import { buildTikTokPhotoDirectPostBody } from '../../../supabase/functions/_shared/tiktokContent/tiktokPhotoPublishBody.ts';
import {
  authorizeCarouselImageRequest,
  buildTikTokCarouselImageUrl,
  CAROUSEL_IMAGE_URL_TTL_SEC,
  isCarouselStoragePath,
} from '../../../supabase/functions/_shared/tiktokCarouselImageUrl.ts';
import {
  getPlanEligibilityMissingReasons,
  getTikTokPlanEligibilityMissingReasons,
  isPlanEligibleForAutoSchedule,
  isPlanEligibleForFacebookAutoSchedule,
  isPlanEligibleForInstagramAutoSchedule,
  isPlanEligibleForLinkedInAutoSchedule,
  isPlanEligibleForReelAutoSchedule,
  isPlanEligibleForTikTokAutoSchedule,
  isPlanEligibleForYouTubeAutoSchedule,
} from '../../../supabase/functions/_shared/scheduledPosts/scheduledPostEligibility.ts';
import { publicCarouselImageUrl } from '../../../supabase/functions/_shared/metaContent/instagramCarouselPublishApi.ts';
import { facebookAttachedMediaFields } from '../../../supabase/functions/_shared/metaContent/facebookCarouselPublishApi.ts';
import {
  getPlanPublishEligibilityMissing,
  isPlanEligibleForPublish,
  isTikTokCarouselPublishReady,
} from './planAutoScheduleEligibility';

const ORG = '11111111-1111-4111-8111-111111111111';
const PLAN = '22222222-2222-4222-8222-222222222222';
const FILE = '33333333-3333-4333-8333-333333333333.jpg';
const STORAGE_PATH = `${ORG}/${PLAN}/${FILE}`;
const SECRET = 'carousel-test-secret';
const NOW = 1_700_000_000;

const reelPlan = {
  post_date: '2026-11-05',
  approved: true,
  production_approved: true,
  google_drive_link: 'https://drive.google.com/file/d/abc123drivefile/view',
  content_type_name: 'Reel',
  service_id: 'service-1',
};

const carouselPlan = {
  post_date: '2026-11-05',
  approved: true,
  production_approved: true,
  google_drive_link: null,
  content_type_name: 'Carousel',
  service_id: 'service-1',
  carousel_image_count: 2,
};

function fakeRes() {
  const headers = new Map<string, string>();
  let statusCode = 0;
  let body: unknown;
  const res = {
    status(code: number) {
      statusCode = code;
      return res;
    },
    setHeader(name: string, value: string) {
      headers.set(name.toLowerCase(), value);
      return res;
    },
    send(payload: unknown) {
      body = payload;
    },
    end() {},
  };
  return {
    res,
    get status() {
      return statusCode;
    },
    get headers() {
      return headers;
    },
    get body() {
      return body;
    },
  };
}

describe('TikTok carousel image URL', () => {
  it('rejects paths outside the carousel object pattern', () => {
    expect(isCarouselStoragePath(STORAGE_PATH)).toBe(true);
    expect(isCarouselStoragePath('../social-media-carousel/secret.jpg')).toBe(false);
    expect(isCarouselStoragePath(`${ORG}/${PLAN}/notes.txt`)).toBe(false);
    expect(isCarouselStoragePath('https://example.supabase.co/storage/file.jpg')).toBe(false);
  });

  it('signs a URL on office.synckerja.com and rejects a stale or altered signature', async () => {
    const url = new URL(await buildTikTokCarouselImageUrl({
      secret: SECRET,
      storagePath: STORAGE_PATH,
      nowSec: NOW,
    }));
    expect(url.origin).toBe('https://office.synckerja.com');
    expect(url.pathname).toBe(`/api/tiktok-carousel/${ORG}/${PLAN}/${FILE}`);
    expect(Number(url.searchParams.get('exp'))).toBe(NOW + CAROUSEL_IMAGE_URL_TTL_SEC);

    const ok = await authorizeCarouselImageRequest({
      storagePath: STORAGE_PATH,
      expRaw: url.searchParams.get('exp') ?? '',
      sig: url.searchParams.get('sig') ?? '',
      secret: SECRET,
      nowSec: NOW + 60,
    });
    expect(ok.ok).toBe(true);

    const expired = await authorizeCarouselImageRequest({
      storagePath: STORAGE_PATH,
      expRaw: String(NOW - 120),
      sig: url.searchParams.get('sig') ?? '',
      secret: SECRET,
      nowSec: NOW,
    });
    expect(expired).toMatchObject({ ok: false, status: 403, error: 'carousel_url_expired' });

    const tampered = await authorizeCarouselImageRequest({
      storagePath: STORAGE_PATH,
      expRaw: url.searchParams.get('exp') ?? '',
      sig: `${url.searchParams.get('sig') ?? ''}ab`,
      secret: SECRET,
      nowSec: NOW,
    });
    expect(tampered).toMatchObject({ ok: false, status: 403 });
  });
});

describe('TikTok carousel eligibility', () => {
  it('keeps reel publish dependent on a Drive file', () => {
    expect(isPlanEligibleForReelAutoSchedule(reelPlan)).toBe(true);
    expect(isPlanEligibleForTikTokAutoSchedule(reelPlan)).toBe(true);
    expect(isPlanEligibleForPublish(reelPlan)).toBe(true);
    const withoutDrive = { ...reelPlan, google_drive_link: null };
    expect(isPlanEligibleForReelAutoSchedule(withoutDrive)).toBe(false);
    expect(getPlanEligibilityMissingReasons(withoutDrive)).toContain('google_drive_link');
    expect(getPlanPublishEligibilityMissing(withoutDrive)).toContain('google_drive_link');
  });

  it('accepts a carousel without a Drive link and leaves other platforms on reels', () => {
    expect(isPlanEligibleForTikTokAutoSchedule(carouselPlan)).toBe(true);
    expect(isPlanEligibleForTikTokAutoSchedule({ ...carouselPlan, content_type_name: 'Post' })).toBe(true);
    expect(isTikTokCarouselPublishReady(carouselPlan)).toBe(true);
    expect(getTikTokPlanEligibilityMissingReasons(carouselPlan)).not.toContain('google_drive_link');
    expect(isPlanEligibleForInstagramAutoSchedule(carouselPlan)).toBe(true);
    expect(isPlanEligibleForInstagramAutoSchedule(reelPlan)).toBe(true);
    expect(isPlanEligibleForYouTubeAutoSchedule(carouselPlan)).toBe(false);
    expect(isPlanEligibleForFacebookAutoSchedule(carouselPlan)).toBe(true);
    expect(isPlanEligibleForFacebookAutoSchedule(reelPlan)).toBe(true);
    expect(isPlanEligibleForFacebookAutoSchedule({
      ...carouselPlan,
      carousel_image_count: 0,
    })).toBe(false);
    expect(isPlanEligibleForLinkedInAutoSchedule(carouselPlan)).toBe(false);
    expect(isPlanEligibleForReelAutoSchedule(carouselPlan)).toBe(false);
    expect(isPlanEligibleForAutoSchedule(carouselPlan)).toBe(false);
    expect(isPlanEligibleForPublish(carouselPlan)).toBe(false);
    expect(getPlanEligibilityMissingReasons(carouselPlan)).toContain('content_type_reel');
    expect(getTikTokPlanEligibilityMissingReasons({
      ...carouselPlan,
      carousel_image_count: 0,
    })).toContain('carousel_images');
  });
});

describe('Facebook carousel photo fields', () => {
  it('attaches each uploaded photo as its own media id', () => {
    expect(facebookAttachedMediaFields(['11', '22'])).toEqual({
      'attached_media[0]': '{"media_fbid":"11"}',
      'attached_media[1]': '{"media_fbid":"22"}',
    });
  });
});

describe('Instagram carousel image URL', () => {
  it('points at the public carousel object without a redirect', () => {
    const url = publicCarouselImageUrl('https://example.supabase.co/', STORAGE_PATH);
    expect(url).toBe(
      `https://example.supabase.co/storage/v1/object/public/social-media-carousel/${STORAGE_PATH}`,
    );
    expect(url).not.toContain('?');
  });
});

describe('TikTok photo request', () => {
  it('builds a direct photo pull body', () => {
    const body = buildTikTokPhotoDirectPostBody({
      title: 'Judul carousel yang cukup panjang '.repeat(8),
      description: 'Caption dari plan',
      privacyLevel: 'PUBLIC_TO_EVERYONE',
      disableComment: false,
      photoImages: [`https://office.synckerja.com/api/tiktok-carousel/${STORAGE_PATH}?exp=1&sig=abc`],
    }) as {
      post_mode: string;
      media_type: string;
      post_info: { title: string; description: string; privacy_level: string; auto_add_music: boolean };
      source_info: { source: string; photo_cover_index: number; photo_images: string[] };
    };
    expect(body.post_mode).toBe('DIRECT_POST');
    expect(body.media_type).toBe('PHOTO');
    expect(body.source_info.source).toBe('PULL_FROM_URL');
    expect(body.source_info.photo_cover_index).toBe(0);
    expect(body.source_info.photo_images).toHaveLength(1);
    expect(body.post_info.privacy_level).toBe('PUBLIC_TO_EVERYONE');
    expect(body.post_info.auto_add_music).toBe(true);
    expect(body.post_info.title.length).toBeLessThanOrEqual(90);
    expect(body.post_info.description).toBe('Caption dari plan');
  });
});

describe('carousel image HTTP response', () => {
  it('returns the JPEG itself and does not follow a storage redirect', async () => {
    process.env.TIKTOK_CAROUSEL_URL_SECRET = SECRET;
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
    const url = new URL(await buildTikTokCarouselImageUrl({
      secret: SECRET,
      storagePath: STORAGE_PATH,
      nowSec: Math.floor(Date.now() / 1000),
    }));
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toContain(`/storage/v1/object/social-media-carousel/${ORG}/${PLAN}/${FILE}`);
      expect(init?.redirect).toBe('manual');
      return new Response(jpeg, { status: 200, headers: { 'content-type': 'image/jpeg' } });
    });
    vi.stubGlobal('fetch', fetchMock);

    const ok = fakeRes();
    await handler({
      method: 'GET',
      query: {
        path: [ORG, PLAN, FILE],
        exp: url.searchParams.get('exp') ?? '',
        sig: url.searchParams.get('sig') ?? '',
      },
    }, ok.res);
    expect(ok.status).toBe(200);
    expect(ok.headers.get('content-type')).toBe('image/jpeg');
    expect(ok.headers.has('location')).toBe(false);
    expect(ok.body).toBeInstanceOf(Buffer);

    const head = fakeRes();
    await handler({
      method: 'HEAD',
      query: {
        path: [ORG, PLAN, FILE],
        exp: url.searchParams.get('exp') ?? '',
        sig: url.searchParams.get('sig') ?? '',
      },
    }, head.res);
    expect(head.status).toBe(200);
    expect(head.headers.get('content-type')).toBe('image/jpeg');
    expect(head.headers.has('location')).toBe(false);
    expect(head.body).toBeUndefined();

    fetchMock.mockResolvedValueOnce(new Response(null, {
      status: 302,
      headers: { location: 'https://example.supabase.co/storage/v1/object/public/social-media-carousel/x.jpg' },
    }));
    const redirected = fakeRes();
    await handler({
      method: 'HEAD',
      query: {
        path: [ORG, PLAN, FILE],
        exp: url.searchParams.get('exp') ?? '',
        sig: url.searchParams.get('sig') ?? '',
      },
    }, redirected.res);
    expect(redirected.status).toBe(502);
    expect(redirected.headers.has('location')).toBe(false);
    expect(String(redirected.body)).toBe('storage_redirect');

    vi.unstubAllGlobals();
  });
});

describe('vercel rewrite', () => {
  it('leaves /api routes out of the SPA fallback', () => {
    const vercel = JSON.parse(readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8')) as {
      rewrites: Array<{ source: string; destination: string }>;
    };
    const proxy = vercel.rewrites.find((rule) => rule.source === '/api/tiktok-carousel/:org/:plan/:file');
    expect(proxy?.destination).toContain('/storage/v1/object/public/social-media-carousel/:org/:plan/:file');
    const spa = vercel.rewrites.find((rule) => rule.destination === '/index.html');
    expect(spa?.source).toContain('(?!api/)');
    expect(vercel.rewrites[0]?.source).toBe('/api/tiktok-carousel/:org/:plan/:file');
  });
});

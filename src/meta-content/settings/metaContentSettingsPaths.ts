import type { MetaContentPlatform } from '@/meta-platform/types/metaContentTypes';

export const META_CONTENT_INSTAGRAM_BASE_PATH =
  '/digital-marketing/social-media-performance/instagram';

export const META_CONTENT_INSTAGRAM_SETTINGS_PATH =
  '/digital-marketing/social-media-performance/instagram/settings';

export const META_CONTENT_FACEBOOK_BASE_PATH =
  '/digital-marketing/social-media-performance/facebook';

export const META_CONTENT_FACEBOOK_SETTINGS_PATH =
  '/digital-marketing/social-media-performance/facebook/settings';

export type MetaContentOAuthReturnPath =
  | typeof META_CONTENT_INSTAGRAM_SETTINGS_PATH
  | typeof META_CONTENT_FACEBOOK_SETTINGS_PATH;

export function getMetaContentBasePath(platform: MetaContentPlatform): string {
  return platform === 'instagram'
    ? META_CONTENT_INSTAGRAM_BASE_PATH
    : META_CONTENT_FACEBOOK_BASE_PATH;
}

export function getMetaContentSettingsPath(platform: MetaContentPlatform): string {
  return platform === 'instagram'
    ? META_CONTENT_INSTAGRAM_SETTINGS_PATH
    : META_CONTENT_FACEBOOK_SETTINGS_PATH;
}

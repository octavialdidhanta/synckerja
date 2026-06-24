export const OAUTH_REQUIRED_PLATFORMS = [
  'TikTok',
  'YouTube',
  'Instagram',
  'Facebook',
  'LinkedIn',
] as const;

export type OAuthRequiredPlatform = (typeof OAUTH_REQUIRED_PLATFORMS)[number];

export const MANUAL_NAME_REQUIRED_PLATFORMS = [
  'Twitter',
  'Shopee',
  'Tokopedia',
  'Other',
] as const;

export const PLATFORM_SETTINGS_PATHS: Record<string, string> = {
  TikTok: '/digital-marketing/social-media-performance/tiktok/settings',
  YouTube: '/digital-marketing/social-media-performance/youtube/settings',
  Instagram: '/digital-marketing/social-media-performance/instagram/settings',
  Facebook: '/digital-marketing/social-media-performance/facebook/settings',
  LinkedIn: '/digital-marketing/social-media-performance/linkedin/settings',
};

export function isOAuthRequiredPlatform(platform: string): boolean {
  return (OAUTH_REQUIRED_PLATFORMS as readonly string[]).includes(platform.trim());
}

export function getPlatformSettingsPath(platform: string): string | null {
  return PLATFORM_SETTINGS_PATHS[platform.trim()] ?? null;
}

export function normalizeMetaPlatformKey(platform: string): 'instagram' | 'facebook' | null {
  const p = platform.trim().toLowerCase();
  if (p === 'instagram') return 'instagram';
  if (p === 'facebook') return 'facebook';
  return null;
}

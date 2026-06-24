import type { ServiceRequiredPlatform } from '@/6-1-dashboard/hook/useServiceRequiredPlatforms';
import type { SocialMediaLink } from '@/shared/types/social-media-links';

type LinkFormLike = {
  platform: string;
  social_media_name?: string;
  url?: string;
};

function isValidHttpUrl(url: string | null | undefined): boolean {
  const value = url?.trim() ?? '';
  return value.startsWith('http://') || value.startsWith('https://');
}

export function shouldDeleteViaPlatformPublish(link: LinkFormLike): boolean {
  const platform = link.platform.trim();
  return (platform === 'YouTube' || platform === 'TikTok') && isValidHttpUrl(link.url);
}

export function resolvePlatformAccountIdForDelete(
  link: LinkFormLike,
  serverLink: SocialMediaLink | undefined,
  requiredPlatforms: ServiceRequiredPlatform[],
): string | null {
  const platform = link.platform.trim();
  const fromServer = serverLink?.platform_account_open_id?.trim();
  if (fromServer) return fromServer;

  const active = requiredPlatforms.filter(
    (row) => row.is_active !== false && row.platform === platform,
  );

  if (active.length === 1) {
    const accountId = active[0].platform_account_id?.trim();
    if (accountId) return accountId;
  }

  const name = link.social_media_name?.trim() ?? '';
  if (name) {
    const byLabel = active.find(
      (row) =>
        row.platform_account_label?.trim() === name
        || row.social_media_name?.name === name,
    );
    if (byLabel?.platform_account_id?.trim()) {
      return byLabel.platform_account_id.trim();
    }
  }

  return null;
}

/** @deprecated Use resolvePlatformAccountIdForDelete */
export const resolveYouTubeChannelIdForDelete = resolvePlatformAccountIdForDelete;

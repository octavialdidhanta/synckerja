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
  return link.platform.trim() === 'YouTube' && isValidHttpUrl(link.url);
}

export function resolveYouTubeChannelIdForDelete(
  link: LinkFormLike,
  serverLink: SocialMediaLink | undefined,
  requiredPlatforms: ServiceRequiredPlatform[],
): string | null {
  const fromServer = serverLink?.platform_account_open_id?.trim();
  if (fromServer) return fromServer;

  const activeYouTube = requiredPlatforms.filter(
    (row) => row.is_active !== false && row.platform === 'YouTube',
  );

  if (activeYouTube.length === 1) {
    const accountId = activeYouTube[0].platform_account_id?.trim();
    if (accountId) return accountId;
  }

  const name = link.social_media_name?.trim() ?? '';
  if (name) {
    const byLabel = activeYouTube.find(
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

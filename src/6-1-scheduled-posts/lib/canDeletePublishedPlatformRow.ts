import type { RequiredPlatformAutoTarget } from './resolveRequiredPlatformTargets';
import type { ScheduledPost } from '../types/scheduled-post';

type LinkLike = {
  platform: string;
  url: string | null;
  platform_account_open_id?: string | null;
};

function isValidHttpUrl(url: string | null | undefined): boolean {
  const value = url?.trim() ?? '';
  return value.startsWith('http://') || value.startsWith('https://');
}

export function canDeletePublishedPlatformRow(
  target: RequiredPlatformAutoTarget,
  schedule: ScheduledPost | null,
  links: LinkLike[],
): boolean {
  if (target.platform !== 'YouTube') return false;

  if (schedule?.status === 'published') return true;

  const youtubeLinks = links.filter(
    (link) => link.platform === 'YouTube' && isValidHttpUrl(link.url),
  );

  return youtubeLinks.some((link) => {
    const openId = link.platform_account_open_id?.trim();
    if (!openId) return true;
    return openId === target.accountId.trim();
  });
}

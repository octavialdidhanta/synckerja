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

function canDeleteForPlatform(
  platform: string,
  accountId: string,
  schedule: ScheduledPost | null,
  links: LinkLike[],
): boolean {
  if (schedule?.status === 'published') return true;

  const platformLinks = links.filter(
    (link) => link.platform === platform && isValidHttpUrl(link.url),
  );

  return platformLinks.some((link) => {
    const openId = link.platform_account_open_id?.trim();
    if (!openId) return true;
    return openId === accountId.trim();
  });
}

export function canDeletePublishedPlatformRow(
  target: RequiredPlatformAutoTarget,
  schedule: ScheduledPost | null,
  links: LinkLike[],
): boolean {
  if (target.platform !== 'YouTube' && target.platform !== 'TikTok' && target.platform !== 'Instagram' && target.platform !== 'Facebook') return false;
  return canDeleteForPlatform(target.platform, target.accountId, schedule, links);
}

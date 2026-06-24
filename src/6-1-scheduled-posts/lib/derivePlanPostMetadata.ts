import type {
  RequiredPlatformItemStatus,
  RequiredPlatformProgressItem,
  SocialMediaLinkInput,
} from './computeRequiredPlatformsProgress';

export const ON_TIME_IN_PROGRESS = 'In Progress';
export const ON_TIME_SCHEDULED = 'Scheduled';

function isValidLink(link: SocialMediaLinkInput): boolean {
  const url = link.url?.trim() ?? '';
  const platform = link.platform?.trim() ?? '';
  return Boolean(platform && url.startsWith('http'));
}

function isFilledItemStatus(status: RequiredPlatformItemStatus): boolean {
  return status === 'published' || status === 'link_ready';
}

export function calculateOnTimeStatusClient(
  actualPostDateIso: string | null,
  postDateIso: string | null,
): string {
  if (!actualPostDateIso || !postDateIso) return '';
  const actual = new Date(actualPostDateIso);
  const planned = new Date(postDateIso);
  if (Number.isNaN(actual.getTime()) || Number.isNaN(planned.getTime())) return '';
  if (actual <= planned) return 'Ontime';
  const diffTime = Math.abs(actual.getTime() - planned.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return `Late ${diffDays} Day${diffDays > 1 ? 's' : ''}`;
}

export function derivePlanPostMetadataClient(
  items: RequiredPlatformProgressItem[],
  links: SocialMediaLinkInput[],
  postDateIso: string | null,
  hasRequiredPlatforms: boolean,
): { actual_post_date: string | null; on_time_status: string } {
  if (!hasRequiredPlatforms) {
    const validLinks = links.filter(isValidLink);
    if (validLinks.length === 0) {
      return { actual_post_date: null, on_time_status: ON_TIME_IN_PROGRESS };
    }
    const dates = validLinks
      .map((l) => l.created_at)
      .filter(Boolean) as string[];
    const earliest = dates.length > 0 ? dates.sort()[0] : new Date().toISOString();
    const actualDate = earliest.split('T')[0];
    return {
      actual_post_date: actualDate,
      on_time_status: calculateOnTimeStatusClient(actualDate, postDateIso) || ON_TIME_IN_PROGRESS,
    };
  }

  if (items.length === 0) {
    return { actual_post_date: null, on_time_status: ON_TIME_IN_PROGRESS };
  }

  const hasFailed = items.some((item) => item.status === 'failed');
  const allComplete = items.every((item) => isFilledItemStatus(item.status));
  const allScheduledOnly = items.every((item) => item.status === 'scheduled');

  if (allComplete && !hasFailed) {
    const completionDates = items
      .map((item) => item.completedAtIso)
      .filter(Boolean) as string[];
    const latestIso = completionDates.length > 0
      ? completionDates.sort().at(-1)!
      : new Date().toISOString();
    const actualDate = latestIso.split('T')[0];
    return {
      actual_post_date: actualDate,
      on_time_status: calculateOnTimeStatusClient(actualDate, postDateIso) || ON_TIME_IN_PROGRESS,
    };
  }

  if (allScheduledOnly) {
    return { actual_post_date: null, on_time_status: ON_TIME_SCHEDULED };
  }

  return { actual_post_date: null, on_time_status: ON_TIME_IN_PROGRESS };
}
